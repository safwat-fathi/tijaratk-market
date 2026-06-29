import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminLoginDto } from './dto/admin-login.dto';
import {
  Prisma,
  TenantCategory,
  TenantStatus,
} from '../../generated/prisma/client';
import { TenantCancellationPolicyService } from 'src/tenant-cancellation-policy/tenant-cancellation-policy.service';
import { ImageProcessorService } from 'src/common/services/image-processor.service';
import {
  CATALOG_SOURCE_CHEFAA,
  CATALOG_SOURCE_TALABAT,
  CatalogSource,
  getAllowedCatalogCategoriesForSource,
  isCatalogCategoryAllowedForSource,
} from 'src/products/catalog-source-policy';
import {
  BulkUpdateAdminCatalogItemsDto,
  CreateAdminCatalogItemDto,
  CreateAdminCatalogCategoryDto,
  CreateTenantProductCategoryDto,
  UpdateAdminCatalogCategoryDto,
  UpdateAdminCatalogItemDto,
  UpdateTenantProductCategoryDto,
} from './dto/catalog-item.dto';
import {
  CreateSupermarketEssentialDto,
  UpdateSupermarketEssentialDto,
} from './dto/supermarket-essential.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly tenantCancellationPolicyService: TenantCancellationPolicyService,
    private readonly imageProcessorService: ImageProcessorService,
  ) {}

  async login(loginDto: AdminLoginDto) {
    const adminUser = await this.prisma.adminUser.findUnique({
      where: { phone: loginDto.phone },
    });

    if (!adminUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(loginDto.password, adminUser.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: adminUser.id,
      phone: adminUser.phone,
      role: 'admin',
    };

    return {
      admin_access_token: this.jwtService.sign(payload),
      user: {
        id: adminUser.id,
        phone: adminUser.phone,
        name: adminUser.name,
        role: 'admin',
      },
    };
  }

  private async runWithTenantRls<T>(
    tenantId: number,
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenantId)}, true)`;
      return callback(tx);
    });
  }

  private getPagination(page = 1, limit = 20) {
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit =
      Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20;

    return {
      page: safePage,
      limit: safeLimit,
      offset: (safePage - 1) * safeLimit,
      prefetch: safePage * safeLimit,
    };
  }

  private paginateItems<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
    offset: number,
  ) {
    return {
      data: items.slice(offset, offset + limit),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  // Dashboard Stats
  async getDashboardStats() {
    const [tenants, activeMerchants, totalPlans] = await Promise.all([
      this.prisma.tenant.findMany({
        select: { id: true },
      }),
      this.prisma.tenant.count({
        where: { status: TenantStatus.active },
      }),
      this.prisma.subscriptionPlan.count(),
    ]);

    const orderCounts = await Promise.all(
      tenants.map((tenant) =>
        this.runWithTenantRls(tenant.id, (tx) =>
          tx.order.count({
            where: { tenant_id: tenant.id },
          }),
        ),
      ),
    );

    return {
      totalMerchants: tenants.length,
      activeMerchants,
      totalOrders: orderCounts.reduce((total, count) => total + count, 0),
      totalPlans,
    };
  }

  // Tenants Management
  async getTenants() {
    const tenants = await this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        slug: true,
        status: true,
        category: true,
        last_bulk_essentials_added_at: true,
        created_at: true,
        updated_at: true,
        deleted_at: true,
        customer_counter: true,
        directory_profile: {
          include: { area: true },
        },
        tenant_delivery_areas: {
          where: { is_active: true, deleted_at: null },
          include: { area: true },
          orderBy: [
            { area: { sort_order: 'asc' } },
            { area: { name_ar: 'asc' } },
          ],
        },
        tenant_subscriptions: {
          where: { is_active: true },
          include: { plan: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return Promise.all(
      tenants.map(async (tenant) => {
        const [orders, customers, products, cancellationPolicy] =
          await this.runWithTenantRls(tenant.id, (tx) =>
            Promise.all([
              tx.order.count({ where: { tenant_id: tenant.id } }),
              tx.customer.count({ where: { tenant_id: tenant.id } }),
              tx.product.count({ where: { tenant_id: tenant.id } }),
              this.tenantCancellationPolicyService.getAdminSummary(
                tenant.id,
                tenant.status,
                tx,
              ),
            ]),
          );

        return {
          ...tenant,
          _count: {
            orders,
            customers,
            products,
          },
          cancellation_policy: cancellationPolicy,
        };
      }),
    );
  }

  async updateTenantStatus(id: number, status: TenantStatus) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return this.runWithTenantRls(id, async (tx) => {
      const updatedTenant = await tx.tenant.update({
        where: { id },
        data: { status },
      });

      await this.tenantCancellationPolicyService.recordAdminStatusChange(
        id,
        tenant.status,
        status,
        tx,
      );

      return updatedTenant;
    });
  }

  async updateTenantPlan(tenantId: number, planId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    // Deactivate current active subscription
    await this.prisma.tenantSubscription.updateMany({
      where: { tenant_id: tenantId, is_active: true },
      data: { is_active: false, end_date: new Date() },
    });

    // Create new subscription
    return this.prisma.tenantSubscription.create({
      data: {
        tenant_id: tenantId,
        plan_id: planId,
        start_date: new Date(),
        is_active: true,
      },
    });
  }

  // Plans Management
  async getPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
    });
  }

  async togglePlanStatus(id: number, is_active: boolean) {
    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: { is_active },
    });
  }

  /**
   * Retrieve global catalog items for a single supported catalog source.
   */
  async getAdminCatalogItems(
    source: CatalogSource,
    search?: string,
    category?: string,
    page = 1,
    limit = 20,
  ) {
    this.ensureSupportedCatalogSource(source);
    const pagination = this.getPagination(page, limit);
    const where = this.buildAdminCatalogWhere({ source, search, category });

    const [items, total] = await Promise.all([
      this.prisma.catalogItem.findMany({
        where,
        orderBy: [{ is_active: 'desc' }, { category: 'asc' }, { id: 'asc' }],
        skip: pagination.offset,
        take: pagination.limit,
      }),
      this.prisma.catalogItem.count({ where }),
    ]);

    return this.paginateItems(
      items,
      total,
      pagination.page,
      pagination.limit,
      0,
    );
  }

  /**
   * Retrieve active category counts for one supported catalog source.
   */
  async getAdminCatalogCategories(source: CatalogSource) {
    this.ensureSupportedCatalogSource(source);

    const [categories, rows] = await Promise.all([
      this.getActiveCatalogCategoryRows(source),
      this.prisma.catalogItem.groupBy({
        by: ['category'],
        where: {
          source,
          is_active: true,
        },
        _count: { id: true },
        orderBy: { category: 'asc' },
      }),
    ]);

    const existingCounts = new Map(rows.map((row) => [row.category, row._count.id]));

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      category: category.name,
      count: existingCounts.get(category.name) || 0,
    }));
  }

  async createAdminCatalogCategory(dto: CreateAdminCatalogCategoryDto) {
    const source = dto.source;
    this.ensureSupportedCatalogSource(source);
    const name = this.normalizeCategoryName(dto.name);

    const existing = await this.prisma.catalogCategory.findUnique({
      where: { source_name: { source, name } },
    });

    if (existing && !existing.deleted_at) {
      throw new BadRequestException('Category already exists for source');
    }

    if (existing) {
      return this.prisma.catalogCategory.update({
        where: { id: existing.id },
        data: { deleted_at: null },
      });
    }

    return this.prisma.catalogCategory.create({
      data: { source, name },
    });
  }

  async updateAdminCatalogCategory(
    id: number,
    dto: UpdateAdminCatalogCategoryDto,
  ) {
    const category = await this.findCatalogCategory(id);
    const newName = this.normalizeCategoryName(dto.name);
    if (newName === category.name) return category;

    const duplicate = await this.prisma.catalogCategory.findUnique({
      where: { source_name: { source: category.source, name: newName } },
    });
    if (duplicate && !duplicate.deleted_at) {
      throw new BadRequestException('Category already exists for source');
    }

    return this.prisma.$transaction(async (tx) => {
      if (duplicate) {
        await tx.catalogCategory.delete({ where: { id: duplicate.id } });
      }

      const updated = await tx.catalogCategory.update({
        where: { id },
        data: { name: newName },
      });

      await tx.catalogItem.updateMany({
        where: {
          source: category.source,
          category: category.name,
        },
        data: { category: newName },
      });

      return updated;
    });
  }

  async deleteAdminCatalogCategory(id: number) {
    const category = await this.findCatalogCategory(id);

    const productCount = await this.prisma.catalogItem.count({
      where: {
        source: category.source,
        category: category.name,
        is_active: true,
      },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        'Category cannot be deleted while products are listed under it',
      );
    }

    await this.prisma.catalogCategory.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    return { success: true };
  }

  async getTenantProductCategories(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return this.runWithTenantRls(tenantId, async (tx) => {
      const [categories, productRows] = await Promise.all([
        tx.tenantProductCategory.findMany({
          where: { tenant_id: tenantId, deleted_at: null },
          orderBy: { name: 'asc' },
        }),
        tx.product.groupBy({
          by: ['category'],
          where: { tenant_id: tenantId, deleted_at: null },
          _count: { id: true },
        }),
      ]);

      const counts = new Map(productRows.map((row) => [row.category, row._count.id]));
      return categories.map((category) => ({
        id: category.id,
        name: category.name,
        count: counts.get(category.name) || 0,
      }));
    });
  }

  async createTenantProductCategory(
    tenantId: number,
    dto: CreateTenantProductCategoryDto,
  ) {
    const name = this.normalizeCategoryName(dto.name);

    return this.runWithTenantRls(tenantId, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) throw new NotFoundException('Tenant not found');

      const existing = await tx.tenantProductCategory.findUnique({
        where: { tenant_id_name: { tenant_id: tenantId, name } },
      });
      if (existing && !existing.deleted_at) {
        throw new BadRequestException('Category already exists for tenant');
      }
      if (existing) {
        return tx.tenantProductCategory.update({
          where: { id: existing.id },
          data: { deleted_at: null },
        });
      }

      return tx.tenantProductCategory.create({
        data: { tenant_id: tenantId, name },
      });
    });
  }

  async updateTenantProductCategory(
    tenantId: number,
    id: number,
    dto: UpdateTenantProductCategoryDto,
  ) {
    const newName = this.normalizeCategoryName(dto.name);

    return this.runWithTenantRls(tenantId, async (tx) => {
      const category = await tx.tenantProductCategory.findFirst({
        where: { id, tenant_id: tenantId, deleted_at: null },
      });
      if (!category) throw new NotFoundException('Category not found');
      if (newName === category.name) return category;

      const duplicate = await tx.tenantProductCategory.findUnique({
        where: { tenant_id_name: { tenant_id: tenantId, name: newName } },
      });
      if (duplicate && !duplicate.deleted_at) {
        throw new BadRequestException('Category already exists for tenant');
      }
      if (duplicate) {
        await tx.tenantProductCategory.delete({ where: { id: duplicate.id } });
      }

      const updated = await tx.tenantProductCategory.update({
        where: { id },
        data: { name: newName },
      });

      await tx.product.updateMany({
        where: {
          tenant_id: tenantId,
          category: category.name,
          deleted_at: null,
        },
        data: { category: newName },
      });

      return updated;
    });
  }

  async deleteTenantProductCategory(tenantId: number, id: number) {
    return this.runWithTenantRls(tenantId, async (tx) => {
      const category = await tx.tenantProductCategory.findFirst({
        where: { id, tenant_id: tenantId, deleted_at: null },
      });
      if (!category) throw new NotFoundException('Category not found');

      const productCount = await tx.product.count({
        where: {
          tenant_id: tenantId,
          category: category.name,
          deleted_at: null,
        },
      });

      if (productCount > 0) {
        throw new BadRequestException(
          'Category cannot be deleted while products are listed under it',
        );
      }

      await tx.tenantProductCategory.update({
        where: { id },
        data: { deleted_at: new Date() },
      });

      return { success: true };
    });
  }

  /**
   * Create a global catalog item for a supported source.
   */
  async createAdminCatalogItem(
    dto: CreateAdminCatalogItemDto,
    file?: Express.Multer.File,
  ) {
    const source = dto.source;
    this.ensureSupportedCatalogSource(source);

    const name = dto.name?.trim();
    const category = dto.category?.trim();
    if (!name || !category) {
      throw new BadRequestException('Name and category are required');
    }
    await this.ensureActiveCatalogCategory(source, category);

    const imageUrl = file?.path
      ? await this.imageProcessorService.processProductThumbnail(file.path)
      : this.normalizeNullableString(dto.image_url);

    return this.prisma.catalogItem.create({
      data: {
        name,
        category,
        source,
        price: dto.price,
        currency: this.normalizeCurrency(dto.currency),
        image_url: imageUrl,
        external_id: this.normalizeNullableString(dto.external_id),
        is_active: dto.is_active ?? true,
        is_essential: dto.is_essential ?? false,
        essential_sort_order: dto.essential_sort_order,
      },
    });
  }

  /**
   * Update a global catalog item without changing its source.
   */
  async updateAdminCatalogItem(
    id: number,
    dto: UpdateAdminCatalogItemDto,
    file?: Express.Multer.File,
  ) {
    const item = await this.findAdminCatalogItem(id);

    const data: Prisma.CatalogItemUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Name is required');
      data.name = name;
    }
    if (dto.category !== undefined) {
      const category = dto.category.trim();
      await this.ensureActiveCatalogCategory(item.source, category);
      data.category = category;
    }
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.currency !== undefined) {
      data.currency = this.normalizeCurrency(dto.currency);
    }
    if (file?.path) {
      data.image_url = await this.imageProcessorService.processProductThumbnail(
        file.path,
      );
    } else if (dto.image_url !== undefined) {
      data.image_url = this.normalizeNullableString(dto.image_url);
    }
    if (dto.external_id !== undefined) {
      data.external_id = this.normalizeNullableString(dto.external_id);
    }
    if (dto.is_active !== undefined) data.is_active = dto.is_active;
    if (dto.is_essential !== undefined) data.is_essential = dto.is_essential;
    if (dto.essential_sort_order !== undefined) {
      data.essential_sort_order = dto.essential_sort_order;
    }

    const updatedItem = await this.prisma.catalogItem.update({
      where: { id },
      data,
    });

    if (item.image_url && item.image_url !== updatedItem.image_url) {
      await this.imageProcessorService.deleteManagedProductImage(
        item.image_url,
      );
    }

    return updatedItem;
  }

  async bulkUpdateAdminCatalogItems(dto: BulkUpdateAdminCatalogItemsDto) {
    const hasCategory = typeof dto.category === 'string';
    const hasActive = dto.is_active !== undefined;
    const hasEssential = dto.is_essential !== undefined;

    if (!hasCategory && !hasActive && !hasEssential) {
      throw new BadRequestException('At least one bulk action is required');
    }

    const items = await this.prisma.catalogItem.findMany({
      where: { id: { in: dto.ids } },
      select: { id: true, source: true },
    });

    if (items.length !== dto.ids.length) {
      throw new NotFoundException('One or more catalog items were not found');
    }

    const data: Prisma.CatalogItemUpdateManyMutationInput = {};
    if (hasCategory) {
      const category = dto.category?.trim();
      if (!category) throw new BadRequestException('Category is required');

      const sources = Array.from(new Set(items.map((item) => item.source)));
      for (const source of sources) {
        await this.ensureActiveCatalogCategory(source as CatalogSource, category);
      }

      data.category = category;
    }
    if (hasActive) data.is_active = dto.is_active;
    if (hasEssential) data.is_essential = dto.is_essential;

    const result = await this.prisma.catalogItem.updateMany({
      where: { id: { in: dto.ids } },
      data,
    });

    return { success: true, count: result.count };
  }

  /**
   * Deactivate a global catalog item instead of hard deleting it.
   */
  async deleteAdminCatalogItem(id: number) {
    await this.findAdminCatalogItem(id);

    await this.prisma.catalogItem.update({
      where: { id },
      data: { is_active: false },
    });

    return { success: true };
  }

  async getSupermarketEssentials(
    search?: string,
    category?: string,
    page = 1,
    limit = 20,
  ) {
    const pagination = this.getPagination(page, limit);
    const where = this.buildSupermarketCatalogWhere({
      search,
      category,
      isEssential: true,
    });

    const [items, total] = await Promise.all([
      this.prisma.catalogItem.findMany({
        where,
        orderBy: [
          { category: 'asc' },
          { essential_sort_order: { sort: 'asc', nulls: 'last' } },
          { id: 'asc' },
        ],
        skip: pagination.offset,
        take: pagination.limit,
      }),
      this.prisma.catalogItem.count({ where }),
    ]);

    return this.paginateItems(
      items,
      total,
      pagination.page,
      pagination.limit,
      0,
    );
  }

  async getSupermarketCatalogCategories() {
    const allowedCategories = await this.getActiveCatalogCategoryRows(
      CATALOG_SOURCE_TALABAT,
    );
    const allowedCategoryNames = allowedCategories.map((category) => category.name);
    const rows = await this.prisma.catalogItem.groupBy({
      by: ['category'],
      where: {
        is_active: true,
        source: CATALOG_SOURCE_TALABAT,
        category: { in: allowedCategoryNames },
      },
      _count: { id: true },
      orderBy: { category: 'asc' },
    });

    const categories = rows
      .map((row) => row.category?.trim())
      .filter((category): category is string => Boolean(category));

    const catalogRows =
      categories.length > 0
        ? await this.prisma.catalogItem.findMany({
            where: {
              is_active: true,
              source: CATALOG_SOURCE_TALABAT,
              category: { in: categories },
              image_url: { not: null },
            },
            select: { category: true, image_url: true },
            orderBy: [{ category: 'asc' }, { id: 'asc' }],
          })
        : [];

    const categoryImages = new Map<string, string>();
    for (const row of catalogRows) {
      if (row.category && row.image_url && !categoryImages.has(row.category)) {
        categoryImages.set(row.category, row.image_url);
      }
    }

    const existingCounts = new Map(rows.map((row) => [row.category, row._count.id]));

    return allowedCategories.map((category) => ({
      category: category.name,
      count: existingCounts.get(category.name) || 0,
      image_url: categoryImages.get(category.name),
    }));
  }

  async getSupermarketCatalogCandidates(
    search?: string,
    category?: string,
    page = 1,
    limit = 20,
  ) {
    const pagination = this.getPagination(page, limit);
    const where = this.buildSupermarketCatalogWhere({
      search,
      category,
      isEssential: false,
      activeOnly: true,
    });

    const [items, total] = await Promise.all([
      this.prisma.catalogItem.findMany({
        where,
        orderBy: [{ category: 'asc' }, { id: 'asc' }],
        skip: pagination.offset,
        take: pagination.limit,
      }),
      this.prisma.catalogItem.count({ where }),
    ]);

    return this.paginateItems(
      items,
      total,
      pagination.page,
      pagination.limit,
      0,
    );
  }

  async createSupermarketEssential(
    dto: CreateSupermarketEssentialDto,
    file?: Express.Multer.File,
  ) {
    if (dto.catalog_item_id) {
      return this.markCatalogItemAsSupermarketEssential(dto.catalog_item_id);
    }

    const name = dto.name?.trim();
    const category = dto.category?.trim();
    if (!name || !category) {
      throw new BadRequestException('Name and category are required');
    }

    await this.ensureActiveCatalogCategory(CATALOG_SOURCE_TALABAT, category);

    const imageUrl = file?.path
      ? await this.imageProcessorService.processProductThumbnail(file.path)
      : this.normalizeNullableString(dto.image_url);

    return this.prisma.catalogItem.create({
      data: {
        name,
        category,
        price: dto.price,
        image_url: imageUrl,
        source: CATALOG_SOURCE_TALABAT,
        is_active: true,
        is_essential: true,
        essential_sort_order: dto.essential_sort_order,
      },
    });
  }

  async updateSupermarketEssential(
    id: number,
    dto: UpdateSupermarketEssentialDto,
    file?: Express.Multer.File,
  ) {
    const item = await this.findSupermarketCatalogItem(id, true);

    const data: Prisma.CatalogItemUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Name is required');
      data.name = name;
    }
    if (dto.category !== undefined) {
      const category = dto.category.trim();
      await this.ensureActiveCatalogCategory(CATALOG_SOURCE_TALABAT, category);
      data.category = category;
    }
    if (dto.price !== undefined) data.price = dto.price;
    if (file?.path) {
      data.image_url = await this.imageProcessorService.processProductThumbnail(
        file.path,
      );
    } else if (dto.image_url !== undefined) {
      data.image_url = this.normalizeNullableString(dto.image_url);
    }
    if (dto.is_active !== undefined) data.is_active = dto.is_active;
    if (dto.essential_sort_order !== undefined) {
      data.essential_sort_order = dto.essential_sort_order;
    }

    const updatedItem = await this.prisma.catalogItem.update({
      where: { id },
      data,
    });

    if (item.image_url && item.image_url !== updatedItem.image_url) {
      await this.imageProcessorService.deleteManagedProductImage(
        item.image_url,
      );
    }

    return updatedItem;
  }

  async deleteSupermarketEssential(id: number) {
    await this.findSupermarketCatalogItem(id, true);

    await this.prisma.catalogItem.update({
      where: { id },
      data: {
        is_essential: false,
        essential_sort_order: null,
      },
    });

    return { success: true };
  }

  private buildSupermarketCatalogWhere({
    search,
    category,
    isEssential,
    activeOnly = false,
  }: {
    search?: string;
    category?: string;
    isEssential: boolean;
    activeOnly?: boolean;
  }): Prisma.CatalogItemWhereInput {
    const normalizedCategory = category?.trim();

    return {
      source: CATALOG_SOURCE_TALABAT,
      is_essential: isEssential,
      ...(activeOnly ? { is_active: true } : {}),
      ...(normalizedCategory ? { category: normalizedCategory } : {}),
      ...(search?.trim()
        ? {
            name: {
              contains: search.trim(),
              mode: 'insensitive',
            },
          }
        : {}),
    };
  }

  private async markCatalogItemAsSupermarketEssential(id: number) {
    await this.findSupermarketCatalogItem(id, false);

    return this.prisma.catalogItem.update({
      where: { id },
      data: { is_essential: true },
    });
  }

  private async findSupermarketCatalogItem(
    id: number,
    requireEssential: boolean,
  ) {
    const item = await this.prisma.catalogItem.findFirst({
      where: {
        id,
        source: CATALOG_SOURCE_TALABAT,
        ...(requireEssential ? { is_essential: true } : {}),
      },
    });

    if (!item) {
      throw new NotFoundException('Supermarket catalog item not found');
    }

    await this.ensureActiveCatalogCategory(CATALOG_SOURCE_TALABAT, item.category);
    return item;
  }

  private ensureAllowedSupermarketCategory(category: string) {
    if (!isCatalogCategoryAllowedForSource(CATALOG_SOURCE_TALABAT, category)) {
      throw new BadRequestException(
        'Category is not supported for supermarket essentials',
      );
    }
  }

  private buildAdminCatalogWhere({
    source,
    search,
    category,
  }: {
    source: CatalogSource;
    search?: string;
    category?: string;
  }): Prisma.CatalogItemWhereInput {
    const normalizedCategory = category?.trim();

    return {
      source,
      is_active: true,
      ...(normalizedCategory ? { category: normalizedCategory } : {}),
      ...(search?.trim()
        ? {
            name: {
              contains: search.trim(),
              mode: 'insensitive',
            },
          }
        : {}),
    };
  }

  private async findAdminCatalogItem(id: number) {
    const item = await this.prisma.catalogItem.findFirst({
      where: {
        id,
        source: { in: [CATALOG_SOURCE_TALABAT, CATALOG_SOURCE_CHEFAA] },
      },
    });

    if (!item) {
      throw new NotFoundException('Catalog item not found');
    }

    return item;
  }

  private async getActiveCatalogCategoryRows(
    source: CatalogSource,
  ): Promise<{ id: number; name: string }[]> {
    const categories = await this.prisma.catalogCategory.findMany({
      where: { source, deleted_at: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (categories.length > 0) {
      return categories;
    }

    return getAllowedCatalogCategoriesForSource(source).map((name, index) => ({
      id: -1 - index,
      name,
    }));
  }

  private async findCatalogCategory(id: number) {
    const category = await this.prisma.catalogCategory.findFirst({
      where: {
        id,
        source: { in: [CATALOG_SOURCE_TALABAT, CATALOG_SOURCE_CHEFAA] },
        deleted_at: null,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    this.ensureSupportedCatalogSource(category.source);
    return category;
  }

  private ensureSupportedCatalogSource(
    source: string,
  ): asserts source is CatalogSource {
    if (source !== CATALOG_SOURCE_TALABAT && source !== CATALOG_SOURCE_CHEFAA) {
      throw new BadRequestException('Catalog source is not supported');
    }
  }

  private ensureAllowedCatalogCategory(source: string, category: string) {
    if (!isCatalogCategoryAllowedForSource(source, category)) {
      throw new BadRequestException('Category is not supported for source');
    }
  }

  private async ensureActiveCatalogCategory(source: string, category: string) {
    this.ensureSupportedCatalogSource(source);
    const normalizedCategory = this.normalizeCategoryName(category);

    const persisted = await this.prisma.catalogCategory.findFirst({
      where: {
        source,
        name: normalizedCategory,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (persisted) return;

    if (!isCatalogCategoryAllowedForSource(source, normalizedCategory)) {
      throw new BadRequestException('Category is not supported for source');
    }
  }

  private normalizeCategoryName(name?: string | null) {
    const normalized = name?.trim().slice(0, 64);
    if (!normalized) {
      throw new BadRequestException('Category name is required');
    }

    return normalized;
  }

  private normalizeNullableString(value?: string | null) {
    const normalized = value?.trim();
    return normalized || null;
  }

  private normalizeCurrency(value?: string | null) {
    const normalized = value?.trim().toUpperCase();
    return normalized || 'EGP';
  }

  // Products Management
  async getProducts(
    tenantName?: string,
    productName?: string,
    tenantCategory?: TenantCategory,
    page = 1,
    limit = 20,
  ) {
    const pagination = this.getPagination(page, limit);
    const tenantWhere: Prisma.TenantWhereInput = {};
    if (tenantName) {
      tenantWhere.name = { contains: tenantName, mode: 'insensitive' };
    }
    if (tenantCategory) {
      tenantWhere.category = tenantCategory;
    }

    const tenants = await this.prisma.tenant.findMany({
      where: Object.keys(tenantWhere).length > 0 ? tenantWhere : undefined,
      orderBy: { created_at: 'desc' },
    });

    const where: Prisma.ProductWhereInput = {};
    if (productName) {
      where.name = { contains: productName, mode: 'insensitive' };
    }

    const tenantResults = await Promise.all(
      tenants.map((tenant) =>
        this.runWithTenantRls(tenant.id, async (tx) => {
          const tenantWhere = {
            ...where,
            tenant_id: tenant.id,
          };
          const [data, total] = await Promise.all([
            tx.product.findMany({
              where: tenantWhere,
              include: {
                tenant: true,
              },
              orderBy: { created_at: 'desc' },
              take: pagination.prefetch,
            }),
            tx.product.count({ where: tenantWhere }),
          ]);

          return { data, total };
        }),
      ),
    );

    const total = tenantResults.reduce((sum, result) => sum + result.total, 0);
    const items = tenantResults
      .flatMap((result) => result.data)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    return this.paginateItems(
      items,
      total,
      pagination.page,
      pagination.limit,
      pagination.offset,
    );
  }

  // Orders Management
  async getOrders(
    clientName?: string,
    totalCost?: number,
    page = 1,
    limit = 20,
  ) {
    const pagination = this.getPagination(page, limit);
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { created_at: 'desc' },
    });

    const where: Prisma.OrderWhereInput = {};
    if (clientName) {
      where.customer_name = { contains: clientName, mode: 'insensitive' };
    }
    if (totalCost !== undefined) {
      where.total = totalCost;
    }

    const tenantResults = await Promise.all(
      tenants.map((tenant) =>
        this.runWithTenantRls(tenant.id, async (tx) => {
          const tenantWhere = {
            ...where,
            tenant_id: tenant.id,
          };
          const [data, total] = await Promise.all([
            tx.order.findMany({
              where: tenantWhere,
              include: {
                tenant: true,
              },
              orderBy: { created_at: 'desc' },
              take: pagination.prefetch,
            }),
            tx.order.count({ where: tenantWhere }),
          ]);

          return { data, total };
        }),
      ),
    );

    const total = tenantResults.reduce((sum, result) => sum + result.total, 0);
    const items = tenantResults
      .flatMap((result) => result.data)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    return this.paginateItems(
      items,
      total,
      pagination.page,
      pagination.limit,
      pagination.offset,
    );
  }
}
