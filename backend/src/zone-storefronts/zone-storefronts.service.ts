import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminRole,
  Prisma,
  ProductSource,
  ProductStatus,
  TenantCategory,
  TenantStatus,
} from '../../generated/prisma/client';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { ActivityActions } from 'src/activity-log/constants/activity-actions';
import {
  ActivityEntityTypes,
  ActivitySources,
} from 'src/activity-log/constants/activity-types';
import { DbTenantContext } from 'src/common/contexts/db-tenant.context';
import {
  CatalogSource,
  getAllowedCatalogCategoriesForSource,
  resolveCatalogSourceForTenantCategory,
  TENANT_CATEGORIES_WITH_CATALOG_SOURCE,
} from 'src/products/catalog-source-policy';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateZoneStorefrontDto,
  UpdateZoneStorefrontActivationDto,
  UpsertZoneStorefrontMerchantDto,
} from './dto/zone-storefront.dto';
import { isZoneStorefrontPublicOrderingEnabled } from './zone-storefront-feature';
import {
  findZoneEssentialCatalogItems,
  syncZoneEssentialCatalog,
} from './zone-essential-catalog-sync';

const MIN_SYNCHRONIZED_ZONE_PRODUCTS = 1;

export type ZoneAdminActor = {
  adminId: number;
  adminName: string;
  adminRole: AdminRole;
  requestId?: string | null;
  ipAddress?: string | null;
};

type PublicProductQuery = {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
};

type ZoneReadiness = {
  catalog_ready: boolean;
  active_products: number;
  active_eligible_merchants: number;
  required_products?: number;
  catalog_source?: CatalogSource;
};

type AdminZoneRecord = {
  id: number;
  name: string;
  slug: string;
  operations_phone: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  area: {
    id: number;
    name_ar: string;
    name_en: string | null;
    slug: string;
    is_active: boolean;
  };
  operator_tenant: {
    id: number;
    name: string;
    category: TenantCategory;
    status: TenantStatus;
    delivery_fee: Prisma.Decimal;
  };
  merchants?: unknown[];
};

/** Manages zone configuration and sanitized public catalog discovery. */
@Injectable()
export class ZoneStorefrontsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  /** Returns whether new public zone discovery and checkout are enabled. */
  isPublicOrderingEnabled(): boolean {
    return isZoneStorefrontPublicOrderingEnabled();
  }

  /** Creates an internal operator tenant and its one-to-one zone storefront. */
  async create(
    dto: CreateZoneStorefrontDto,
    actor: ZoneAdminActor,
  ) {
    const name = dto.name.trim();
    const slug = dto.slug.trim().toLowerCase();
    const catalogSource = resolveCatalogSourceForTenantCategory(dto.category);
    if (!catalogSource) {
      throw new BadRequestException(
        'Zone storefronts support grocery and pharmacy categories only',
      );
    }

    const [area, existingZone, conflictingTenant] = await Promise.all([
      this.prisma.directoryArea.findFirst({
        where: { id: dto.area_id, is_active: true, deleted_at: null },
        select: { id: true },
      }),
      this.prisma.zoneStorefront.findFirst({
        where: { OR: [{ area_id: dto.area_id }, { slug }] },
        select: { id: true },
      }),
      this.prisma.tenant.findUnique({
        where: { slug: this.buildOperatorSlug(slug) },
        select: { id: true },
      }),
    ]);

    if (!area) throw new NotFoundException('Directory area not found');
    if (existingZone) {
      throw new ConflictException('Area or storefront slug is already in use');
    }
    if (conflictingTenant) {
      throw new ConflictException('Internal operator slug is already in use');
    }

    return this.prisma.$transaction(async (manager) => {
      const operatorTenant = await manager.tenant.create({
        data: {
          name,
          slug: this.buildOperatorSlug(slug),
          phone: this.buildOperatorPhone(slug),
          category: dto.category,
          status: TenantStatus.active,
          delivery_fee: dto.delivery_fee ?? 20,
          delivery_available: true,
          onboarding_completed: true,
          onboarding_step: 4,
        },
      });

      await manager.tenantDeliveryArea.create({
        data: {
          tenant_id: operatorTenant.id,
          area_id: dto.area_id,
          is_active: true,
        },
      });

      const zone = await manager.zoneStorefront.create({
        data: {
          name,
          slug,
          operations_phone: dto.operations_phone.trim(),
          area_id: dto.area_id,
          operator_tenant_id: operatorTenant.id,
          is_active: false,
        },
        include: { area: true, operator_tenant: true },
      });

      await manager.$executeRaw`SELECT set_config('app.tenant_id', ${String(operatorTenant.id)}, true)`;
      await this.activityLogService.create(
        {
          tenantId: operatorTenant.id,
          actorAdminId: actor.adminId,
          actorAdminName: actor.adminName,
          actorAdminRole: actor.adminRole,
          entityType: ActivityEntityTypes.ZoneStorefront,
          entityId: zone.id,
          action: ActivityActions.ZoneStorefrontCreated,
          title: 'تم إنشاء واجهة منطقة مركزية',
          newValues: {
            area_id: zone.area_id,
            slug: zone.slug,
            category: operatorTenant.category,
            catalog_source: catalogSource,
          },
          source: ActivitySources.Admin,
          requestId: actor.requestId,
          ipAddress: actor.ipAddress,
        },
        manager,
      );

      return this.mapAdminZone(zone, {
        catalog_ready: false,
        active_eligible_merchants: 0,
        active_products: 0,
      });
    });
  }

  /** Lists configured zones with catalog and assignment readiness. */
  async findAllForAdmin() {
    const zones = await this.prisma.zoneStorefront.findMany({
      include: {
        area: true,
        operator_tenant: true,
        merchants: {
          include: { tenant: { select: { id: true, name: true, status: true } } },
          orderBy: [{ priority: 'desc' }, { id: 'asc' }],
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return Promise.all(
      zones.map(async (zone) =>
        this.mapAdminZone(zone, await this.getReadiness(zone.id)),
      ),
    );
  }

  /** Returns one zone and its membership history for platform administration. */
  async findOneForAdmin(zoneId: number) {
    const zone = await this.prisma.zoneStorefront.findUnique({
      where: { id: zoneId },
      include: {
        area: true,
        operator_tenant: true,
        merchants: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                category: true,
              },
            },
          },
          orderBy: [{ priority: 'desc' }, { id: 'asc' }],
        },
      },
    });
    if (!zone) throw new NotFoundException('Zone storefront not found');

    return this.mapAdminZone(zone, await this.getReadiness(zone.id));
  }

  /** Reconciles the operator snapshot with the complete curated essential set. */
  async syncEssentialCatalog(zoneId: number, actor: ZoneAdminActor) {
    const zone = await this.requireZone(zoneId);
    const catalogSource = this.requireCatalogSource(
      zone.operator_tenant.category,
    );
    const essentialItems = await findZoneEssentialCatalogItems(
      this.prisma,
      catalogSource,
    );
    if (essentialItems.length === 0) {
      throw new BadRequestException(
        'No active curated essential catalog items are available for this zone',
      );
    }

    return this.runInOperatorTenant(
      zone.operator_tenant_id,
      async (manager) => {
        const result = await syncZoneEssentialCatalog(
          manager,
          zone.operator_tenant_id,
          catalogSource,
          essentialItems,
        );
        await this.activityLogService.create(
          {
            tenantId: zone.operator_tenant_id,
            actorAdminId: actor.adminId,
            actorAdminName: actor.adminName,
            actorAdminRole: actor.adminRole,
            entityType: ActivityEntityTypes.ZoneStorefront,
            entityId: zone.id,
            action: ActivityActions.ZoneStorefrontCatalogSynced,
            title: 'تمت مزامنة المنتجات الأساسية للمنطقة',
            newValues: result,
            metadata: {
              catalog_source: catalogSource,
              curated_essentials: essentialItems.length,
            },
            source: ActivitySources.Admin,
            requestId: actor.requestId,
            ipAddress: actor.ipAddress,
          },
          manager,
        );
        return result;
      },
      { maxWait: 10_000, timeout: 120_000 },
    );
  }

  /** Changes zone activation after validating catalog and merchant readiness. */
  async updateActivation(
    zoneId: number,
    dto: UpdateZoneStorefrontActivationDto,
    actor: ZoneAdminActor,
  ) {
    const zone = await this.requireZone(zoneId);
    if (dto.is_active) {
      if (
        zone.operator_tenant.status !== TenantStatus.active ||
        zone.operator_tenant.delivery_available !== true ||
        !resolveCatalogSourceForTenantCategory(zone.operator_tenant.category)
      ) {
        throw new BadRequestException('Zone operator is not ready for ordering');
      }
      const readiness = await this.getReadiness(zone.id);
      if (!readiness.catalog_ready) {
        throw new BadRequestException('Zone catalog is not ready');
      }
      if (readiness.active_eligible_merchants < 1) {
        throw new BadRequestException(
          'At least one eligible active merchant is required',
        );
      }
    }

    await this.runInOperatorTenant(zone.operator_tenant_id, async (manager) => {
      await manager.zoneStorefront.update({
        where: { id: zone.id },
        data: { is_active: dto.is_active },
      });
      await this.activityLogService.create(
        {
          tenantId: zone.operator_tenant_id,
          actorAdminId: actor.adminId,
          actorAdminName: actor.adminName,
          actorAdminRole: actor.adminRole,
          entityType: ActivityEntityTypes.ZoneStorefront,
          entityId: zone.id,
          action: ActivityActions.ZoneStorefrontActivationChanged,
          title: dto.is_active
            ? 'تم تفعيل واجهة المنطقة'
            : 'تم إيقاف واجهة المنطقة',
          oldValues: { is_active: zone.is_active },
          newValues: { is_active: dto.is_active },
          source: ActivitySources.Admin,
          requestId: actor.requestId,
          ipAddress: actor.ipAddress,
        },
        manager,
      );
    });

    return this.findOneForAdmin(zoneId);
  }

  /** Upserts a membership without deleting prior operational history. */
  async upsertMerchant(
    zoneId: number,
    dto: UpsertZoneStorefrontMerchantDto,
    actor: ZoneAdminActor,
  ) {
    const zone = await this.requireZone(zoneId);
    if (dto.tenant_id === zone.operator_tenant_id) {
      throw new BadRequestException('The operator tenant cannot fulfill itself');
    }
    if (dto.is_active !== false) {
      await this.requireEligibleMerchant(zoneId, dto.tenant_id, false);
    }

    await this.runInOperatorTenant(zone.operator_tenant_id, async (manager) => {
      const membership = await manager.zoneStorefrontMerchant.upsert({
        where: {
          zone_storefront_id_tenant_id: {
            zone_storefront_id: zone.id,
            tenant_id: dto.tenant_id,
          },
        },
        create: {
          zone_storefront_id: zone.id,
          tenant_id: dto.tenant_id,
          priority: dto.priority ?? 0,
          is_active: dto.is_active ?? true,
        },
        update: {
          priority: dto.priority,
          is_active: dto.is_active,
        },
      });

      await this.activityLogService.create(
        {
          tenantId: zone.operator_tenant_id,
          actorAdminId: actor.adminId,
          actorAdminName: actor.adminName,
          actorAdminRole: actor.adminRole,
          entityType: ActivityEntityTypes.ZoneStorefront,
          entityId: zone.id,
          action: ActivityActions.ZoneStorefrontMerchantChanged,
          title: 'تم تحديث عضوية متجر في المنطقة',
          newValues: {
            tenant_id: membership.tenant_id,
            priority: membership.priority,
            is_active: membership.is_active,
          },
          source: ActivitySources.Admin,
          requestId: actor.requestId,
          ipAddress: actor.ipAddress,
        },
        manager,
      );
    });

    return this.findOneForAdmin(zoneId);
  }

  /** Lists currently eligible merchants that may be added or assigned. */
  async findEligibleMerchants(zoneId: number) {
    const zone = await this.requireZone(zoneId);
    const tenants = await this.prisma.tenant.findMany({
      where: {
        id: { not: zone.operator_tenant_id },
        category: zone.operator_tenant.category,
        status: TenantStatus.active,
        deleted_at: null,
        delivery_available: true,
        operated_zone_storefront: { is: null },
        tenant_delivery_areas: {
          some: {
            area_id: zone.area_id,
            is_active: true,
            deleted_at: null,
          },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        zone_storefront_memberships: {
          where: { zone_storefront_id: zone.id },
          select: { id: true, is_active: true, priority: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      category: tenant.category,
      membership: tenant.zone_storefront_memberships[0] ?? null,
    }));
  }

  /** Resolves and sanitizes a public storefront while enforcing the feature flag. */
  async findPublicBySlug(slug: string) {
    const zone = await this.requirePublicZone(slug);
    return this.mapPublicZone(zone);
  }

  /** Lists sanitized active and ready storefronts for public discovery. */
  async findPublic() {
    if (!this.isPublicOrderingEnabled()) return [];

    const zones = await this.prisma.zoneStorefront.findMany({
      where: {
        is_active: true,
        area: { is_active: true, deleted_at: null },
        operator_tenant: {
          status: TenantStatus.active,
          deleted_at: null,
          delivery_available: true,
          category: { in: [...TENANT_CATEGORIES_WITH_CATALOG_SOURCE] },
        },
      },
      include: { area: true, operator_tenant: true },
      orderBy: [
        { area: { sort_order: 'asc' } },
        { name: 'asc' },
        { id: 'asc' },
      ],
    });

    const publicZones = await Promise.all(
      zones.map(async (zone) => {
        const readiness = await this.calculateReadiness(zone);
        return readiness.catalog_ready &&
          readiness.active_eligible_merchants >= 1
          ? this.mapPublicZone(zone)
          : null;
      }),
    );

    return publicZones.filter((zone) => zone !== null);
  }

  /** Returns the trusted active zone identity used only by public checkout. */
  async requireCheckoutZone(slug: string) {
    return this.requirePublicZone(slug);
  }

  /** Returns sanitized operator catalog products scoped by the zone vertical. */
  async findPublicProducts(slug: string, query: PublicProductQuery) {
    const zone = await this.requirePublicZone(slug);
    const catalogSource = this.requireCatalogSource(zone.operator_tenant.category);
    const allowedCategories = getAllowedCatalogCategoriesForSource(catalogSource);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const search = query.search?.trim();
    const category = query.category?.trim();

    return this.runInOperatorTenant(zone.operator_tenant_id, async (manager) => {
      const where: Prisma.ProductWhereInput = {
        tenant_id: zone.operator_tenant_id,
        catalog_item_id: { not: null },
        source: ProductSource.catalog,
        status: ProductStatus.active,
        is_available: true,
        deleted_at: null,
        category: category
          ? allowedCategories.includes(category)
            ? category
            : { in: [] }
          : { in: allowedCategories },
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      };
      const [products, total] = await Promise.all([
        manager.product.findMany({
          where,
          select: {
            id: true,
            name: true,
            image_url: true,
            category: true,
            current_price: true,
            source: true,
            status: true,
            order_mode: true,
            order_config: true,
            is_available: true,
          },
          orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        manager.product.count({ where }),
      ]);
      const lastPage = Math.max(1, Math.ceil(total / limit));
      return {
        data: products,
        meta: {
          total,
          page,
          limit,
          last_page: lastPage,
          has_next: page < lastPage,
        },
      };
    });
  }

  /** Returns public category summaries without leaking operator tenant details. */
  async findPublicCategories(slug: string) {
    const zone = await this.requirePublicZone(slug);
    const catalogSource = this.requireCatalogSource(zone.operator_tenant.category);
    const allowedCategories = getAllowedCatalogCategoriesForSource(catalogSource);
    const rows = await this.runInOperatorTenant(
      zone.operator_tenant_id,
      (manager) =>
        manager.product.groupBy({
          by: ['category'],
          where: {
            tenant_id: zone.operator_tenant_id,
            catalog_item_id: { not: null },
            source: ProductSource.catalog,
            status: ProductStatus.active,
            is_available: true,
            deleted_at: null,
            category: { in: allowedCategories },
          },
          _count: { id: true },
          orderBy: { category: 'asc' },
        }),
    );
    const images = await this.prisma.catalogCategory.findMany({
      where: {
        source: catalogSource,
        deleted_at: null,
        name: { in: rows.map((row) => row.category) },
      },
      select: { name: true, image_url: true },
    });
    const imageByName = new Map(images.map((row) => [row.name, row.image_url]));
    return rows.map((row) => ({
      category: row.category,
      count: row._count.id,
      image_url: imageByName.get(row.category) ?? null,
    }));
  }

  /** Validates all assignment invariants and returns the active membership. */
  async requireEligibleMerchant(
    zoneId: number,
    tenantId: number,
    requireMembership = true,
  ) {
    const zone = await this.requireZone(zoneId);
    const merchant = await this.prisma.tenant.findFirst({
      where: {
        id: tenantId,
        status: TenantStatus.active,
        deleted_at: null,
        delivery_available: true,
        category: zone.operator_tenant.category,
        operated_zone_storefront: { is: null },
        tenant_delivery_areas: {
          some: {
            area_id: zone.area_id,
            is_active: true,
            deleted_at: null,
          },
        },
        ...(requireMembership
          ? {
              zone_storefront_memberships: {
                some: { zone_storefront_id: zone.id, is_active: true },
              },
            }
          : {}),
      },
      select: { id: true, name: true, phone: true, category: true },
    });
    if (!merchant) {
      throw new BadRequestException('Merchant is not eligible for this zone');
    }
    return merchant;
  }

  /** Returns a configured zone with operator identity for trusted workflows. */
  async requireZone(zoneId: number) {
    const zone = await this.prisma.zoneStorefront.findUnique({
      where: { id: zoneId },
      include: { area: true, operator_tenant: true },
    });
    if (!zone) throw new NotFoundException('Zone storefront not found');
    return zone;
  }

  /** Runs tenant-owned work under the operator tenant's PostgreSQL RLS context. */
  async runInOperatorTenant<T>(
    operatorTenantId: number,
    callback: (manager: Prisma.TransactionClient) => Promise<T>,
    transactionOptions?: { maxWait?: number; timeout?: number },
  ): Promise<T> {
    return this.prisma.$transaction(
      async (manager) => {
        await manager.$executeRaw`SELECT set_config('app.tenant_id', ${String(operatorTenantId)}, true)`;
        return DbTenantContext.run(
          { tenantId: operatorTenantId, manager },
          () => callback(manager),
        );
      },
      transactionOptions,
    );
  }

  /** Resolves an active, ready public zone and rejects disabled discovery. */
  private async requirePublicZone(slug: string) {
    if (!this.isPublicOrderingEnabled()) {
      throw new NotFoundException('Zone storefront not found');
    }
    const zone = await this.prisma.zoneStorefront.findFirst({
      where: {
        slug: slug.trim().toLowerCase(),
        is_active: true,
        area: { is_active: true, deleted_at: null },
        operator_tenant: {
          status: TenantStatus.active,
          deleted_at: null,
          delivery_available: true,
          category: { in: [...TENANT_CATEGORIES_WITH_CATALOG_SOURCE] },
        },
      },
      include: { area: true, operator_tenant: true },
    });
    if (!zone) throw new NotFoundException('Zone storefront not found');

    const readiness = await this.getReadiness(zone.id);
    if (!readiness.catalog_ready || readiness.active_eligible_merchants < 1) {
      throw new ForbiddenException('Zone storefront is not ready');
    }
    return zone;
  }

  /** Computes catalog and fulfillment readiness from authoritative backend state. */
  private async getReadiness(zoneId: number) {
    const zone = await this.requireZone(zoneId);
    return this.calculateReadiness(zone);
  }

  /** Computes readiness for an already loaded zone without repeating its lookup. */
  private async calculateReadiness(
    zone: Awaited<ReturnType<ZoneStorefrontsService['requireZone']>>,
  ) {
    const catalogSource = this.requireCatalogSource(zone.operator_tenant.category);
    const allowedCategories = getAllowedCatalogCategoriesForSource(catalogSource);
    const requiredProducts = MIN_SYNCHRONIZED_ZONE_PRODUCTS;
    const activeProducts = await this.runInOperatorTenant(
      zone.operator_tenant_id,
      (manager) =>
        manager.product.count({
          where: {
            tenant_id: zone.operator_tenant_id,
            catalog_item_id: { not: null },
            source: ProductSource.catalog,
            status: ProductStatus.active,
            is_available: true,
            deleted_at: null,
            category: { in: allowedCategories },
          },
        }),
    );
    const activeEligibleMerchants = await this.prisma.zoneStorefrontMerchant.count({
      where: {
        zone_storefront_id: zone.id,
        is_active: true,
        tenant: {
          status: TenantStatus.active,
          deleted_at: null,
          delivery_available: true,
          category: zone.operator_tenant.category,
          operated_zone_storefront: { is: null },
          tenant_delivery_areas: {
            some: {
              area_id: zone.area_id,
              is_active: true,
              deleted_at: null,
            },
          },
        },
      },
    });
    return {
      catalog_ready: activeProducts >= requiredProducts,
      active_products: activeProducts,
      required_products: requiredProducts,
      active_eligible_merchants: activeEligibleMerchants,
      catalog_source: catalogSource,
    };
  }

  /** Builds the private slug used only by trusted operator-tenant workflows. */
  private buildOperatorSlug(publicSlug: string): string {
    return `zone-operator-${publicSlug}`;
  }

  /** Builds a unique non-customer-facing identity for the userless operator. */
  private buildOperatorPhone(publicSlug: string): string {
    return `internal-zone:${publicSlug}`;
  }

  /** Rejects unsupported zone verticals through the centralized source policy. */
  private requireCatalogSource(category: TenantCategory) {
    const source = resolveCatalogSourceForTenantCategory(category);
    if (!source) {
      throw new BadRequestException('Unsupported zone storefront category');
    }
    return source;
  }

  /** Maps a zone to its explicit customer-safe response contract. */
  private mapPublicZone(
    zone: Awaited<ReturnType<ZoneStorefrontsService['requireZone']>>,
  ) {
    return {
      id: zone.id,
      name: zone.name,
      slug: zone.slug,
      category: zone.operator_tenant.category,
      delivery_fee: zone.operator_tenant.delivery_fee,
      delivery_available: zone.operator_tenant.delivery_available,
      delivery_starts_at: zone.operator_tenant.delivery_starts_at,
      delivery_ends_at: zone.operator_tenant.delivery_ends_at,
      card_on_delivery_available:
        zone.operator_tenant.card_on_delivery_available,
      area: {
        id: zone.area.id,
        name_ar: zone.area.name_ar,
        name_en: zone.area.name_en,
        slug: zone.area.slug,
      },
    };
  }

  /** Maps trusted admin details and readiness without exposing tenant credentials. */
  private mapAdminZone(zone: AdminZoneRecord, readiness: ZoneReadiness) {
    return {
      id: zone.id,
      name: zone.name,
      slug: zone.slug,
      operations_phone: zone.operations_phone,
      is_active: zone.is_active,
      created_at: zone.created_at,
      updated_at: zone.updated_at,
      area: zone.area,
      operator_tenant: {
        id: zone.operator_tenant.id,
        name: zone.operator_tenant.name,
        category: zone.operator_tenant.category,
        status: zone.operator_tenant.status,
        delivery_fee: zone.operator_tenant.delivery_fee,
      },
      merchants: zone.merchants ?? [],
      readiness,
    };
  }
}
