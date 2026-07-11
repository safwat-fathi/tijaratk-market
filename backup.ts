import {
  Inject,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { ProductSource } from 'src/common/enums/product-source.enum';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { OrderStatus } from 'src/common/enums/order-status.enum';
import { AddProductFromCatalogDto } from './dto/add-product-from-catalog.dto';
import { AddBulkEssentialItemsDto } from './dto/add-bulk-essential.dto';
import { BulkUpdateProductsDto } from './dto/bulk-update-products.dto';
import { ImageProcessorService } from 'src/common/services/image-processor.service';
import { DbTenantContext } from 'src/common/contexts/db-tenant.context';
import { ProductOrderMode } from 'src/common/enums/product-order-mode.enum';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StoresDirectoryService } from 'src/stores-directory/stores-directory.service';
import {
  Prisma,
  Product,
  CatalogItem,
  TenantCategory,
  TenantStatus,
} from '../../generated/prisma/client';
import {
  CATALOG_SOURCE_CHEFAA,
  CATALOG_SOURCE_TALABAT,
  CatalogSource,
  getAllowedCatalogCategoriesForSource,
  isCatalogCategoryAllowedForSource,
  resolveCatalogSourceForTenantCategory,
} from './catalog-source-policy';
import { arabicNormalize } from './utils/arabic-normalize.util';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { ActivityActions } from 'src/activity-log/constants/activity-actions';
import {
  ActivityEntityTypes,
  ActivitySources,
} from 'src/activity-log/constants/activity-types';
import { PRODUCT_STATUS_LABELS_AR } from 'src/activity-log/constants/activity-labels';
import { pickChangedFields } from 'src/activity-log/utils/activity-diff.util';

const DEFAULT_PRODUCT_CATEGORY = 'أخرى';
const DUPLICATE_PRODUCT_NAME_MESSAGE = 'Product with this name already exists';
const PRODUCT_SEARCH_CACHE_TTL_SECONDS = 60;
const DEFAULT_WEIGHT_PRESET_GRAMS = [250, 500, 1000] as const;
const DEFAULT_PRICE_PRESET_AMOUNTS = [100, 200, 300] as const;
const DEFAULT_QUANTITY_UNIT_LABEL = 'قطعة';
const DEFAULT_PHARMACY_QUANTITY_UNIT_LABEL = 'علبة';
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

type DeleteTenantProductsAsAdminResult = {
  totalCount: number;
  deletedCount: number;
  skippedCount: number;
  skippedReasons: Array<{
    reason: 'active_order_reference';
    count: number;
  }>;
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
  image_url?: string | null;
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
  data: (CatalogItem & { is_in_stock?: boolean })[];
  meta: {
    total: number;
    page: number;
    limit: number;
    last_page: number;
    has_next: boolean;
  };
};

type BulkEssentialStage = {
  category: string;
  total: number;
  default_selected_catalog_item_ids: number[];
  items: (CatalogItem & { is_in_stock?: boolean })[];
};

type TenantProductsSearchOptions = {
  rankAll?: boolean;
  excludeProductIds?: number[];
  status?: ProductStatus;
};

type BulkUpdateProductsPayload = {
  ids: number[];
  category?: string;
  is_available?: boolean;
  status?: ProductStatus;
};

type StrictMatchThresholds = {
  strictSimilarityThreshold: number;
  strictWordSimilarityThreshold: number;
};

type ProductActivityActor = {
  userId?: number | null;
  adminId?: number | null;
  source: 'dashboard' | 'admin' | 'csv_import';
};

/**
 * Products service handles product lifecycle for each tenant.
 */
@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imageProcessorService: ImageProcessorService,
    private readonly storesDirectoryService: StoresDirectoryService,
    private readonly activityLogService: ActivityLogService,
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
    actor?: ProductActivityActor,
  ): Promise<Product> {
    const normalizedName = createProductDto.name.trim();
    if (!normalizedName) {
      throw new BadRequestException('Product name is required');
    }

    await this.ensureUniqueActiveProductName(tenantId, normalizedName);

    const defaultUnitLabel =
      await this.resolveDefaultQuantityUnitLabel(tenantId);

    const orderMode = this.resolveProductOrderMode(createProductDto.order_mode);
    const orderConfig = this.normalizeProductOrderConfig(
      orderMode,
      createProductDto.order_config,
      defaultUnitLabel,
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
    await this.bumpCatalogSearchCacheVersion(tenantId);
    await this.storesDirectoryService.recalculateTenantReadiness(tenantId);

    if (actor) {
      await this.activityLogService.create({
        tenantId,
        actorUserId: actor.userId ?? null,
        actorAdminId: actor.adminId ?? null,
        entityType: ActivityEntityTypes.Product,
        entityId: product.id,
        action: ActivityActions.ProductCreated,
        title: 'تم إضافة منتج جديد',
        description: `تم إضافة المنتج ${product.name}`,
        newValues: {
          name: product.name,
          category: product.category,
          current_price: this.toActivityNumber(product.current_price),
          is_available: product.is_available,
          status: product.status,
        },
        metadata: {
          source: product.source,
          image_changed: Boolean(product.image_url),
        },
        source: this.resolveProductActivitySource(actor),
      });
    }
    return product;
  }

  async createForTenantAsAdmin(
    tenantId: number,
    createProductDto: CreateProductDto,
    file?: Express.Multer.File,
  ): Promise<Product> {
    return this.runAsTenantForAdmin(tenantId, () =>
      this.create(tenantId, createProductDto, file),
    );
  }

  async createFromCatalogForTenantAsAdmin(
    tenantId: number,
    payload: AddProductFromCatalogDto,
  ): Promise<Product> {
    return this.runAsTenantForAdmin(tenantId, () =>
      this.createFromCatalog(tenantId, payload),
    );
  }

  async findAllForTenantAsAdmin(
    tenantId: number,
    status?: ProductStatus,
  ): Promise<Product[]> {
    return this.runAsTenantForAdmin(tenantId, () =>
      this.findAll(tenantId, status),
    );
  }

  async searchTenantProductsForAdmin(
    tenantId: number,
    search: string,
    category?: string,
    page?: number,
    limit?: number,
    options?: TenantProductsSearchOptions,
  ): Promise<TenantProductsSearchResult> {
    return this.runAsTenantForAdmin(tenantId, () =>
      this.searchTenantProducts(tenantId, search, category, page, limit, options),
    );
  }

  async findTenantProductCategoriesForAdmin(
    tenantId: number,
  ): Promise<string[]> {
    return this.runAsTenantForAdmin(tenantId, () =>
      this.findTenantProductCategories(tenantId),
    );
  }

  async findCatalogCategoriesForAdmin(
    tenantId: number,
  ): Promise<PublicProductCategorySummary[]> {
    return this.runAsTenantForAdmin(tenantId, () =>
      this.findCatalogCategories(tenantId),
    );
  }

  async findCatalogItemsForAdmin(
    tenantId: number,
    search?: string,
    category?: string,
    page?: number,
    limit?: number,
  ): Promise<CatalogItemsResult> {
    return this.runAsTenantForAdmin(tenantId, () =>
      this.findCatalogItems(tenantId, search, category, page, limit),
    );
  }

  async deleteTenantProductsAsAdmin(
    tenantId: number,
    adminId: number,
  ): Promise<DeleteTenantProductsAsAdminResult> {
    return this.runAsTenantForAdmin(tenantId, async () => {
      const prisma = this.getPrismaClient();
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true },
      });

      if (!tenant) {
        throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
      }

      const products = await prisma.product.findMany({
        where: { tenant_id: tenantId, deleted_at: null },
        select: { id: true },
      });
      const productIds = products.map((product) => product.id);
      const totalCount = productIds.length;

      if (totalCount === 0) {
        return {
          totalCount: 0,
          deletedCount: 0,
          skippedCount: 0,
          skippedReasons: [],
        };
      }

      const productIdSet = new Set(productIds);
      const activeOrderItems = await prisma.orderItem.findMany({
        where: {
          OR: [
            { product_id: { in: productIds } },
            { replaced_by_product_id: { in: productIds } },
            { pending_replacement_product_id: { in: productIds } },
          ],
          order: {
            tenant_id: tenantId,
            status: {
              in: [
                OrderStatus.DRAFT,
                OrderStatus.CONFIRMED,
                OrderStatus.OUT_FOR_DELIVERY,
              ],
            },
          },
        },
        select: {
          product_id: true,
          replaced_by_product_id: true,
          pending_replacement_product_id: true,
        },
      });

      const blockedProductIds = new Set<number>();
      for (const item of activeOrderItems) {
        if (item.product_id && productIdSet.has(item.product_id)) {
          blockedProductIds.add(item.product_id);
        }
        if (
          item.replaced_by_product_id &&
          productIdSet.has(item.replaced_by_product_id)
        ) {
          blockedProductIds.add(item.replaced_by_product_id);
        }
        if (
          item.pending_replacement_product_id &&
          productIdSet.has(item.pending_replacement_product_id)
        ) {
          blockedProductIds.add(item.pending_replacement_product_id);
        }
      }

      const deletableProductIds = productIds.filter(
        (id) => !blockedProductIds.has(id),
      );

      let deletedCount = 0;
      if (deletableProductIds.length > 0) {
        const deleteResult = await prisma.product.updateMany({
          where: {
            tenant_id: tenantId,
            id: { in: deletableProductIds },
            deleted_at: null,
          },
          data: {
            deleted_at: new Date(),
            deleted_by_id: adminId,
          },
        });
        deletedCount = deleteResult.count;

        if (deletedCount > 0) {
          await this.bumpTenantSearchCacheVersion(tenantId);
          await this.storesDirectoryService.recalculateTenantReadiness(tenantId);
        }
      }

      const skippedCount = blockedProductIds.size;

      return {
        totalCount,
        deletedCount,
        skippedCount,
        skippedReasons:
          skippedCount > 0
            ? [{ reason: 'active_order_reference', count: skippedCount }]
            : [],
      };
    });
  }

  /**
   * Creates a product by copying data from a catalog item.
   */
  async createFromCatalog(
    tenantId: number,
    payload: AddProductFromCatalogDto,
    actor?: ProductActivityActor,
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
          undefined,
          this.resolveDefaultQuantityUnitLabelForCatalogSource(catalogSource),
        ) as Prisma.InputJsonValue,
        is_available: true,
      },
    });

    await this.storeTenantProductCategory(tenantId, product.category);
    await this.bumpTenantSearchCacheVersion(tenantId);
    await this.bumpCatalogSearchCacheVersion(tenantId);
    await this.storesDirectoryService.recalculateTenantReadiness(tenantId);

    if (actor) {
      await this.activityLogService.create({
        tenantId,
        actorUserId: actor.userId ?? null,
        actorAdminId: actor.adminId ?? null,
        entityType: ActivityEntityTypes.Product,
        entityId: product.id,
        action: ActivityActions.ProductCreated,
        title: 'تم إضافة منتج من الكتالوج',
        description: `تم إضافة المنتج ${product.name} من الكتالوج`,
        newValues: {
          name: product.name,
          category: product.category,
          current_price: this.toActivityNumber(product.current_price),
          is_available: product.is_available,
          status: product.status,
        },
        metadata: {
          catalog_item_id: catalogItem.id,
          catalog_source: catalogSource,
        },
        source: this.resolveProductActivitySource(actor),
      });
    }

    return product;
  }

  /**
   * Bulk add essential catalog items for the tenant.
   */
  async bulkAddEssentials(
    tenantId: number,
    dto: AddBulkEssentialItemsDto,
    actor?: ProductActivityActor,
  ): Promise<{ count: number }> {
    let result: { count: number };

    if (dto.all_essential_items === true) {
      result = await this.bulkAddAllEssentialItems(tenantId);
    } else {
      const selectedItemIds = this.normalizeCatalogItemIds(dto.catalog_item_ids);
      const normalizedCategory = this.normalizeOptionalCategory(dto.category);
      if (selectedItemIds.length > 0) {
        if (!normalizedCategory) {
          throw new BadRequestException('Category is required for selected item import.');
        }

        result = await this.bulkAddEssentialItemsById(
          tenantId,
          normalizedCategory,
          selectedItemIds,
        );
      } else {
        const categories = (dto.categories ?? [])
          .map((category) => this.normalizeOptionalCategory(category))
          .filter((category): category is string => Boolean(category));

        if (categories.length === 0) {
          throw new BadRequestException('At least one category or catalog item is required.');
        }

        result = await this.bulkAddEssentialItemsByCategories(tenantId, categories);
      }
    }

    if (actor && result.count > 0) {
      await this.activityLogService.create({
        tenantId,
        actorUserId: actor.userId ?? null,
        actorAdminId: actor.adminId ?? null,
        entityType: ActivityEntityTypes.Product,
        action: ActivityActions.ProductBulkCreated,
        title: 'تم إضافة منتجات أساسية',
        description: `تم إضافة ${result.count} منتج من المنتجات الأساسية`,
        metadata: {
          created_count: result.count,
          all_essential_items: dto.all_essential_items === true,
          selected_catalog_item_count: dto.catalog_item_ids?.length ?? 0,
          selected_category_count: dto.categories?.length ?? 0,
        },
        source: this.resolveProductActivitySource(actor),
      });
    }

    return result;
  }

  /**
   * Returns staged essential bulk candidates grouped by category.
   */
  async findBulkEssentialStages(tenantId: number): Promise<BulkEssentialStage[]> {
    const catalogSource = await this.resolveTenantCatalogSource(tenantId);
    if (!catalogSource || catalogSource !== CATALOG_SOURCE_TALABAT) {
      return [];
    }

    const catalogItems = await this.getPrismaClient().catalogItem.findMany({
      where: {
        source: catalogSource,
        is_active: true,
        is_essential: true,
      },
      orderBy: [
        { category: 'asc' },
        { essential_sort_order: { sort: 'asc', nulls: 'last' } },
        { id: 'asc' },
      ],
    });

    const enrichedCatalogItems = await this.enrichCatalogItemsWithStockStatus(
      tenantId,
      catalogItems,
    );

    const groupedItems = new Map<string, (CatalogItem & { is_in_stock?: boolean })[]>();
    for (const item of enrichedCatalogItems) {
      const category = this.normalizeOptionalCategory(item.category ?? undefined);
      if (!category) {
        continue;
      }

      const items = groupedItems.get(category) ?? [];
      items.push(item);
      groupedItems.set(category, items);
    }

    return Array.from(groupedItems.entries())
      .sort(([left], [right]) => left.localeCompare(right, 'ar'))
      .map(([category, items]) => {
        const rankedItems = this.rankEssentialCatalogItems(items);
        return {
          category,
          total: rankedItems.length,
          default_selected_catalog_item_ids: rankedItems.map((item) => item.id),
          items: rankedItems,
        };
      });
  }

  /**
   * Adds every active essential catalog item allowed for a grocery tenant.
   */
  private async bulkAddAllEssentialItems(
    tenantId: number,
  ): Promise<{ count: number }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenantId)}, true)`;
      return DbTenantContext.run({ tenantId, manager: tx }, async () => {
        const catalogSource = await this.resolveTenantCatalogSource(tenantId);
        if (!catalogSource || catalogSource !== CATALOG_SOURCE_TALABAT) {
          throw new BadRequestException('Essential bulk import is only supported for supermarket tenants.');
        }

        const catalogItems = await this.getPrismaClient().catalogItem.findMany({
          where: {
            source: catalogSource,
            is_active: true,
            is_essential: true,
          },
          orderBy: [
            { category: 'asc' },
            { essential_sort_order: { sort: 'asc', nulls: 'last' } },
            { id: 'asc' },
          ],
        });

        return this.createBulkEssentialProductsFromCatalogItems(
          tenantId,
          catalogSource,
          catalogItems,
        );
      });
    });
  }

  /**
   * Adds essential catalog items from the selected legacy category list.
   */
  private async bulkAddEssentialItemsByCategories(
    tenantId: number,
    categories: string[],
  ): Promise<{ count: number }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenantId)}, true)`;
      return DbTenantContext.run({ tenantId, manager: tx }, async () => {
        const catalogSource = await this.resolveTenantCatalogSource(tenantId);
        if (!catalogSource || catalogSource !== CATALOG_SOURCE_TALABAT) {
          throw new BadRequestException('Essential bulk import is only supported for supermarket tenants.');
        }

        const catalogItems = await this.getPrismaClient().catalogItem.findMany({
          where: {
            source: catalogSource,
            is_active: true,
            is_essential: true,
            category: { in: categories },
          },
          orderBy: [
            { category: 'asc' },
            { essential_sort_order: { sort: 'asc', nulls: 'last' } },
            { id: 'asc' },
          ],
        });

        return this.createBulkEssentialProductsFromCatalogItems(
          tenantId,
          catalogSource,
          catalogItems,
        );
      });
    });
  }

  private async bulkAddEssentialItemsById(
    tenantId: number,
    category: string,
    catalogItemIds: number[],
  ): Promise<{ count: number }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenantId)}, true)`;
      return DbTenantContext.run({ tenantId, manager: tx }, async () => {
        const catalogSource = await this.resolveTenantCatalogSource(tenantId);
        if (!catalogSource || catalogSource !== CATALOG_SOURCE_TALABAT) {
          throw new BadRequestException('Essential bulk import is only supported for supermarket tenants.');
        }

        const catalogItems = await this.getPrismaClient().catalogItem.findMany({
          where: {
            id: { in: catalogItemIds },
            source: catalogSource,
            is_active: true,
            is_essential: true,
            category,
          },
        });

        if (catalogItems.length !== catalogItemIds.length) {
          throw new BadRequestException('One or more selected catalog items are invalid for this category.');
        }

        return this.createBulkEssentialProductsFromCatalogItems(
          tenantId,
          catalogSource,
          catalogItems,
        );
      });
    });
  }

  private async createBulkEssentialProductsFromCatalogItems(
    tenantId: number,
    catalogSource: CatalogSource,
    catalogItems: CatalogItem[],
  ): Promise<{ count: number }> {
    if (catalogItems.length === 0) {
      return { count: 0 };
    }

    const existingProducts = await this.getPrismaClient().product.findMany({
      where: {
        tenant_id: tenantId,
        status: ProductStatus.ACTIVE,
        deleted_at: null,
      },
      select: { name: true },
    });
    const existingNames = new Set(existingProducts.map((product) => product.name));
    const itemsToAdd = catalogItems.filter((item) => !existingNames.has(item.name));

    if (itemsToAdd.length === 0) {
      return { count: 0 };
    }

    const defaultUnitLabel =
      this.resolveDefaultQuantityUnitLabelForCatalogSource(catalogSource);
    const orderConfig = this.normalizeProductOrderConfig(
      ProductOrderMode.QUANTITY,
      undefined,
      defaultUnitLabel,
    ) as Prisma.InputJsonValue;

    const dataToInsert = itemsToAdd.map((item) => ({
      tenant_id: tenantId,
      name: item.name,
      image_url: item.image_url,
      category: item.category,
      source: ProductSource.CATALOG,
      status: ProductStatus.ACTIVE,
      current_price: item.price,
      order_mode: ProductOrderMode.QUANTITY,
      order_config: orderConfig,
      is_available: true,
      price_needs_review: true,
    }));

    const result = await this.getPrismaClient().product.createMany({
      data: dataToInsert,
      skipDuplicates: true,
    });

    const uniqueCategories = Array.from(
      new Set(itemsToAdd.map((item) => item.category).filter((category): category is string => Boolean(category))),
    );
    for (const itemCategory of uniqueCategories) {
      await this.storeTenantProductCategory(tenantId, itemCategory);
    }

    await this.getPrismaClient().tenant.update({
      where: { id: tenantId },
      data: { last_bulk_essentials_added_at: new Date() },
    });

    await this.bumpTenantSearchCacheVersion(tenantId);
    await this.bumpCatalogSearchCacheVersion(tenantId);
    await this.storesDirectoryService.recalculateTenantReadiness(tenantId);

    return { count: result.count };
  }

  private rankEssentialCatalogItems(items: CatalogItem[]): CatalogItem[] {
    return [...items].sort((left, right) => {
      const leftEssential = Number(Boolean(left.is_essential));
      const rightEssential = Number(Boolean(right.is_essential));
      if (leftEssential !== rightEssential) {
        return rightEssential - leftEssential;
      }

      const leftSortOrder = left.essential_sort_order ?? Number.MAX_SAFE_INTEGER;
      const rightSortOrder =
        right.essential_sort_order ?? Number.MAX_SAFE_INTEGER;
      if (leftSortOrder !== rightSortOrder) {
        return leftSortOrder - rightSortOrder;
      }

      const leftCompleteness = Number(Boolean(left.image_url)) + Number(left.price != null);
      const rightCompleteness = Number(Boolean(right.image_url)) + Number(right.price != null);
      if (leftCompleteness !== rightCompleteness) {
        return rightCompleteness - leftCompleteness;
      }

      return left.id - right.id;
    });
  }

  private normalizeCatalogItemIds(itemIds?: number[]): number[] {
    if (!Array.isArray(itemIds)) {
      return [];
    }

    return Array.from(
      new Set(
        itemIds.filter((itemId) => Number.isInteger(itemId) && itemId > 0),
      ),
    );
  }

  /**
   * Returns all active products for the authenticated tenant.
   */
  async findAll(
    tenantId: number,
    status: ProductStatus = ProductStatus.ACTIVE,
  ): Promise<Product[]> {
    return this.getPrismaClient().product.findMany({
      where: {
        tenant_id: tenantId,
        status,
        deleted_at: null,
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
    const status = options?.status ?? ProductStatus.ACTIVE;
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
      status,
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
      status,
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
    const tenantId = await this.resolveTenantIdBySlug(slug);
    if (!tenantId) return this.emptyPublicProductsResult(normalizedPage, normalizedLimit);
    const cacheKey = tenantId
      ? await this.buildPublicProductSearchCacheKey(
          tenantId,
          slug,
          normalizedSearch,
          normalizedCategory,
          similarityThreshold,
          strictMatchThresholds,
          normalizedPage,
          normalizedLimit,
        )
      : null;

    const cached = cacheKey
      ? await this.cacheManager.get<PublicProductsResult>(cacheKey)
      : undefined;
    if (cached) {
      return cached;
    }

    const result = await this.searchWithinPublicProducts(
      slug,
      normalizedSearch,
      normalizedCategory,
      similarityThreshold,
      strictMatchThresholds,
      normalizedPage,
      normalizedLimit,
    );

    if (cacheKey) {
      await this.cacheManager.set(
        cacheKey,
        result,
        PRODUCT_SEARCH_CACHE_TTL_SECONDS,
      );
    }

    return result;
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
    const tenantId = await this.resolveTenantIdBySlug(slug);
    if (!tenantId) return this.emptyPublicProductsResult(normalizedPage, normalizedLimit);
    const cacheKey = tenantId
      ? await this.buildPublicProductListCacheKey(
          tenantId,
          slug,
          normalizedCategory,
          normalizedPage,
          normalizedLimit,
        )
      : null;

    const cached = cacheKey
      ? await this.cacheManager.get<PublicProductsResult>(cacheKey)
      : undefined;
    if (cached) {
      return cached;
    }

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
      deleted_at: null,
      tenant: {
        slug: slug,
        status: TenantStatus.active,
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

    const result = {
      data,
      meta: {
        total,
        page: normalizedPage,
        limit: normalizedLimit,
        last_page: lastPage,
        has_next: normalizedPage < lastPage,
      },
    };

    if (cacheKey) {
      await this.cacheManager.set(
        cacheKey,
        result,
        PRODUCT_SEARCH_CACHE_TTL_SECONDS,
      );
    }

    return result;
  }

  /**
   * Returns category summaries for a public tenant storefront.
   */
  async findPublicCategoriesByTenantSlug(
    slug: string,
  ): Promise<PublicProductCategorySummary[]> {
    const tenant = await this.getPrismaClient().tenant.findUnique({
      where: { slug },
      select: { category: true, status: true },
    });
    if (!tenant || tenant.status !== TenantStatus.active) return [];
    const catalogSource = resolveCatalogSourceForTenantCategory(
      tenant?.category,
    );
    const normalizedCategoryExpression = `COALESCE(NULLIF(TRIM(product.category), ''), '${DEFAULT_PRODUCT_CATEGORY}')`;

    const categoryQuery = `
      SELECT ${normalizedCategoryExpression} as category, COUNT(product.id)::int as count
      FROM products product
      INNER JOIN tenants tenant ON product.tenant_id = tenant.id
      WHERE tenant.slug = $1 AND tenant.status = 'active' AND product.status = $2 AND product.deleted_at IS NULL
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

    const categoryRowsByName = new Map<string, string | null>();
    if (catalogSource) {
      const catalogCategoryRows =
        await this.getPrismaClient().catalogCategory.findMany({
          where: {
            source: catalogSource,
            deleted_at: null,
            name: {
              in: categories.filter((category) =>
                isCatalogCategoryAllowedForSource(catalogSource, category),
              ),
            },
          },
          select: {
            name: true,
            image_url: true,
          },
        });

      for (const row of catalogCategoryRows) {
        categoryRowsByName.set(row.name, row.image_url);
      }
    }

    return categoryRows.map((row) => ({
      category: row.category,
      count: Number(row.count),
      image_url: categoryRowsByName.get(row.category) ?? null,
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
    const allowedCategories =
      await this.getActiveCatalogCategoryNames(catalogSource);

    const rows = await this.getPrismaClient().catalogItem.groupBy({
      by: ['category'],
      where: {
        is_active: true,
        source: catalogSource,
        category: { in: allowedCategories },
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

    const catalogCategoryRows =
      await this.getPrismaClient().catalogCategory.findMany({
        where: {
          source: catalogSource,
          deleted_at: null,
          name: {
            in: categories.filter((category) =>
              allowedCategories.includes(category),
            ),
          },
        },
        select: {
          name: true,
          image_url: true,
        },
      });

    const categoryImages = new Map(
      catalogCategoryRows.map((row) => [row.name, row.image_url]),
    );

    const summariesByCategory = new Map<string, PublicProductCategorySummary>();
    for (const row of rows) {
      const category = this.normalizeOptionalCategory(
        row.category ?? undefined,
      );
      if (!category) continue;

      const existingSummary = summariesByCategory.get(category);
      if (existingSummary) {
        existingSummary.count += row._count.id;
        continue;
      }

      summariesByCategory.set(category, {
        category,
        count: row._count.id,
        image_url: categoryImages.get(category) ?? null,
      });
    }

    return Array.from(summariesByCategory.values());
  }

  /**
   * Returns merged catalog + tenant categories for merchant onboarding.
   */
  async findTenantProductCategories(tenantId: number): Promise<string[]> {
    const catalogSource = await this.resolveTenantCatalogSource(tenantId);
    const allowedCategories = catalogSource
      ? await this.getActiveCatalogCategoryNames(catalogSource)
      : [];
    const [catalogRows, tenantRows] = await Promise.all([
      this.getPrismaClient().catalogItem.groupBy({
        by: ['category'],
        where: catalogSource
          ? {
              is_active: true,
              source: catalogSource,
              category: { in: allowedCategories },
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
   * Enriches a list of catalog items with a boolean indicating if they are already in the tenant's products.
   */
  private async enrichCatalogItemsWithStockStatus(
    tenantId: number,
    catalogItems: CatalogItem[],
  ): Promise<(CatalogItem & { is_in_stock: boolean })[]> {
    if (catalogItems.length === 0) {
      return [];
    }

    const existingProducts = await this.getPrismaClient().product.findMany({
      where: {
        tenant_id: tenantId,
        status: ProductStatus.ACTIVE,
        name: { in: catalogItems.map((item) => item.name) },
      },
      select: { name: true },
    });

    const existingNames = new Set(existingProducts.map((p) => p.name));

    return catalogItems.map((item) => ({
      ...item,
      is_in_stock: existingNames.has(item.name),
    }));
  }

  private async getActiveTenantProductNames(tenantId: number): Promise<string[]> {
    const products = await this.getPrismaClient().product.findMany({
      where: {
        tenant_id: tenantId,
        status: ProductStatus.ACTIVE,
        deleted_at: null,
      },
      select: { name: true },
    });

    return products.map((product) => product.name);
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
    const allowedCategories =
      await this.getActiveCatalogCategoryNames(catalogSource);

    if (normalizedSearch.length >= 2) {
      const normalizedCategory = this.normalizeOptionalCategory(category);
      const similarityThreshold =
        this.resolveSimilarityThreshold(normalizedSearch);
      const strictMatchThresholds =
        this.resolveStrictMatchThresholds(normalizedSearch);
      const searchVersion = await this.getCatalogSearchCacheVersion(tenantId);

      const cacheKey = this.buildCatalogSearchCacheKey(
        tenantId,
        searchVersion,
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
        allowedCategories,
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
      category: { in: allowedCategories },
      tenant_hidden_catalog_items: {
        none: { tenant_id: tenantId },
      },
    };
    const activeProductNames = await this.getActiveTenantProductNames(tenantId);
    if (activeProductNames.length > 0) {
      where.name = { notIn: activeProductNames };
    }

    if (category) {
      where.category = allowedCategories.includes(category)
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

    const enrichedData = await this.enrichCatalogItemsWithStockStatus(
      tenantId,
      data,
    );

    return {
      data: enrichedData,
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
    const catalogSource = await this.resolveTenantCatalogSource(tenantId);
    if (!catalogSource) {
      throw new NotFoundException(
        `Catalog item with ID ${catalogItemId} not found`,
      );
    }

    const allowedCategories =
      await this.getActiveCatalogCategoryNames(catalogSource);
    const catalogItem = await this.getPrismaClient().catalogItem.findFirst({
      where: {
        id: catalogItemId,
        is_active: true,
        source: catalogSource,
        category: { in: allowedCategories },
      },
      select: { id: true },
    });

    if (!catalogItem) {
      throw new NotFoundException(
        `Catalog item with ID ${catalogItemId} not found`,
      );
    }

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
    await this.bumpCatalogSearchCacheVersion(tenantId);
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
      await this.bumpCatalogSearchCacheVersion(tenantId);
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
    const allowedCategories =
      await this.getActiveCatalogCategoryNames(catalogSource);

    const where: Prisma.CatalogItemWhereInput = {
      is_active: true,
      source: catalogSource,
      category: { in: allowedCategories },
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

    const enrichedData = await this.enrichCatalogItemsWithStockStatus(
      tenantId,
      data,
    );

    return {
      data: enrichedData,
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
    actor?: ProductActivityActor,
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
      updateData.price_needs_review = false;
    }

    if (
      updateProductDto.order_mode !== undefined ||
      updateProductDto.order_config !== undefined
    ) {
      const defaultUnitLabel =
        await this.resolveDefaultQuantityUnitLabel(tenantId);

      const nextOrderMode = this.resolveProductOrderMode(
        updateProductDto.order_mode ?? (product.order_mode as ProductOrderMode),
      );
      updateData.order_mode = nextOrderMode;
      updateData.order_config = this.normalizeProductOrderConfig(
        nextOrderMode,
        updateProductDto.order_config ??
          (product.order_config as Record<string, unknown>) ??
          undefined,
        defaultUnitLabel,
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
    await this.bumpCatalogSearchCacheVersion(tenantId);
    await this.storesDirectoryService.recalculateTenantReadiness(tenantId);

    if (previousImageUrl && previousImageUrl !== updatedProduct.image_url) {
      await this.imageProcessorService.deleteManagedProductImage(
        previousImageUrl,
      );
    }

    if (actor) {
      await this.logProductUpdateActivity(
        tenantId,
        product,
        updatedProduct,
        {
          imageChanged: previousImageUrl !== updatedProduct.image_url,
          actor,
        },
      );
    }

    return updatedProduct;
  }

  async updateForTenantAsAdmin(
    productId: number,
    updateProductDto: UpdateProductDto,
    file?: Express.Multer.File,
  ): Promise<Product> {
    const product = await this.getPrismaClient().product.findFirst({
      where: { id: productId, deleted_at: null },
      select: { tenant_id: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    return this.runAsTenantForAdmin(product.tenant_id, () =>
      this.update(productId, product.tenant_id, updateProductDto, file),
    );
  }

  async bulkUpdate(
    tenantId: number,
    payload: BulkUpdateProductsDto,
    actor?: ProductActivityActor,
  ): Promise<{ success: true; count: number }> {
    const { productIds, dto } = await this.prepareBulkProductUpdate(
      payload,
      { tenantId },
    );

    for (const productId of productIds) {
      await this.update(productId, tenantId, dto);
    }

    if (actor && productIds.length > 0) {
      await this.activityLogService.create({
        tenantId,
        actorUserId: actor.userId ?? null,
        actorAdminId: actor.adminId ?? null,
        entityType: ActivityEntityTypes.Product,
        action: ActivityActions.ProductBulkUpdated,
        title: 'تم تعديل مجموعة منتجات',
        description: `تم تعديل ${productIds.length} منتج`,
        metadata: {
          product_ids: productIds,
          changed_fields: Object.keys(dto),
        },
        source: this.resolveProductActivitySource(actor),
      });
    }

    return { success: true, count: productIds.length };
  }

  /**
   * Writes high-signal product activity entries for changed fields.
   */
  private async logProductUpdateActivity(
    tenantId: number,
    oldProduct: Product,
    updatedProduct: Product,
    options: { imageChanged: boolean; actor: ProductActivityActor },
  ): Promise<void> {
    const actor = options.actor;
    const source = this.resolveProductActivitySource(actor);
    const actorPayload = {
      actorUserId: actor.userId ?? null,
      actorAdminId: actor.adminId ?? null,
    };

    const oldPrice = this.toActivityNumber(oldProduct.current_price);
    const newPrice = this.toActivityNumber(updatedProduct.current_price);
    if (String(oldPrice ?? '') !== String(newPrice ?? '')) {
      await this.activityLogService.create({
        tenantId,
        ...actorPayload,
        entityType: ActivityEntityTypes.Product,
        entityId: updatedProduct.id,
        action: ActivityActions.ProductPriceChanged,
        title: 'تم تعديل سعر المنتج',
        description: `تم تعديل سعر ${updatedProduct.name} من ${oldPrice ?? 'غير محدد'} إلى ${newPrice ?? 'غير محدد'} جنيه`,
        oldValues: { current_price: oldPrice },
        newValues: { current_price: newPrice },
        source,
      });
    }

    if (oldProduct.is_available !== updatedProduct.is_available) {
      await this.activityLogService.create({
        tenantId,
        ...actorPayload,
        entityType: ActivityEntityTypes.Product,
        entityId: updatedProduct.id,
        action: ActivityActions.ProductAvailabilityChanged,
        title: updatedProduct.is_available
          ? 'تم إتاحة المنتج'
          : 'تم إخفاء المنتج من الطلب',
        description: updatedProduct.is_available
          ? `تم جعل ${updatedProduct.name} متاحا للطلب`
          : `تم جعل ${updatedProduct.name} غير متاح للطلب`,
        oldValues: { is_available: oldProduct.is_available },
        newValues: { is_available: updatedProduct.is_available },
        source,
      });
    }

    if (oldProduct.status !== updatedProduct.status) {
      await this.activityLogService.create({
        tenantId,
        ...actorPayload,
        entityType: ActivityEntityTypes.Product,
        entityId: updatedProduct.id,
        action:
          updatedProduct.status === ProductStatus.ARCHIVED
            ? ActivityActions.ProductArchived
            : ActivityActions.ProductUpdated,
        title:
          updatedProduct.status === ProductStatus.ARCHIVED
            ? 'تم أرشفة المنتج'
            : 'تم تعديل حالة المنتج',
        description: `تم تغيير حالة ${updatedProduct.name} من ${PRODUCT_STATUS_LABELS_AR[oldProduct.status as ProductStatus]} إلى ${PRODUCT_STATUS_LABELS_AR[updatedProduct.status as ProductStatus]}`,
        oldValues: { status: oldProduct.status },
        newValues: { status: updatedProduct.status },
        source,
      });
    }

    const diff = pickChangedFields(
      {
        name: oldProduct.name,
        category: oldProduct.category,
        order_mode: oldProduct.order_mode,
        order_config: oldProduct.order_config,
        image_changed: false,
      },
      {
        name: updatedProduct.name,
        category: updatedProduct.category,
        order_mode: updatedProduct.order_mode,
        order_config: updatedProduct.order_config,
        image_changed: options.imageChanged,
      },
      ['name', 'category', 'order_mode', 'order_config', 'image_changed'],
    );

    if (diff.hasChanges) {
      await this.activityLogService.create({
        tenantId,
        ...actorPayload,
        entityType: ActivityEntityTypes.Product,
        entityId: updatedProduct.id,
        action: ActivityActions.ProductUpdated,
        title: 'تم تعديل المنتج',
        description: `تم تعديل بيانات المنتج ${updatedProduct.name}`,
        oldValues: diff.oldValues,
        newValues: diff.newValues,
        source,
      });
    }
  }

  private async prepareBulkProductUpdate(
    payload: BulkUpdateProductsPayload,
    options?: { tenantId?: number },
  ): Promise<{
    products: { id: number; tenant_id: number }[];
    productIds: number[];
    dto: UpdateProductDto;
  }> {
    const productIds = this.normalizeBulkProductIds(payload.ids);
    if (productIds.length === 0) {
      throw new BadRequestException('At least one product is required');
    }

    const hasCategory = typeof payload.category === 'string';
    const hasAvailability = payload.is_available !== undefined;
    const hasStatus = payload.status !== undefined;

    if (!hasCategory && !hasAvailability && !hasStatus) {
      throw new BadRequestException('At least one bulk action is required');
    }

    const dto: UpdateProductDto = {};
    if (hasCategory) {
      const category = payload.category?.trim();
      if (!category) {
        throw new BadRequestException('Category is required');
      }
      dto.category = category;
    }
    if (hasAvailability) dto.is_available = payload.is_available;
    if (hasStatus) dto.status = payload.status;

    const products = await this.getPrismaClient().product.findMany({
      where: {
        id: { in: productIds },
        tenant_id: options?.tenantId,
        deleted_at: null,
      },
      select: { id: true, tenant_id: true },
      orderBy: { id: 'asc' },
    });

    if (products.length !== productIds.length) {
      this.logger.error('[DEBUG bulkUpdate] Product lookup mismatch', {
        requestedIds: productIds,
        foundIds: products.map((p) => p.id),
        tenantId: options?.tenantId,
        contextTenantId: DbTenantContext.getTenantId(),
        hasManager: !!DbTenantContext.getManager(),
      });
      throw new NotFoundException('One or more products were not found');
    }

    return { products, productIds, dto };
  }

  private normalizeBulkProductIds(ids: number[] | undefined): number[] {
    if (!Array.isArray(ids)) {
      return [];
    }

    return Array.from(
      new Set(ids.filter((id) => Number.isInteger(id) && id > 0)),
    );
  }

  private async runAsTenantForAdmin<T>(
    tenantId: number,
    callback: () => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenantId)}, true)`;
      return DbTenantContext.run({ tenantId, manager: tx }, callback);
    });
  }

  /**
   * Soft archives a product so historical order records stay intact.
   */
  async remove(
    id: number,
    tenantId: number,
    actor?: ProductActivityActor,
  ): Promise<void> {
    const product = await this.findOne(id, tenantId);
    await this.getPrismaClient().product.update({
      where: { id },
      data: { status: ProductStatus.ARCHIVED },
    });
    await this.bumpTenantSearchCacheVersion(tenantId);
    await this.bumpCatalogSearchCacheVersion(tenantId);
    await this.storesDirectoryService.recalculateTenantReadiness(tenantId);

    if (actor && product.status !== ProductStatus.ARCHIVED) {
      await this.activityLogService.create({
        tenantId,
        actorUserId: actor.userId ?? null,
        actorAdminId: actor.adminId ?? null,
        entityType: ActivityEntityTypes.Product,
        entityId: product.id,
        action: ActivityActions.ProductArchived,
        title: 'تم أرشفة المنتج',
        description: `تم أرشفة المنتج ${product.name}`,
        oldValues: { status: product.status },
        newValues: { status: ProductStatus.ARCHIVED },
        source: this.resolveProductActivitySource(actor),
      });
    }
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
    status: ProductStatus = ProductStatus.ACTIVE,
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
    conditions.push(`status = ${addParam(status)}`);
    conditions.push(`deleted_at IS NULL`);

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
    const searchTextParam = this.buildNormalizedSearchTextParam(searchParam);
    const prefixTextParam = `${prefixParam}::text`;
    const containsTextParam = `${containsParam}::text`;

    const comparableNameSql = '"name_normalized"';

    // If search volume or relevance needs grow, move this ranking behind a dedicated search engine such as Meilisearch.
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
    conditions.push(`tenant.status = 'active'`);
    conditions.push(`product.status = ${addParam(ProductStatus.ACTIVE)}`);
    conditions.push(`product.deleted_at IS NULL`);

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

    const searchTextParam = this.buildNormalizedSearchTextParam(searchParam);
    const comparableNameSql = 'product.name_normalized';

    const rankSql = `(word_similarity(${comparableNameSql}, ${searchTextParam}) * 0.55) + (similarity(${comparableNameSql}, ${searchTextParam}) * 0.30) + (CASE WHEN ${comparableNameSql} LIKE ${prefixParam} THEN 1 ELSE 0 END) * 0.15`;

    conditions.push(`(
      ${comparableNameSql} LIKE ${prefixParam}
      OR ${comparableNameSql} LIKE ${containsParam}
      OR (
        similarity(${comparableNameSql}, ${searchTextParam}) >= ${strictSimParam}
        AND word_similarity(${comparableNameSql}, ${searchTextParam}) >= ${strictWordSimParam}
      )
    )`);

    const whereClause = conditions.join(' AND ');

    const limitParam = addParam(limit);
    const offsetParam = addParam((page - 1) * limit);

    const dataQuery = `
      SELECT product.*, 
        ${rankSql} as search_rank,
        word_similarity(${comparableNameSql}, ${searchTextParam}) as word_sim,
        similarity(${comparableNameSql}, ${searchTextParam}) as name_similarity,
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
    return arabicNormalize(search);
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

  /**
   * Builds the shared SQL expression for normalized product search input.
   */
  private buildNormalizedSearchTextParam(searchParam: string): string {
    return `arabic_normalize(${searchParam}::text)`;
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

  private async resolveDefaultQuantityUnitLabel(
    tenantId: number,
  ): Promise<string> {
    const tenant = await this.getPrismaClient().tenant.findUnique({
      where: { id: tenantId },
      select: { category: true },
    });

    return tenant?.category === TenantCategory.pharmacy
      ? DEFAULT_PHARMACY_QUANTITY_UNIT_LABEL
      : DEFAULT_QUANTITY_UNIT_LABEL;
  }

  private resolveDefaultQuantityUnitLabelForCatalogSource(
    source: CatalogSource,
  ): string {
    return source === CATALOG_SOURCE_CHEFAA
      ? DEFAULT_PHARMACY_QUANTITY_UNIT_LABEL
      : DEFAULT_QUANTITY_UNIT_LABEL;
  }

  private normalizeProductOrderConfig(
    mode: ProductOrderMode,
    rawConfig?: unknown,
    defaultUnitLabel: string = DEFAULT_QUANTITY_UNIT_LABEL,
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
        return this.normalizeQuantityOrderConfig(
          config.quantity,
          defaultUnitLabel,
        );
    }
  }

  private normalizeQuantityOrderConfig(
    rawValue: unknown,
    defaultUnitLabel: string,
  ): ProductOrderConfig {
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
        unit_label: unitLabel || defaultUnitLabel,
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

  private getPublicProductCacheVersionKey(tenantId: number): string {
    return `public:products:version:${tenantId}`;
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
    status: ProductStatus,
    version: string,
  ): string {
    const normalizedCategory = category || 'all';
    const normalizedExcludedIds =
      excludedProductIds.length > 0 ? excludedProductIds.join(',') : 'none';
    const rankingMode = rankAll ? 'rank_all' : 'strict';
    return `merchant:products:search:${tenantId}:${version}:${status}:${normalizedCategory}:${normalizedSearch}:${similarityThreshold}:${strictMatchThresholds.strictSimilarityThreshold}:${strictMatchThresholds.strictWordSimilarityThreshold}:${rankingMode}:${normalizedExcludedIds}:${page}:${limit}`;
  }

  private buildCatalogSearchCacheKey(
    tenantId: number,
    version: string,
    normalizedSearch: string,
    category: string | undefined,
    source: CatalogSource,
    similarityThreshold: number,
    strictMatchThresholds: StrictMatchThresholds,
    page: number,
    limit: number,
  ): string {
    const normalizedCategory = category || 'all';
    return `catalog:search:tenant:${tenantId}:${version}:${source}:${normalizedCategory}:${normalizedSearch}:${similarityThreshold}:${strictMatchThresholds.strictSimilarityThreshold}:${strictMatchThresholds.strictWordSimilarityThreshold}:${page}:${limit}`;
  }

  private async buildPublicProductSearchCacheKey(
    tenantId: number,
    slug: string,
    normalizedSearch: string,
    category: string | undefined,
    similarityThreshold: number,
    strictMatchThresholds: StrictMatchThresholds,
    page: number,
    limit: number,
  ): Promise<string> {
    const version = await this.getPublicProductCacheVersion(tenantId);
    const normalizedCategory = category || 'all';
    return `public:products:search:${tenantId}:${version}:${slug}:${normalizedCategory}:${normalizedSearch}:${similarityThreshold}:${strictMatchThresholds.strictSimilarityThreshold}:${strictMatchThresholds.strictWordSimilarityThreshold}:${page}:${limit}`;
  }

  private async buildPublicProductListCacheKey(
    tenantId: number,
    slug: string,
    category: string | undefined,
    page: number,
    limit: number,
  ): Promise<string> {
    const version = await this.getPublicProductCacheVersion(tenantId);
    const normalizedCategory = category || 'all';
    return `public:products:list:${tenantId}:${version}:${slug}:${normalizedCategory}:${page}:${limit}`;
  }

  private getCatalogSearchCacheVersionKey(tenantId: number): string {
    return `catalog:search:version:${tenantId}`;
  }

  private async getActiveCatalogCategoryNames(
    source: CatalogSource,
  ): Promise<string[]> {
    const rows = await this.getPrismaClient().catalogCategory.findMany({
      where: { source, deleted_at: null },
      select: { name: true },
      orderBy: { name: 'asc' },
    });

    if (rows.length > 0) {
      return rows.map((row) => row.name);
    }

    return getAllowedCatalogCategoriesForSource(source);
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
    allowedCategories: string[],
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
    conditions.push(
      `NOT EXISTS (SELECT 1 FROM tenant_hidden_catalog_items hidden WHERE hidden.catalog_item_id = catalog_items.id AND hidden.tenant_id = ${addParam(tenantId)})`,
    );
    conditions.push(
      `NOT EXISTS (
        SELECT 1
        FROM products product
        WHERE product.tenant_id = ${addParam(tenantId)}
          AND product.status = ${addParam(ProductStatus.ACTIVE)}
          AND product.deleted_at IS NULL
          AND product.name = catalog_items.name
      )`,
    );

    if (allowedCategories.length > 0) {
      conditions.push(`category = ANY(${addParam(allowedCategories)}::text[])`);
    }

    if (category) {
      conditions.push(
        allowedCategories.includes(category)
          ? `category = ${addParam(category)}`
          : 'false',
      );
    }

    const searchParam = addParam(normalizedSearch);
    const prefixParam = addParam(prefixPattern);
    const containsParam = addParam(containsPattern);
    const searchTextParam = this.buildNormalizedSearchTextParam(searchParam);
    const prefixTextParam = `${prefixParam}::text`;
    const containsTextParam = `${containsParam}::text`;

    const comparableNameSql = 'arabic_normalize(name)';

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

    const enrichedData = await this.enrichCatalogItemsWithStockStatus(
      tenantId,
      data,
    );

    return {
      data: enrichedData,
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
    const version = Date.now().toString();
    await Promise.all([
      this.cacheManager.set(versionKey, version),
      this.bumpPublicProductCacheVersion(tenantId, version),
    ]);
  }

  private async getPublicProductCacheVersion(tenantId: number): Promise<string> {
    const versionKey = this.getPublicProductCacheVersionKey(tenantId);
    const cachedVersion = await this.cacheManager.get<string>(versionKey);
    if (cachedVersion) {
      return cachedVersion;
    }

    const initialVersion = Date.now().toString();
    await this.cacheManager.set(versionKey, initialVersion);
    return initialVersion;
  }

  private async bumpPublicProductCacheVersion(
    tenantId: number,
    version = Date.now().toString(),
  ): Promise<void> {
    const versionKey = this.getPublicProductCacheVersionKey(tenantId);
    await this.cacheManager.set(versionKey, version);
  }

  private async resolveTenantIdBySlug(slug: string): Promise<number | null> {
    const tenant = await this.getPrismaClient().tenant.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });

    return tenant?.status === TenantStatus.active ? tenant.id : null;
  }

  private emptyPublicProductsResult(
    page: number,
    limit: number,
  ): PublicProductsResult {
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

  private async getCatalogSearchCacheVersion(tenantId: number): Promise<string> {
    const versionKey = this.getCatalogSearchCacheVersionKey(tenantId);
    const cachedVersion = await this.cacheManager.get<string>(versionKey);
    if (cachedVersion) {
      return cachedVersion;
    }

    const initialVersion = Date.now().toString();
    await this.cacheManager.set(versionKey, initialVersion);
    return initialVersion;
  }

  private async bumpCatalogSearchCacheVersion(tenantId: number): Promise<void> {
    const versionKey = this.getCatalogSearchCacheVersionKey(tenantId);
    await this.cacheManager.set(versionKey, Date.now().toString());
  }

  /**
   * Maps product actor context to a persisted activity source.
   */
  private resolveProductActivitySource(actor: ProductActivityActor) {
    if (actor.source === 'admin') {
      return ActivitySources.Admin;
    }

    if (actor.source === 'csv_import') {
      return ActivitySources.CsvImport;
    }

    return ActivitySources.Dashboard;
  }

  /**
   * Converts Prisma decimal-like values into JSON-safe activity numbers.
   */
  private toActivityNumber(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async importProductsFromCsv(
    tenantId: number,
    file: Express.Multer.File,
    actor?: ProductActivityActor,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, category: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const summary = {
      total_rows: 0,
      created_rows: 0,
      updated_rows: 0,
      skipped_rows: 0,
      failed_rows: 0,
      errors: [] as { row_number: number; message: string }[],
    };

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const csvParser = require('csv-parser');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createReadStream } = require('fs');

    const results: any[] = [];

    await new Promise((resolve, reject) => {
      createReadStream(file.path)
        .pipe(
          csvParser({
            mapHeaders: ({ header }: { header: string }) =>
              header.trim().replace(/^[\uFEFF\u200B]/, ''),
          }),
        )
        .on('data', (data: any) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (err: any) => reject(err));
    });

    const processRows = async () => {
      for (const rowData of results) {
        summary.total_rows += 1;
        try {
          const rawName = rowData.name || rowData.Name;
          const rawPrice = rowData.price || rowData.Price;
          const rawCategory = rowData.category || rowData.Category;
          const rawImageUrl =
            rowData.imageUrl || rowData.ImageUrl || rowData.image_url;

          if (!rawName) {
            throw new Error('Product name is required');
          }

          const name = rawName.trim().replace(/\s+/g, ' ').toLowerCase();

          const normalizeNumerals = (str: string) =>
            str.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
          const priceStr = rawPrice
            ? normalizeNumerals(String(rawPrice).trim())
            : undefined;
          let price: number | undefined = undefined;
          if (priceStr) {
            price = parseFloat(priceStr);
            if (isNaN(price) || price < 0) {
              throw new Error(`Invalid price format: ${rawPrice}`);
            }
          }
          if (price === undefined) {
            throw new Error('Price is required');
          }

          const categoryName = rawCategory ? rawCategory.trim() : 'أخرى';

          const client = this.getPrismaClient();
          let category = await client.tenantProductCategory.findUnique({
            where: {
              tenant_id_name: { tenant_id: tenantId, name: categoryName },
            },
          });
          if (!category) {
            category = await client.tenantProductCategory.create({
              data: { tenant_id: tenantId, name: categoryName },
            });
          }

          const existingProduct = await client.product.findFirst({
            where: { tenant_id: tenantId, name },
          });

          if (existingProduct) {
            const oldPrice = existingProduct.current_price;
            await client.product.update({
              where: { id: existingProduct.id },
              data: {
                current_price: price,
                category: category.name,
                image_url: rawImageUrl
                  ? rawImageUrl.trim()
                  : existingProduct.image_url,
                is_available: true,
              },
            });
            if (oldPrice && Number(oldPrice) !== price) {
              await client.productPriceHistory.create({
                data: {
                  tenant_id: tenantId,
                  product_id: existingProduct.id,
                  price: price,
                  reason: 'Imported from CSV',
                },
              });
            }
            summary.updated_rows++;
          } else {
            const newProduct = await client.product.create({
              data: {
                tenant_id: tenantId,
                name,
                current_price: price,
                category: category.name,
                image_url: rawImageUrl ? rawImageUrl.trim() : null,
                source: 'manual',
                status: 'active',
                order_mode: 'quantity',
                is_available: true,
              },
            });

            await client.productPriceHistory.create({
              data: {
                tenant_id: tenantId,
                product_id: newProduct.id,
                price: price,
                reason: 'Initial price from CSV import',
              },
            });

            summary.created_rows++;
          }
        } catch (error) {
          summary.failed_rows++;
          summary.errors.push({
            row_number: summary.total_rows,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    };

    if (DbTenantContext.getTenantId()) {
      await processRows();
    } else {
      await this.runAsTenantForAdmin(tenantId, processRows);
    }

    if (summary.created_rows > 0 || summary.updated_rows > 0) {
      await this.storesDirectoryService.recalculateTenantReadiness(tenantId);
    }

    if (actor) {
      await this.activityLogService.create({
        tenantId,
        actorUserId: actor.userId ?? null,
        actorAdminId: actor.adminId ?? null,
        entityType: ActivityEntityTypes.CsvImport,
        action: ActivityActions.ProductCsvImportCompleted,
        title: 'تم استيراد ملف منتجات',
        description: `تم استيراد ملف منتجات: ${summary.created_rows} جديد و ${summary.updated_rows} محدث`,
        metadata: {
          total_rows: summary.total_rows,
          created_rows: summary.created_rows,
          updated_rows: summary.updated_rows,
          skipped_rows: summary.skipped_rows,
          failed_rows: summary.failed_rows,
          file_name: file.originalname,
        },
        source: this.resolveProductActivitySource(actor),
      });
    }

    return summary;
  }
}
