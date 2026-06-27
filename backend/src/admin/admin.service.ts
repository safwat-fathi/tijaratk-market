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
import { Prisma, TenantStatus } from '../../generated/prisma/client';
import { TenantCancellationPolicyService } from 'src/tenant-cancellation-policy/tenant-cancellation-policy.service';
import { ImageProcessorService } from 'src/common/services/image-processor.service';
import {
  CATALOG_SOURCE_TALABAT,
  buildAllowedCatalogCategoryWhere,
  isCatalogCategoryAllowedForSource,
} from 'src/products/catalog-source-policy';
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
    const rows = await this.prisma.catalogItem.groupBy({
      by: ['category'],
      where: {
        is_active: true,
        source: CATALOG_SOURCE_TALABAT,
        category: buildAllowedCatalogCategoryWhere(CATALOG_SOURCE_TALABAT),
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

    return rows.map((row) => ({
      category: row.category,
      count: row._count.id,
      image_url: categoryImages.get(row.category),
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

    this.ensureAllowedSupermarketCategory(category);

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
      this.ensureAllowedSupermarketCategory(category);
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
    if (normalizedCategory) {
      this.ensureAllowedSupermarketCategory(normalizedCategory);
    }

    return {
      source: CATALOG_SOURCE_TALABAT,
      is_essential: isEssential,
      ...(activeOnly ? { is_active: true } : {}),
      category: normalizedCategory
        ? normalizedCategory
        : buildAllowedCatalogCategoryWhere(CATALOG_SOURCE_TALABAT),
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

    this.ensureAllowedSupermarketCategory(item.category);
    return item;
  }

  private ensureAllowedSupermarketCategory(category: string) {
    if (!isCatalogCategoryAllowedForSource(CATALOG_SOURCE_TALABAT, category)) {
      throw new BadRequestException(
        'Category is not supported for supermarket essentials',
      );
    }
  }

  private normalizeNullableString(value?: string | null) {
    const normalized = value?.trim();
    return normalized || null;
  }

  // Products Management
  async getProducts(
    tenantName?: string,
    productName?: string,
    page = 1,
    limit = 20,
  ) {
    const pagination = this.getPagination(page, limit);
    const tenants = await this.prisma.tenant.findMany({
      where: tenantName
        ? { name: { contains: tenantName, mode: 'insensitive' } }
        : undefined,
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
