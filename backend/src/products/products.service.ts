import {
  Inject,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { ProductSource } from 'src/common/enums/product-source.enum';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { AddProductFromCatalogDto } from './dto/add-product-from-catalog.dto';
import { ImageProcessorService } from 'src/common/services/image-processor.service';
import { DbTenantContext } from 'src/common/contexts/db-tenant.context';
import { ProductOrderMode } from 'src/common/enums/product-order-mode.enum';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StoresDirectoryService } from 'src/stores-directory/stores-directory.service';
import { Prisma, Product, CatalogItem } from '../../generated/prisma/client';
import {
  buildAllowedCatalogCategoryWhere,
  CatalogSource,
  getAllowedCatalogCategoriesForSource,
  isCatalogCategoryAllowedForSource,
  resolveCatalogSourceForTenantCategory,
} from './catalog-source-policy';

const DEFAULT_PRODUCT_CATEGORY = 'أخرى';
const DUPLICATE_PRODUCT_NAME_MESSAGE = 'Product with this name already exists';
const PRODUCT_SEARCH_CACHE_TTL_SECONDS = 60;
const DEFAULT_WEIGHT_PRESET_GRAMS = [250, 500, 1000] as const;
const DEFAULT_PRICE_PRESET_AMOUNTS = [100, 200, 300] as const;
const DEFAULT_QUANTITY_UNIT_LABEL = 'قطعة';
const MAX_ORDER_PRESETS = 6;

type QuantityUnitOptionConfig = {
  id: string;
  label: string;
  multiplier: number;
};

type ProductOrderConfig = {
  quantity?: {
    unit_label?: string;
    unit_options?: QuantityUnitOptionConfig[];
  };
  weight?: {
    preset_grams: number[];
    allow_custom_grams: boolean;
  };
  price?: {
    preset_amounts_egp: number[];
    allow_custom_amount: boolean;
  };
};

type PublicProductsResult = {
  data: Product[];
  meta: {
    total: number;
    page: number;
    limit: number;
    last_page: number;
    has_next: boolean;
  };
};

type PublicProductCategorySummary = {
  category: string;
  count: number;
  image_url?: string;
};

type TenantProductsSearchResult = {
  data: Product[];
  meta: {
    total: number;
    page: number;
    limit: number;
    last_page: number;
    has_next: boolean;
  };
};

type CatalogItemsResult = {
  data: CatalogItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    last_page: number;
    has_next: boolean;
  };
};

type TenantProductsSearchOptions = {
  rankAll?: boolean;
  excludeProductIds?: number[];
};

type StrictMatchThresholds = {
  strictSimilarityThreshold: number;
  strictWordSimilarityThreshold: number;
};

/**
 * Products service handles product lifecycle for each tenant.
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageProcessorService: ImageProcessorService,
    private readonly storesDirectoryService: StoresDirectoryService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private getPrismaClient() {
    const manager = DbTenantContext.getManager() as Prisma.TransactionClient;
    return manager || this.prisma;
  }

  private async resolveTenantCatalogSource(
    tenantId: number,
  ): Promise<CatalogSource | null> {
    const tenant = await this.getPrismaClient().tenant.findUnique({
      where: { id: tenantId },
      select: { category: true },
    });

    return resolveCatalogSourceForTenantCategory(tenant?.category);
  }

  private emptyCatalogItemsResult(
    page: number,
    limit: number,
  ): CatalogItemsResult {
    return {
      data: [],
      meta: {
        total: 0,
        page,
        limit,
        last_page: 1,
        has_next: false,
      },
    };
  }

  /**
   * Creates a manual product for the authenticated tenant.
   */
  async create(
    tenantId: number,
    createProductDto: CreateProductDto,
    file?: Express.Multer.File,
  ): Promise<Product> {
    const normalizedName = createProductDto.name.trim();
    if (!normalizedName) {
      throw new BadRequestException('Product name is required');
    }

    await this.ensureUniqueActiveProductName(tenantId, normalizedName);

    const orderMode = this.resolveProductOrderMode(createProductDto.order_mode);
    const orderConfig = this.normalizeProductOrderConfig(
      orderMode,
      createProductDto.order_config,
    );
    const imageUrl = file?.path
      ? await this.imageProcessorService.processProductThumbnail(file.path)
      : createProductDto.image_url;

    const product = await this.getPrismaClient().product.create({
      data: {
        tenant_id: tenantId,
        name: normalizedName,
        image_url: imageUrl,
        category: this.normalizeCategory(createProductDto.category),
        source: ProductSource.MANUAL,
        status: ProductStatus.ACTIVE,
        current_price:
          typeof createProductDto.current_price === 'number'
            ? this.normalizeCurrentPrice(createProductDto.current_price)
            : undefined,
        order_mode: orderMode,
        order_config: orderConfig as Prisma.InputJsonValue,
        is_available: createProductDto.is_available ?? true,
      },
    });

    await this.storeTenantProductCategory(tenantId, product.category);
    await this.bumpTenantSearchCacheVersion(tenantId);
    await this.storesDirectoryService.recalculateTenantReadiness(tenantId);
    return product;
  }

  /**
   * Creates a product by copying data from a catalog item.
   */
  async createFromCatalog(
    tenantId: number,
    payload: AddProductFromCatalogDto,
  ): Promise<Product> {
    const catalogSource = await this.resolveTenantCatalogSource(tenantId);
    if (!catalogSource) {
      throw new NotFoundException(
        `Catalog item with ID ${payload.catalog_item_id} not found`,
      );
    }

    const catalogItem = await this.getPrismaClient().catalogItem.findFirst({
      where: {
        id: payload.catalog_item_id,
        is_active: true,
        source: catalogSource,
      },
    });

    if (!catalogItem) {
      throw new NotFoundException(
        `Catalog item with ID ${payload.catalog_item_id} not found`,
      );
    }

    const catalogCategory = catalogItem.category?.trim();
    if (!catalogCategory) {
      throw new BadRequestException(
        `Catalog item with ID ${payload.catalog_item_id} has invalid category`,
      );
    }

    await this.ensureUniqueActiveProductName(tenantId, catalogItem.name);

    const product = await this.getPrismaClient().product.create({
      data: {
        tenant_id: tenantId,
        name: catalogItem.name,
        image_url: catalogItem.image_url,
        category: catalogCategory,
        source: ProductSource.CATALOG,
        status: ProductStatus.ACTIVE,
        current_price: catalogItem.price,
        order_mode: ProductOrderMode.QUANTITY,
        order_config: this.normalizeProductOrderConfig(
          ProductOrderMode.QUANTITY,
        ) as Prisma.InputJsonValue,
        is_available: true,
      },
    });

    await this.storeTenantProductCategory(tenantId, product.category);
    await this.bumpTenantSearchCacheVersion(tenantId);
    await this.storesDirectoryService.recalculateTenantReadiness(tenantId);
    return product;
  }

  /**
   * Returns all active products for the authenticated tenant.
   */
  async findAll(tenantId: number): Promise<Product[]> {
    return this.getPrismaClient().product.findMany({
      where: {
        tenant_id: tenantId,
        status: ProductStatus.ACTIVE,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  /**
   * Returns active products for tenant filtered by text search.
   */
  async searchTenantProducts(
    tenantId: number,
    search: string,
    category?: string,
    page = 1,
    limit = 20,
    options?: TenantProductsSearchOptions,
  ): Promise<TenantProductsSearchResult> {
    const normalizedSearch = this.normalizeSearchTerm(search);
    if (normalizedSearch.length < 2) {
      throw new BadRequestException(
        'Search term must be at least 2 characters',
      );
    }

    const normalizedPage = Number.isFinite(page) ? Math.max(1, page) : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(50, Math.max(1, limit))
      : 20;
    const normalizedCategory = this.normalizeOptionalCategory(category);
    const rankAll = options?.rankAll ?? false;
    const normalizedExcludedProductIds = this.normalizeExcludedProductIds(
      options?.excludeProductIds,
    );
    const similarityThreshold =
      this.resolveSimilarityThreshold(normalizedSearch);
    const strictMatchThresholds =
      this.resolveStrictMatchThresholds(normalizedSearch);

    const searchVersion = await this.getTenantSearchCacheVersion(tenantId);
    const cacheKey = this.buildTenantSearchCacheKey(
      tenantId,
      normalizedSearch,
      normalizedCategory,
      similarityThreshold,
      strictMatchThresholds,
      rankAll,
      normalizedExcludedProductIds,
      normalizedPage,
      normalizedLimit,
      searchVersion,
    );

    const cached =
      await this.cacheManager.get<TenantProductsSearchResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.searchWithinTenantProducts(
      tenantId,
      normalizedSearch,
      normalizedCategory,
      similarityThreshold,
      strictMatchThresholds,
      rankAll,
      normalizedExcludedProductIds,
      normalizedPage,
      normalizedLimit,
    );

    await this.cacheManager.set(
      cacheKey,
      result,
      PRODUCT_SEARCH_CACHE_TTL_SECONDS,
    );

    return result;
  }

  /**
   * Returns public active products for tenant slug filtered by text search.
   */
  async searchPublicProducts(
    slug: string,
    search: string,
    category?: string,
    page = 1,
    limit = 20,
  ): Promise<PublicProductsResult> {
    const normalizedSearch = this.normalizeSearchTerm(search);
    if (normalizedSearch.length < 2) {
      throw new BadRequestException(
        'Search term must be at least 2 characters',
      );
    }

    const normalizedPage = Number.isFinite(page) ? Math.max(1, page) : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(50, Math.max(1, limit))
      : 20;
    const normalizedCategory = this.normalizeOptionalCategory(category);
    const similarityThreshold =
      this.resolveSimilarityThreshold(normalizedSearch);
    const strictMatchThresholds =
      this.resolveStrictMatchThresholds(normalizedSearch);

    return this.searchWithinPublicProducts(
      slug,
      normalizedSearch,
      normalizedCategory,
      similarityThreshold,
      strictMatchThresholds,
      normalizedPage,
      normalizedLimit,
    );
  }

  /**
   * Returns all active products by public tenant slug.
   */
  async findAllByTenantSlug(
    slug: string,
    page = 1,
    limit = 20,
    category?: string,
  ): Promise<PublicProductsResult> {
    const normalizedPage = Number.isFinite(page) ? Math.max(1, page) : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(50, Math.max(1, limit))
      : 20;
    const normalizedCategory = category?.trim();

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
      tenant: {
        slug: slug,
      },
    };

    if (normalizedCategory) {
      where.category = normalizedCategory;
    }

    const [data, total] = await Promise.all([
      this.getPrismaClient().product.findMany({
        where,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit,
      }),
      this.getPrismaClient().product.count({ where }),
    ]);

    const lastPage = total > 0 ? Math.ceil(total / normalizedLimit) : 1;

    return {
      data,
      meta: {
        total,
        page: normalizedPage,
        limit: normalizedLimit,
        last_page: lastPage,
        has_next: normalizedPage < lastPage,
      },
    };
  }

  /**
   * Returns category summaries for a public tenant storefront.
   */
  async findPublicCategoriesByTenantSlug(
    slug: string,
  ): Promise<PublicProductCategorySummary[]> {
    const normalizedCategoryExpression = `COALESCE(NULLIF(TRIM(product.category), ''), '${DEFAULT_PRODUCT_CATEGORY}')`;

    const categoryQuery = `
      SELECT ${normalizedCategoryExpression} as category, COUNT(product.id)::int as count
      FROM products product
      INNER JOIN tenants tenant ON product.tenant_id = tenant.id
      WHERE tenant.slug = $1 AND product.status = $2
      GROUP BY ${normalizedCategoryExpression}
      ORDER BY category ASC
    `;

    const categoryRows = await this.getPrismaClient().$queryRawUnsafe<
      { category: string; count: number }[]
    >(categoryQuery, slug, ProductStatus.ACTIVE);

    if (categoryRows.length === 0) {
      return [];
    }

    const categories = categoryRows.map((row) => row.category);

    const catalogRows = await this.getPrismaClient().catalogItem.findMany({
      where: {
        is_active: true,
        category: { in: categories },
        image_url: { not: null, notIn: [''] },
      },
      select: {
        category: true,
        image_url: true,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    const categoryImages = new Map<string, string>();
    for (const row of catalogRows) {
      if (row.category && row.image_url && !categoryImages.has(row.category)) {
        categoryImages.set(row.category, row.image_url);
      }
    }

    return categoryRows.map((row) => ({
      category: row.category,
      count: Number(row.count),
      image_url: categoryImages.get(row.category),
    }));
  }

  /**
   * Returns active catalog categories for product onboarding.
   */
  async findCatalogCategories(
    tenantId: number,
  ): Promise<PublicProductCategorySummary[]> {
    const catalogSource = await this.resolveTenantCatalogSource(tenantId);
    if (!catalogSource) return [];

    const rows = await this.getPrismaClient().catalogItem.groupBy({
      by: ['category'],
      where: {
        is_active: true,
        source: catalogSource,
        category: buildAllowedCatalogCategoryWhere(catalogSource),
      },
      _count: { id: true },
      orderBy: { category: 'asc' },
    });

    const categories = rows
      .map((row) => this.normalizeOptionalCategory(row.category ?? undefined))
      .filter((category): category is string => Boolean(category));

    if (categories.length === 0) {
      return [];
    }

    const catalogRows = await this.getPrismaClient().catalogItem.findMany({
      where: {
        is_active: true,
        source: catalogSource,
        category: {
          in: categories.filter((category) =>
            isCatalogCategoryAllowedForSource(catalogSource, category),
          ),
        },
        image_url: { not: null },
      },
      select: {
        category: true,
        image_url: true,
      },
      orderBy: [{ category: 'asc' }, { id: 'asc' }],
    });

    const categoryImages = new Map<string, string>();
    for (const row of catalogRows) {
      if (row.category && row.image_url && !categoryImages.has(row.category)) {
        categoryImages.set(row.category, row.image_url);
      }
    }

    const summariesByCategory = new Map<string, PublicProductCategorySummary>();
    for (const row of rows) {
      const category = this.normalizeOptionalCategory(
        row.category ?? undefined,
      );
      if (!category) continue;

      const existingSummary = summariesByCategory.get(category);
      if (existingSummary) {
        existingSummary.count += row._count.id;
        if (!existingSummary.image_url) {
          existingSummary.image_url = categoryImages.get(category);
        }
        continue;
      }

      summariesByCategory.set(category, {
        category,
        count: row._count.id,
        image_url: categoryImages.get(category),
      });
    }

    return Array.from(summariesByCategory.values());
  }

  /**
   * Returns merged catalog + tenant categories for merchant onboarding.
   */
  async findTenantProductCategories(tenantId: number): Promise<string[]> {
    const catalogSource = await this.resolveTenantCatalogSource(tenantId);
    const [catalogRows, tenantRows] = await Promise.all([
      this.getPrismaClient().catalogItem.groupBy({
        by: ['category'],
        where: catalogSource
          ? {
              is_active: true,
              source: catalogSource,
              category: buildAllowedCatalogCategoryWhere(catalogSource),
            }
          : { id: -1 },
      }),
      this.getPrismaClient().tenantProductCategory.groupBy({
        by: ['name'],
        where: { tenant_id: tenantId },
      }),
    ]);

    const uniqueCategories = new Set<string>();
    for (const row of catalogRows) {
      const normalizedCategory = this.normalizeOptionalCategory(
        row.category ?? undefined,
      );
      if (normalizedCategory) uniqueCategories.add(normalizedCategory);
    }
    for (const row of tenantRows) {
      const normalizedCategory = this.normalizeOptionalCategory(row.name);
      if (normalizedCategory) uniqueCategories.add(normalizedCategory);
    }

    return Array.from(uniqueCategories).sort((left, right) =>
      left.localeCompare(right, 'ar'),
    );
  }

  /**
   * Returns active catalog items, optionally filtered by category.
   */
  async findCatalogItems(
    tenantId: number,
    search?: string,
    category?: string,
    page = 1,
    limit = 40,
  ): Promise<CatalogItemsResult> {
    const normalizedPage = Number.isFinite(page) ? Math.max(1, page) : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(100, Math.max(1, limit))
      : 40;
    const normalizedSearch = search ? this.normalizeSearchTerm(search) : '';
    const catalogSource = await this.resolveTenantCatalogSource(tenantId);
    if (!catalogSource) {
      return this.emptyCatalogItemsResult(normalizedPage, normalizedLimit);
    }

    const hiddenItems = await this.getPrismaClient().tenantHiddenCatalogItem.findMany({
      where: { tenant_id: tenantId },
      select: { catalog_item_id: true }
    });
    const hiddenItemIds = hiddenItems.map(h => h.catalog_item_id);

    if (normalizedSearch.length >= 2) {
      const normalizedCategory = this.normalizeOptionalCategory(category);
      const similarityThreshold =
        this.resolveSimilarityThreshold(normalizedSearch);
      const strictMatchThresholds =
        this.resolveStrictMatchThresholds(normalizedSearch);

      const cacheKey = this.buildCatalogSearchCacheKey(
        tenantId,
        normalizedSearch,
        normalizedCategory,
        catalogSource,
        similarityThreshold,
        strictMatchThresholds,
        normalizedPage,
        normalizedLimit,
      );

      const cached = await this.cacheManager.get<CatalogItemsResult>(cacheKey);
      if (cached) {
        return cached;
      }

      const result = await this.searchWithinCatalogItems(
        tenantId,
        normalizedSearch,
        normalizedCategory,
        catalogSource,
        similarityThreshold,
        strictMatchThresholds,
        normalizedPage,
        normalizedLimit,
      );

      await this.cacheManager.set(
        cacheKey,
        result,
        PRODUCT_SEARCH_CACHE_TTL_SECONDS,
      );

      return result;
    }

    const where: Prisma.CatalogItemWhereInput = {
      is_active: true,
      source: catalogSource,
      category: buildAllowedCatalogCategoryWhere(catalogSource),
    };
    
    if (hiddenItemIds.length > 0) {
      where.id = { notIn: hiddenItemIds };
    }

    if (category) {
      where.category = isCatalogCategoryAllowedForSource(
        catalogSource,
        category,
      )
        ? category
        : { in: [] };
    }

    const [data, total] = await Promise.all([
      this.getPrismaClient().catalogItem.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit,
      }),
      this.getPrismaClient().catalogItem.count({ where }),
    ]);

    const lastPage = total > 0 ? Math.ceil(total / normalizedLimit) : 1;

    return {
      data,
      meta: {
        total,
        page: normalizedPage,
        limit: normalizedLimit,
        last_page: lastPage,
        has_next: normalizedPage < lastPage,
      },
    };
  }

  /**
   * Hides a catalog item from a tenant's view.
   */
  async hideCatalogItem(tenantId: number, catalogItemId: number): Promise<void> {
    await this.getPrismaClient().tenantHiddenCatalogItem.upsert({
      where: {
        tenant_id_catalog_item_id: {
          tenant_id: tenantId,
          catalog_item_id: catalogItemId,
        },
      },
      create: {
        tenant_id: tenantId,
        catalog_item_id: catalogItemId,
      },
      update: {},
    });
  }

  /**
   * Unhides a catalog item for a tenant.
   */
  async unhideCatalogItem(tenantId: number, catalogItemId: number): Promise<void> {
    try {
      await this.getPrismaClient().tenantHiddenCatalogItem.delete({
        where: {
          tenant_id_catalog_item_id: {
            tenant_id: tenantId,
            catalog_item_id: catalogItemId,
          },
        },
      });
    } catch (error) {
      // Ignore if it's already deleted/doesn't exist
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return;
      }
      throw error;
    }
  }

  /**
   * Returns hidden catalog items for the tenant.
   */
  async findHiddenCatalogItems(
    tenantId: number,
    page = 1,
    limit = 40,
  ): Promise<CatalogItemsResult> {
    const normalizedPage = Number.isFinite(page) ? Math.max(1, page) : 1;
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(100, Math.max(1, limit))
      : 40;

    const catalogSource = await this.resolveTenantCatalogSource(tenantId);
    if (!catalogSource) {
      return this.emptyCatalogItemsResult(normalizedPage, normalizedLimit);
    }

    const where: Prisma.CatalogItemWhereInput = {
      tenant_hidden_catalog_items: {
        some: { tenant_id: tenantId },
      },
    };

    const [data, total] = await Promise.all([
      this.getPrismaClient().catalogItem.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit,
      }),
      this.getPrismaClient().catalogItem.count({ where }),
    ]);

    const lastPage = total > 0 ? Math.ceil(total / normalizedLimit) : 1;

    return {
      data,
      meta: {
        total,
        page: normalizedPage,
        limit: normalizedLimit,
        last_page: lastPage,
        has_next: normalizedPage < lastPage,
      },
    };
  }

  /**
   * Returns a single product owned by tenant.
   */
  async findOne(id: number, tenantId: number): Promise<Product> {
    const product = await this.getPrismaClient().product.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  /**
   * Updates product fields for tenant-owned product.
   */
  async update(
    id: number,
    tenantId: number,
    updateProductDto: UpdateProductDto,
    file?: Express.Multer.File,
  ): Promise<Product> {
    const product = await this.findOne(id, tenantId);

    const previousImageUrl = product.image_url;
    const updateData: Prisma.ProductUpdateInput = {};

    if (typeof updateProductDto.name === 'string') {
      const normalizedName = updateProductDto.name.trim();
      if (!normalizedName) {
        throw new BadRequestException('Product name is required');
      }

      await this.ensureUniqueActiveProductName(tenantId, normalizedName, id);
      updateData.name = normalizedName;
    }

    if (updateProductDto.status) {
      updateData.status = updateProductDto.status;
    }

    if (updateProductDto.is_available !== undefined) {
      updateData.is_available = updateProductDto.is_available;
    }

    if (typeof updateProductDto.category === 'string') {
      updateData.category = this.normalizeCategory(updateProductDto.category);
    }

    if (typeof updateProductDto.current_price === 'number') {
      updateData.current_price = this.normalizeCurrentPrice(
        updateProductDto.current_price,
      );
    }

    if (
      updateProductDto.order_mode !== undefined ||
      updateProductDto.order_config !== undefined
    ) {
      const nextOrderMode = this.resolveProductOrderMode(
        updateProductDto.order_mode ?? (product.order_mode as ProductOrderMode),
      );
      updateData.order_mode = nextOrderMode;
      updateData.order_config = this.normalizeProductOrderConfig(
        nextOrderMode,
        updateProductDto.order_config ??
          (product.order_config as Record<string, unknown>) ??
          undefined,
      ) as Prisma.InputJsonValue;
    }

    if (file?.path) {
      updateData.image_url =
        await this.imageProcessorService.processProductThumbnail(file.path);
    } else if (typeof updateProductDto.image_url === 'string') {
      const normalizedImageUrl = updateProductDto.image_url.trim();
      updateData.image_url = normalizedImageUrl || null;
    }

    const updatedProduct = await this.getPrismaClient().product.update({
      where: { id },
      data: updateData,
    });

    if (typeof updateProductDto.category === 'string') {
      await this.storeTenantProductCategory(tenantId, updatedProduct.category);
    }
    await this.bumpTenantSearchCacheVersion(tenantId);
    await this.storesDirectoryService.recalculateTenantReadiness(tenantId);

    if (previousImageUrl && previousImageUrl !== updatedProduct.image_url) {
      await this.imageProcessorService.deleteManagedProductImage(
        previousImageUrl,
      );
    }

    return updatedProduct;
  }

  /**
   * Soft archives a product so historical order records stay intact.
   */
  async remove(id: number, tenantId: number): Promise<void> {
    await this.findOne(id, tenantId);
    await this.getPrismaClient().product.update({
      where: { id },
      data: { status: ProductStatus.ARCHIVED },
    });
    await this.bumpTenantSearchCacheVersion(tenantId);
    await this.storesDirectoryService.recalculateTenantReadiness(tenantId);
  }

  private async searchWithinTenantProducts(
    tenantId: number,
    normalizedSearch: string,
    category: string | undefined,
    similarityThreshold: number,
    strictMatchThresholds: StrictMatchThresholds,
    rankAll: boolean,
    excludedProductIds: number[],
    page: number,
    limit: number,
  ): Promise<TenantProductsSearchResult> {
    const useCategoryAsFilter = rankAll && !!category;
    const useCategoryAsBoost = !rankAll && !!category;

    const prefixPattern = `${normalizedSearch}%`;
    const containsPattern = `%${normalizedSearch}%`;

    const conditions: string[] = [];
    const params: any[] = [];

    const addParam = (val: any) => {
      params.push(val);
      return `$${params.length}`;
    };

    conditions.push(`tenant_id = ${addParam(tenantId)}`);
    conditions.push(`status = ${addParam(ProductStatus.ACTIVE)}`);

    if (useCategoryAsFilter) {
      conditions.push(`category = ${addParam(category)}`);
    }

    if (excludedProductIds.length > 0) {
      conditions.push(
        `id NOT IN (${excludedProductIds.map((id) => addParam(id)).join(', ')})`,
      );
    }

    const searchParam = addParam(normalizedSearch);
    const prefixParam = addParam(prefixPattern);
    const containsParam = addParam(containsPattern);
    const searchTextParam = `${searchParam}::text`;
    const prefixTextParam = `${prefixParam}::text`;
    const containsTextParam = `${containsParam}::text`;

    const comparableNameSql = this.buildComparableProductNameExpression('name');

    let rankSql = `(word_similarity(${comparableNameSql}, ${searchTextParam}) * 0.55) + (similarity(${comparableNameSql}, ${searchTextParam}) * 0.30) + (CASE WHEN ${comparableNameSql} LIKE ${prefixTextParam} THEN 1 ELSE 0 END) * 0.15`;

    if (!rankAll) {
      const strictSimParam = addParam(
        strictMatchThresholds.strictSimilarityThreshold,
      );
      const strictWordSimParam = addParam(
        strictMatchThresholds.strictWordSimilarityThreshold,
      );

      conditions.push(`(
        ${comparableNameSql} LIKE ${prefixTextParam}
        OR ${comparableNameSql} LIKE ${containsTextParam}
        OR (
          similarity(${comparableNameSql}, ${searchTextParam}) >= ${strictSimParam}::double precision
          AND word_similarity(${comparableNameSql}, ${searchTextParam}) >= ${strictWordSimParam}::double precision
        )
      )`);
    }

    if (useCategoryAsBoost) {
      const catParam = addParam(category);
      rankSql = `(word_similarity(${comparableNameSql}, ${searchTextParam}) * 0.50) + (similarity(${comparableNameSql}, ${searchTextParam}) * 0.25) + (CASE WHEN ${comparableNameSql} LIKE ${prefixTextParam} THEN 1 ELSE 0 END) * 0.15 + (CASE WHEN category = ${catParam}::text THEN 0.10 ELSE 0 END)`;
    }

    const whereClause = conditions.join(' AND ');

    const limitParam = addParam(limit);
    const offsetParam = addParam((page - 1) * limit);

    const dataQuery = `
      SELECT *, 
        ${rankSql} as search_rank,
        word_similarity(${comparableNameSql}, ${searchTextParam}) as word_sim,
        similarity(${comparableNameSql}, ${searchTextParam}) as name_similarity,
        CASE WHEN ${comparableNameSql} LIKE ${containsTextParam} THEN 1 ELSE 0 END as contains_score
      FROM products
      WHERE ${whereClause}
      ORDER BY search_rank DESC, word_sim DESC, name_similarity DESC, contains_score DESC, created_at DESC, id DESC
      LIMIT ${limitParam}::int OFFSET ${offsetParam}::int
    `;

    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM products
      WHERE ${whereClause}
    `;

    const data = await this.getPrismaClient().$queryRawUnsafe<Product[]>(
      dataQuery,
      ...params,
    );
    const countResult = await this.getPrismaClient().$queryRawUnsafe<
      { total: number }[]
    >(countQuery, ...this.getReferencedRawQueryParams(countQuery, params));
    const total = countResult[0]?.total || 0;

    return this.buildSearchResult(data, total, page, limit);
  }

  private async searchWithinPublicProducts(
    slug: string,
    normalizedSearch: string,
    category: string | undefined,
    similarityThreshold: number,
    strictMatchThresholds: StrictMatchThresholds,
    page: number,
    limit: number,
  ): Promise<PublicProductsResult> {
    const conditions: string[] = [];
    const params: any[] = [];
    const addParam = (val: any) => {
      params.push(val);
      return `$${params.length}`;
    };

    const slugParam = addParam(slug);
    conditions.push(`tenant.slug = ${slugParam}`);
    conditions.push(`product.status = ${addParam(ProductStatus.ACTIVE)}`);

    if (category) {
      conditions.push(`product.category = ${addParam(category)}`);
    }

    const searchParam = addParam(normalizedSearch);
    const prefixParam = addParam(`${normalizedSearch}%`);
    const containsParam = addParam(`%${normalizedSearch}%`);
    const strictSimParam = addParam(
      strictMatchThresholds.strictSimilarityThreshold,
    );
    const strictWordSimParam = addParam(
      strictMatchThresholds.strictWordSimilarityThreshold,
    );

    const comparableNameSql =
      this.buildComparableProductNameExpression('product.name');

    const rankSql = `(word_similarity(${comparableNameSql}, ${searchParam}) * 0.55) + (similarity(${comparableNameSql}, ${searchParam}) * 0.30) + (CASE WHEN ${comparableNameSql} LIKE ${prefixParam} THEN 1 ELSE 0 END) * 0.15`;

    conditions.push(`(
      ${comparableNameSql} LIKE ${prefixParam}
      OR ${comparableNameSql} LIKE ${containsParam}
      OR (
        similarity(${comparableNameSql}, ${searchParam}) >= ${strictSimParam}
        AND word_similarity(${comparableNameSql}, ${searchParam}) >= ${strictWordSimParam}
      )
    )`);

    const whereClause = conditions.join(' AND ');

    const limitParam = addParam(limit);
    const offsetParam = addParam((page - 1) * limit);

    const dataQuery = `
      SELECT product.*, 
        ${rankSql} as search_rank,
        word_similarity(${comparableNameSql}, ${searchParam}) as word_sim,
        similarity(${comparableNameSql}, ${searchParam}) as name_similarity,
        CASE WHEN ${comparableNameSql} LIKE ${containsParam} THEN 1 ELSE 0 END as contains_score
      FROM products product
      INNER JOIN tenants tenant ON product.tenant_id = tenant.id
      WHERE ${whereClause}
      ORDER BY search_rank DESC, word_sim DESC, name_similarity DESC, contains_score DESC, product.created_at DESC, product.id DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM products product
      INNER JOIN tenants tenant ON product.tenant_id = tenant.id
      WHERE ${whereClause}
    `;

    const data = await this.getPrismaClient().$queryRawUnsafe<Product[]>(
      dataQuery,
      ...params,
    );
    const countResult = await this.getPrismaClient().$queryRawUnsafe<
      { total: number }[]
    >(countQuery, ...this.getReferencedRawQueryParams(countQuery, params));
    const total = countResult[0]?.total || 0;

    return this.buildSearchResult(data, total, page, limit);
  }

  private buildSearchResult(
    data: Product[],
    total: number,
    page: number,
    limit: number,
  ): TenantProductsSearchResult {
    const lastPage = total > 0 ? Math.ceil(total / limit) : 1;

    return {
      data,
      meta: {
        total,
        page,
        limit,
        last_page: lastPage,
        has_next: page < lastPage,
      },
    };
  }

  private getReferencedRawQueryParams(query: string, params: any[]): any[] {
    const matches = Array.from(query.matchAll(/\$(\d+)/g));
    const highestParamIndex = matches.reduce((highest, match) => {
      const index = Number(match[1]);
      return Number.isFinite(index) && index > highest ? index : highest;
    }, 0);

    return params.slice(0, highestParamIndex);
  }

  private normalizeCategory(category?: string): string {
    const normalizedCategory = category?.trim();
    if (!normalizedCategory) {
      return DEFAULT_PRODUCT_CATEGORY;
    }

    return normalizedCategory.slice(0, 64);
  }

  /**
   * Enforces tenant-level uniqueness for active products using normalized names.
   */
  private async ensureUniqueActiveProductName(
    tenantId: number,
    name: string,
    excludedProductId?: number,
  ): Promise<void> {
    const normalizedName = this.normalizeProductName(name);
    if (!normalizedName) {
      return;
    }

    const conditions: string[] = [
      `tenant_id = $1`,
      `status = $2`,
      `LOWER(REGEXP_REPLACE(TRIM(name), '\\s+', ' ', 'g')) = $3`,
    ];
    const params: any[] = [tenantId, ProductStatus.ACTIVE, normalizedName];

    if (excludedProductId) {
      params.push(excludedProductId);
      conditions.push(`id != $4`);
    }

    const query = `
      SELECT COUNT(*)::int as count
      FROM products
      WHERE ${conditions.join(' AND ')}
    `;

    const result = await this.getPrismaClient().$queryRawUnsafe<
      { count: number }[]
    >(query, ...params);
    const duplicateCount = result[0]?.count || 0;

    if (duplicateCount > 0) {
      throw new ConflictException(DUPLICATE_PRODUCT_NAME_MESSAGE);
    }
  }

  private normalizeProductName(name: string): string {
    return name.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private normalizeSearchTerm(search: string): string {
    return this.normalizeArabic(search);
  }

  private resolveSimilarityThreshold(normalizedSearch: string): number {
    const length = normalizedSearch.length;
    if (length <= 3) {
      return 0.08;
    }

    if (length <= 5) {
      return 0.14;
    }

    return 0.22;
  }

  private resolveStrictMatchThresholds(
    normalizedSearch: string,
  ): StrictMatchThresholds {
    const length = normalizedSearch.length;
    if (length <= 3) {
      return {
        strictSimilarityThreshold: 0.32,
        strictWordSimilarityThreshold: 0.58,
      };
    }

    if (length <= 5) {
      return {
        strictSimilarityThreshold: 0.28,
        strictWordSimilarityThreshold: 0.5,
      };
    }

    return {
      strictSimilarityThreshold: 0.24,
      strictWordSimilarityThreshold: 0.42,
    };
  }

  private normalizeOptionalCategory(category?: string): string | undefined {
    const normalizedCategory = category?.trim();
    if (!normalizedCategory) {
      return undefined;
    }

    return normalizedCategory.slice(0, 64);
  }

  private normalizeArabic(input: string): string {
    return (
      input
        .toLowerCase()
        // Strip Arabic diacritics (tashkeel/harakat)
        .replace(
          /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g,
          '',
        )
        .replace(/[أإآ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        // eslint-disable-next-line sonarjs/slow-regex -- false positive: negated char class [^)]* is O(n)
        .replace(/\([^)]*\)/g, ' ')
        // eslint-disable-next-line sonarjs/slow-regex
        .replace(/\d+\s*(?:جم|جرام|كجم|كيلو|ك|g|kg)/gi, ' ')
        .replace(/(?:جم|جرام|كجم|كيلو|ك|g|kg)\s*\d+/gi, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        // Strip Arabic definite article "ال" at word boundaries
        .replace(/\bال/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  private buildComparableProductNameExpression(columnName: string): string {
    return `
      BTRIM(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                REGEXP_REPLACE(
                  REGEXP_REPLACE(
                    REGEXP_REPLACE(
                      REGEXP_REPLACE(
                        LOWER(${columnName}),
                        '[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]',
                        '',
                        'g'
                      ),
                      '[أإآ]',
                      'ا',
                      'g'
                    ),
                    'ى',
                    'ي',
                    'g'
                  ),
                  'ة',
                  'ه',
                  'g'
                ),
                '\\\\([^\\\\)]*\\\\)',
                ' ',
                'g'
              ),
              '(\\\\m\\\\d+\\\\s*(جم|جرام|كجم|كيلو|ك|g|kg)\\\\M)|(\\\\m(جم|جرام|كجم|كيلو|ك|g|kg)\\\\s*\\\\d+\\\\M)',
              ' ',
              'gi'
            ),
            '\\mال',
            '',
            'g'
          ),
          '\\\\s+',
          ' ',
          'g'
        )
      )
    `;
  }

  private normalizeCurrentPrice(price: number): number {
    if (!Number.isFinite(price) || price <= 0) {
      throw new BadRequestException('Product price must be a positive number');
    }

    return Number(price.toFixed(2));
  }

  private resolveProductOrderMode(mode?: ProductOrderMode): ProductOrderMode {
    if (!mode) {
      return ProductOrderMode.QUANTITY;
    }

    return mode;
  }

  private normalizeProductOrderConfig(
    mode: ProductOrderMode,
    rawConfig?: unknown,
  ): ProductOrderConfig {
    const config =
      rawConfig && typeof rawConfig === 'object'
        ? (rawConfig as Record<string, unknown>)
        : {};

    switch (mode) {
      case ProductOrderMode.WEIGHT:
        return this.normalizeWeightOrderConfig(config.weight);
      case ProductOrderMode.PRICE:
        return this.normalizePriceOrderConfig(config.price);
      case ProductOrderMode.QUANTITY:
      default:
        return this.normalizeQuantityOrderConfig(config.quantity);
    }
  }

  private normalizeQuantityOrderConfig(rawValue: unknown): ProductOrderConfig {
    const quantityConfig =
      rawValue && typeof rawValue === 'object'
        ? (rawValue as Record<string, unknown>)
        : {};

    const unitLabel = this.normalizeOptionalText(quantityConfig.unit_label, 32);
    const unitOptions = this.normalizeQuantityUnitOptions(
      quantityConfig.unit_options,
    );

    return {
      quantity: {
        unit_label: unitLabel || DEFAULT_QUANTITY_UNIT_LABEL,
        ...(unitOptions.length > 0 ? { unit_options: unitOptions } : {}),
      },
    };
  }

  private normalizeWeightOrderConfig(rawValue: unknown): ProductOrderConfig {
    const weightConfig =
      rawValue && typeof rawValue === 'object'
        ? (rawValue as Record<string, unknown>)
        : {};

    const presetGrams = this.normalizeNumericPresets(
      weightConfig.preset_grams,
      DEFAULT_WEIGHT_PRESET_GRAMS,
    );
    const allowCustomGrams =
      typeof weightConfig.allow_custom_grams === 'boolean'
        ? weightConfig.allow_custom_grams
        : true;

    return {
      weight: {
        preset_grams: presetGrams,
        allow_custom_grams: allowCustomGrams,
      },
    };
  }

  private normalizePriceOrderConfig(rawValue: unknown): ProductOrderConfig {
    const priceConfig =
      rawValue && typeof rawValue === 'object'
        ? (rawValue as Record<string, unknown>)
        : {};

    const presetAmounts = this.normalizeNumericPresets(
      priceConfig.preset_amounts_egp,
      DEFAULT_PRICE_PRESET_AMOUNTS,
    );
    const allowCustomAmount =
      typeof priceConfig.allow_custom_amount === 'boolean'
        ? priceConfig.allow_custom_amount
        : true;

    return {
      price: {
        preset_amounts_egp: presetAmounts,
        allow_custom_amount: allowCustomAmount,
      },
    };
  }

  private normalizeNumericPresets(
    rawValue: unknown,
    fallback: readonly number[],
  ): number[] {
    if (!Array.isArray(rawValue)) {
      return [...fallback];
    }

    const uniquePresets = new Set<number>();
    for (const value of rawValue) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        continue;
      }

      uniquePresets.add(Math.round(parsed));

      if (uniquePresets.size >= MAX_ORDER_PRESETS) {
        break;
      }
    }

    if (uniquePresets.size === 0) {
      return [...fallback];
    }

    return Array.from(uniquePresets).sort((left, right) => left - right);
  }

  private normalizeQuantityUnitOptions(
    rawValue: unknown,
  ): QuantityUnitOptionConfig[] {
    if (!Array.isArray(rawValue)) {
      return [];
    }

    const normalizedOptions: QuantityUnitOptionConfig[] = [];
    const optionIds = new Set<string>();

    for (const option of rawValue) {
      if (!option || typeof option !== 'object') {
        continue;
      }

      const optionRecord = option as Record<string, unknown>;
      const label = this.normalizeOptionalText(optionRecord.label, 64);
      const multiplier = Number(optionRecord.multiplier);
      if (!label || !Number.isFinite(multiplier) || multiplier <= 0) {
        continue;
      }

      const providedId = this.normalizeOptionalText(optionRecord.id, 64);
      const candidateId = providedId || `unit_${normalizedOptions.length + 1}`;
      if (optionIds.has(candidateId)) {
        continue;
      }

      optionIds.add(candidateId);
      normalizedOptions.push({
        id: candidateId,
        label,
        multiplier: Number(multiplier.toFixed(3)),
      });

      if (normalizedOptions.length >= MAX_ORDER_PRESETS) {
        break;
      }
    }

    return normalizedOptions;
  }

  private normalizeOptionalText(value: unknown, maxLength: number): string {
    if (typeof value !== 'string') {
      return '';
    }

    const normalized = value.trim();
    if (!normalized) {
      return '';
    }

    return normalized.slice(0, maxLength);
  }

  private async storeTenantProductCategory(
    tenantId: number,
    category: string | undefined,
  ): Promise<void> {
    const normalizedCategory = this.normalizeOptionalCategory(category);
    if (!normalizedCategory) {
      return;
    }

    await this.getPrismaClient().$executeRaw`
      INSERT INTO tenant_product_categories (tenant_id, name)
      VALUES (${tenantId}, ${normalizedCategory})
      ON CONFLICT DO NOTHING
    `;
  }

  private getTenantSearchCacheVersionKey(tenantId: number): string {
    return `merchant:products:search:version:${tenantId}`;
  }

  private buildTenantSearchCacheKey(
    tenantId: number,
    normalizedSearch: string,
    category: string | undefined,
    similarityThreshold: number,
    strictMatchThresholds: StrictMatchThresholds,
    rankAll: boolean,
    excludedProductIds: number[],
    page: number,
    limit: number,
    version: string,
  ): string {
    const normalizedCategory = category || 'all';
    const normalizedExcludedIds =
      excludedProductIds.length > 0 ? excludedProductIds.join(',') : 'none';
    const rankingMode = rankAll ? 'rank_all' : 'strict';
    return `merchant:products:search:${tenantId}:${version}:${normalizedCategory}:${normalizedSearch}:${similarityThreshold}:${strictMatchThresholds.strictSimilarityThreshold}:${strictMatchThresholds.strictWordSimilarityThreshold}:${rankingMode}:${normalizedExcludedIds}:${page}:${limit}`;
  }

  private buildCatalogSearchCacheKey(
    tenantId: number,
    normalizedSearch: string,
    category: string | undefined,
    source: CatalogSource,
    similarityThreshold: number,
    strictMatchThresholds: StrictMatchThresholds,
    page: number,
    limit: number,
  ): string {
    const normalizedCategory = category || 'all';
    return `catalog:search:tenant:${tenantId}:${source}:${normalizedCategory}:${normalizedSearch}:${similarityThreshold}:${strictMatchThresholds.strictSimilarityThreshold}:${strictMatchThresholds.strictWordSimilarityThreshold}:${page}:${limit}`;
  }

  private async searchWithinCatalogItems(
    tenantId: number,
    normalizedSearch: string,
    category: string | undefined,
    source: CatalogSource,
    similarityThreshold: number,
    strictMatchThresholds: StrictMatchThresholds,
    page: number,
    limit: number,
  ): Promise<CatalogItemsResult> {
    const prefixPattern = `${normalizedSearch}%`;
    const containsPattern = `%${normalizedSearch}%`;

    const conditions: string[] = [];
    const params: any[] = [];

    const addParam = (val: any) => {
      params.push(val);
      return `$${params.length}`;
    };

    conditions.push(`is_active = true`);
    conditions.push(`source = ${addParam(source)}`);
    conditions.push(`id NOT IN (SELECT catalog_item_id FROM tenant_hidden_catalog_items WHERE tenant_id = ${addParam(tenantId)})`);

    const allowedCategories = getAllowedCatalogCategoriesForSource(source);
    if (allowedCategories.length > 0) {
      conditions.push(`category = ANY(${addParam(allowedCategories)}::text[])`);
    }

    if (category) {
      conditions.push(
        isCatalogCategoryAllowedForSource(source, category)
          ? `category = ${addParam(category)}`
          : 'false',
      );
    }

    const searchParam = addParam(normalizedSearch);
    const prefixParam = addParam(prefixPattern);
    const containsParam = addParam(containsPattern);
    const searchTextParam = `${searchParam}::text`;
    const prefixTextParam = `${prefixParam}::text`;
    const containsTextParam = `${containsParam}::text`;

    const comparableNameSql = this.buildComparableProductNameExpression('name');

    const rankSql = `(word_similarity(${comparableNameSql}, ${searchTextParam}) * 0.55) + (similarity(${comparableNameSql}, ${searchTextParam}) * 0.30) + (CASE WHEN ${comparableNameSql} LIKE ${prefixTextParam} THEN 1 ELSE 0 END) * 0.15`;

    const strictSimParam = addParam(
      strictMatchThresholds.strictSimilarityThreshold,
    );
    const strictWordSimParam = addParam(
      strictMatchThresholds.strictWordSimilarityThreshold,
    );

    conditions.push(`(
      ${comparableNameSql} LIKE ${prefixTextParam}
      OR ${comparableNameSql} LIKE ${containsTextParam}
      OR (
        similarity(${comparableNameSql}, ${searchTextParam}) >= ${strictSimParam}::double precision
        AND word_similarity(${comparableNameSql}, ${searchTextParam}) >= ${strictWordSimParam}::double precision
      )
    )`);

    const whereClause = conditions.join(' AND ');

    const limitParam = addParam(limit);
    const offsetParam = addParam((page - 1) * limit);

    const dataQuery = `
      SELECT *, 
        ${rankSql} as search_rank,
        word_similarity(${comparableNameSql}, ${searchTextParam}) as word_sim,
        similarity(${comparableNameSql}, ${searchTextParam}) as name_similarity,
        CASE WHEN ${comparableNameSql} LIKE ${containsTextParam} THEN 1 ELSE 0 END as contains_score
      FROM catalog_items
      WHERE ${whereClause}
      ORDER BY search_rank DESC, word_sim DESC, name_similarity DESC, contains_score DESC, created_at DESC, id DESC
      LIMIT ${limitParam}::int OFFSET ${offsetParam}::int
    `;

    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM catalog_items
      WHERE ${whereClause}
    `;

    const data = await this.getPrismaClient().$queryRawUnsafe<CatalogItem[]>(
      dataQuery,
      ...params,
    );
    const countResult = await this.getPrismaClient().$queryRawUnsafe<
      { total: number }[]
    >(countQuery, ...this.getReferencedRawQueryParams(countQuery, params));
    const total = countResult[0]?.total || 0;

    const lastPage = total > 0 ? Math.ceil(total / limit) : 1;

    return {
      data,
      meta: {
        total,
        page,
        limit,
        last_page: lastPage,
        has_next: page < lastPage,
      },
    };
  }

  private normalizeExcludedProductIds(rawIds?: number[]): number[] {
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return [];
    }

    return Array.from(
      new Set(
        rawIds.filter(
          (id): id is number =>
            Number.isInteger(id) && Number.isFinite(id) && id > 0,
        ),
      ),
    ).sort((left, right) => left - right);
  }

  private async getTenantSearchCacheVersion(tenantId: number): Promise<string> {
    const versionKey = this.getTenantSearchCacheVersionKey(tenantId);
    const cachedVersion = await this.cacheManager.get<string>(versionKey);
    if (cachedVersion) {
      return cachedVersion;
    }

    const initialVersion = Date.now().toString();
    await this.cacheManager.set(versionKey, initialVersion);
    return initialVersion;
  }

  private async bumpTenantSearchCacheVersion(tenantId: number): Promise<void> {
    const versionKey = this.getTenantSearchCacheVersionKey(tenantId);
    await this.cacheManager.set(versionKey, Date.now().toString());
  }
}
