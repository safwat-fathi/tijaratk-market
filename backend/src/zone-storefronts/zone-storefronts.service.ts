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
  findActiveCatalogCategoryNamesForSource,
  resolveCatalogSourceForTenantCategory,
  TENANT_CATEGORIES_WITH_CATALOG_SOURCE,
} from 'src/products/catalog-source-policy';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateZoneStorefrontDto,
  UpdateZoneDeliveryFeesDto,
  UpdateZoneStorefrontActivationDto,
  UpsertZoneStorefrontMerchantDto,
} from './dto/zone-storefront.dto';
import { isZoneStorefrontPublicOrderingEnabled } from './zone-storefront-feature';
import {
  findZoneEssentialCatalogItems,
  syncZoneEssentialCatalog,
} from './zone-essential-catalog-sync';
import { enqueueZoneCatalogReconciliation } from './zone-catalog-reconciliation.repository';

const MIN_SYNCHRONIZED_ZONE_PRODUCTS = 1;

const ZONE_AREA_CATEGORY_CONFLICT = 'ZONE_AREA_CATEGORY_CONFLICT';
const ZONE_SLUG_CONFLICT = 'ZONE_SLUG_CONFLICT';
const ZONE_OPERATOR_SLUG_CONFLICT = 'ZONE_OPERATOR_SLUG_CONFLICT';
const ZONE_CREATE_CONFLICT = 'ZONE_CREATE_CONFLICT';

type ZoneCreateConflictCode =
  | typeof ZONE_AREA_CATEGORY_CONFLICT
  | typeof ZONE_SLUG_CONFLICT
  | typeof ZONE_OPERATOR_SLUG_CONFLICT
  | typeof ZONE_CREATE_CONFLICT;

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
  delivery_fees_ready: boolean;
  required_delivery_areas: number;
  configured_delivery_areas: number;
  active_products: number;
  essential_catalog_products: number;
  catalog_in_sync: boolean;
  active_eligible_merchants: number;
  activation_blockers: ZoneActivationBlocker[];
  required_products?: number;
  catalog_source?: CatalogSource;
};

const ZONE_ACTIVATION_BLOCKERS = {
  operatorNotReady: 'ZONE_OPERATOR_NOT_READY',
  catalogNotReady: 'ZONE_CATALOG_NOT_READY',
  deliveryFeesNotReady: 'ZONE_DELIVERY_FEES_NOT_READY',
  noEligibleMerchant: 'ZONE_NO_ELIGIBLE_ACTIVE_MERCHANT',
} as const;

type ZoneActivationBlocker =
  (typeof ZONE_ACTIVATION_BLOCKERS)[keyof typeof ZONE_ACTIVATION_BLOCKERS];

const MERCHANT_ELIGIBILITY_BLOCKERS = {
  notFound: 'MERCHANT_NOT_FOUND',
  inactive: 'MERCHANT_INACTIVE',
  deleted: 'MERCHANT_DELETED',
  deliveryDisabled: 'MERCHANT_DELIVERY_DISABLED',
  categoryMismatch: 'MERCHANT_CATEGORY_MISMATCH',
  zoneOperator: 'MERCHANT_IS_ZONE_OPERATOR',
  deliveryAreaMissing: 'MERCHANT_DELIVERY_AREA_MISSING',
  deliveryAreaInactive: 'MERCHANT_DELIVERY_AREA_INACTIVE',
} as const;

type MerchantEligibilityBlocker =
  (typeof MERCHANT_ELIGIBILITY_BLOCKERS)[keyof typeof MERCHANT_ELIGIBILITY_BLOCKERS];

type MerchantEligibility = {
  eligible: boolean;
  blocker: MerchantEligibilityBlocker | null;
};

type AdminZoneRecord = {
  id: number;
  area_id: number;
  name: string;
  slug: string;
  category: TenantCategory;
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
    child_areas: Array<{
      id: number;
      name_ar: string;
      name_en: string | null;
      slug: string;
      parent_area_id: number | null;
      city: string | null;
      governorate: string | null;
      is_active: boolean;
      sort_order: number;
    }>;
  };
  operator_tenant: {
    id: number;
    name: string;
    category: TenantCategory;
    status: TenantStatus;
    delivery_available?: boolean;
    deleted_at?: Date | null;
    tenant_delivery_areas: Array<{
      area_id: number;
      delivery_fee: Prisma.Decimal;
      is_active: boolean;
      area: {
        id: number;
        name_ar: string;
        name_en: string | null;
        slug: string;
        parent_area_id: number | null;
        city: string | null;
        governorate: string | null;
        is_active: boolean;
        sort_order: number;
      };
    }>;
  };
  merchants?: Array<{
    id: number;
    zone_storefront_id: number;
    tenant_id: number;
    priority: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    tenant: {
      id: number;
      name: string;
      status: TenantStatus;
      slug?: string;
      category?: TenantCategory;
    };
  }>;
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
  async create(dto: CreateZoneStorefrontDto, actor: ZoneAdminActor) {
    const name = dto.name.trim();
    const slug = dto.slug.trim().toLowerCase();
    const catalogSource = resolveCatalogSourceForTenantCategory(dto.category);
    if (!catalogSource) {
      throw new BadRequestException(
        'Zone storefronts support grocery and pharmacy categories only',
      );
    }

    const [area, conflict] = await Promise.all([
      this.prisma.directoryArea.findFirst({
        where: { id: dto.area_id, is_active: true, deleted_at: null },
        select: {
          id: true,
          child_areas: {
            where: { is_active: true, deleted_at: null },
            select: { id: true },
          },
        },
      }),
      this.findCreateConflict(dto.area_id, dto.category, slug),
    ]);

    if (!area) throw new NotFoundException('Directory area not found');
    if (area.child_areas.length === 0) {
      throw new BadRequestException(
        'يجب اختيار منطقة رئيسية تحتوي على مناطق توصيل فرعية نشطة.',
      );
    }
    if (conflict) this.throwCreateConflict(conflict, dto.category);

    try {
      return await this.prisma.$transaction(async (manager) => {
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

        await manager.tenantDeliveryArea.createMany({
          data: area.child_areas.map((childArea) => ({
            tenant_id: operatorTenant.id,
            area_id: childArea.id,
            delivery_fee: dto.delivery_fee ?? 20,
            is_active: true,
          })),
        });

        const zone = await manager.zoneStorefront.create({
          data: {
            name,
            slug,
            category: dto.category,
            operations_phone: dto.operations_phone.trim(),
            area_id: dto.area_id,
            operator_tenant_id: operatorTenant.id,
            is_active: false,
          },
          include: {
            area: {
              include: {
                child_areas: {
                  where: { is_active: true, deleted_at: null },
                  orderBy: [{ sort_order: 'asc' }, { name_ar: 'asc' }],
                },
              },
            },
            operator_tenant: {
              include: {
                tenant_delivery_areas: {
                  where: { is_active: true, deleted_at: null },
                  include: { area: true },
                },
              },
            },
          },
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
              category: zone.category,
              catalog_source: catalogSource,
            },
            source: ActivitySources.Admin,
            requestId: actor.requestId,
            ipAddress: actor.ipAddress,
          },
          manager,
        );
        await enqueueZoneCatalogReconciliation(manager, catalogSource);

        return this.mapAdminZone(zone, {
          catalog_ready: false,
          delivery_fees_ready: true,
          required_delivery_areas: area.child_areas.length,
          configured_delivery_areas: area.child_areas.length,
          catalog_in_sync: false,
          active_eligible_merchants: 0,
          active_products: 0,
          essential_catalog_products: 0,
          activation_blockers: [
            ZONE_ACTIVATION_BLOCKERS.catalogNotReady,
            ZONE_ACTIVATION_BLOCKERS.noEligibleMerchant,
          ],
        });
      });
    } catch (error) {
      const uniqueConstraintConflict = this.getUniqueConstraintConflict(error);
      if (!uniqueConstraintConflict) throw error;

      const concurrentConflict = await this.findCreateConflict(
        dto.area_id,
        dto.category,
        slug,
      );
      this.throwCreateConflict(
        concurrentConflict ?? uniqueConstraintConflict,
        dto.category,
      );
    }
  }

  /** Lists configured zones with catalog and assignment readiness. */
  async findAllForAdmin() {
    const zones = await this.prisma.zoneStorefront.findMany({
      include: {
        area: {
          include: {
            child_areas: {
              where: { is_active: true, deleted_at: null },
              orderBy: [{ sort_order: 'asc' }, { name_ar: 'asc' }],
            },
          },
        },
        operator_tenant: {
          include: {
            tenant_delivery_areas: {
              where: { is_active: true, deleted_at: null },
              include: { area: true },
            },
          },
        },
        merchants: {
          include: {
            tenant: { select: { id: true, name: true, status: true } },
          },
          orderBy: [{ priority: 'desc' }, { id: 'asc' }],
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return Promise.all(
      zones.map(async (zone) => {
        const [readiness, merchantEligibility] = await Promise.all([
          this.calculateReadiness(zone),
          this.getMerchantEligibilityMap(
            zone,
            zone.merchants.map((membership) => membership.tenant_id),
          ),
        ]);
        return this.mapAdminZone(zone, readiness, merchantEligibility);
      }),
    );
  }

  /** Returns one zone and its membership history for platform administration. */
  async findOneForAdmin(zoneId: number) {
    const zone = await this.prisma.zoneStorefront.findUnique({
      where: { id: zoneId },
      include: {
        area: {
          include: {
            child_areas: {
              where: { is_active: true, deleted_at: null },
              orderBy: [{ sort_order: 'asc' }, { name_ar: 'asc' }],
            },
          },
        },
        operator_tenant: {
          include: {
            tenant_delivery_areas: {
              where: { is_active: true, deleted_at: null },
              include: { area: true },
            },
          },
        },
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

    const [readiness, merchantEligibility] = await Promise.all([
      this.calculateReadiness(zone),
      this.getMerchantEligibilityMap(
        zone,
        zone.merchants.map((membership) => membership.tenant_id),
      ),
    ]);

    return this.mapAdminZone(zone, readiness, merchantEligibility);
  }

  /** Reconciles the operator snapshot with the complete curated essential set. */
  async syncEssentialCatalog(zoneId: number, actor: ZoneAdminActor) {
    return this.reconcileEssentialCatalog(zoneId, actor);
  }

  /** Runs the same reconciliation for the durable background worker. */
  async syncEssentialCatalogAutomatically(zoneId: number) {
    return this.reconcileEssentialCatalog(zoneId);
  }

  private async reconcileEssentialCatalog(
    zoneId: number,
    actor?: ZoneAdminActor,
  ) {
    const zone = await this.requireZone(zoneId);
    const catalogSource = this.requireCatalogSource(
      zone.operator_tenant.category,
    );
    const essentialItems = await findZoneEssentialCatalogItems(
      this.prisma,
      catalogSource,
    );
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
            actorAdminId: actor?.adminId,
            actorAdminName: actor?.adminName,
            actorAdminRole: actor?.adminRole,
            entityType: ActivityEntityTypes.ZoneStorefront,
            entityId: zone.id,
            action: ActivityActions.ZoneStorefrontCatalogSynced,
            title: 'تمت مزامنة المنتجات الأساسية للمنطقة',
            newValues: result,
            metadata: {
              catalog_source: catalogSource,
              curated_essentials: essentialItems.length,
            },
            source: actor ? ActivitySources.Admin : ActivitySources.System,
            requestId: actor?.requestId,
            ipAddress: actor?.ipAddress,
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
      const readiness = await this.calculateReadiness(zone);
      const blocker = readiness.activation_blockers[0];
      if (blocker) {
        const message =
          blocker === ZONE_ACTIVATION_BLOCKERS.operatorNotReady
            ? 'Zone operator is not ready for ordering'
            : blocker === ZONE_ACTIVATION_BLOCKERS.catalogNotReady
              ? 'Zone catalog is not ready'
              : blocker === ZONE_ACTIVATION_BLOCKERS.deliveryFeesNotReady
                ? 'Every active child area requires a delivery fee'
                : 'At least one eligible active merchant is required';
        throw new BadRequestException({ code: blocker, message });
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

  /** Replaces the complete fee set for every active direct child of the zone. */
  async updateDeliveryFees(
    zoneId: number,
    dto: UpdateZoneDeliveryFeesDto,
    actor: ZoneAdminActor,
  ) {
    const zone = await this.requireZone(zoneId);
    const expectedIds = zone.area.child_areas.map((area) => area.id);
    const submittedIds = dto.delivery_areas.map((area) => area.area_id);
    const expectedSet = new Set(expectedIds);
    const isCompleteExactSet =
      expectedIds.length > 0 &&
      submittedIds.length === expectedIds.length &&
      new Set(submittedIds).size === submittedIds.length &&
      submittedIds.every((areaId) => expectedSet.has(areaId));

    if (!isCompleteExactSet) {
      throw new BadRequestException(
        'يجب إرسال رسوم كل مناطق التوصيل الفرعية النشطة فقط، دون نقص أو تكرار.',
      );
    }

    await this.runInOperatorTenant(zone.operator_tenant_id, async (manager) => {
      const oldFees = zone.operator_tenant.tenant_delivery_areas
        .filter((entry) => expectedSet.has(entry.area_id))
        .map((entry) => ({
          area_id: entry.area_id,
          delivery_fee: Number(entry.delivery_fee),
        }));

      await manager.tenantDeliveryArea.updateMany({
        where: { tenant_id: zone.operator_tenant_id },
        data: { is_active: false },
      });
      for (const entry of dto.delivery_areas) {
        await manager.tenantDeliveryArea.upsert({
          where: {
            tenant_id_area_id: {
              tenant_id: zone.operator_tenant_id,
              area_id: entry.area_id,
            },
          },
          create: {
            tenant_id: zone.operator_tenant_id,
            area_id: entry.area_id,
            delivery_fee: entry.delivery_fee,
            is_active: true,
          },
          update: {
            delivery_fee: entry.delivery_fee,
            is_active: true,
            deleted_at: null,
          },
        });
      }

      const minimumFee = Math.min(
        ...dto.delivery_areas.map((entry) => entry.delivery_fee),
      );
      await manager.tenant.update({
        where: { id: zone.operator_tenant_id },
        data: { delivery_fee: minimumFee },
      });
      await this.activityLogService.create(
        {
          tenantId: zone.operator_tenant_id,
          actorAdminId: actor.adminId,
          actorAdminName: actor.adminName,
          actorAdminRole: actor.adminRole,
          entityType: ActivityEntityTypes.ZoneStorefront,
          entityId: zone.id,
          action: ActivityActions.ZoneStorefrontDeliveryFeesChanged,
          title: 'تم تحديث رسوم مناطق التوصيل الفرعية',
          oldValues: { delivery_areas: oldFees },
          newValues: { delivery_areas: dto.delivery_areas },
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
      throw new BadRequestException(
        'The operator tenant cannot fulfill itself',
      );
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
        ...this.buildEligibleMerchantWhere(zone),
        id: { not: zone.operator_tenant_id },
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
      include: {
        area: {
          include: {
            child_areas: {
              where: { is_active: true, deleted_at: null },
              orderBy: [{ sort_order: 'asc' }, { name_ar: 'asc' }],
            },
          },
        },
        operator_tenant: {
          include: {
            tenant_delivery_areas: {
              where: { is_active: true, deleted_at: null },
              include: { area: true },
            },
          },
        },
      },
      orderBy: [
        { area: { sort_order: 'asc' } },
        { name: 'asc' },
        { id: 'asc' },
      ],
    });

    const categoryCompatibleZones = zones.filter(
      (zone) => zone.category === zone.operator_tenant.category,
    );
    const publicZones = await Promise.all(
      categoryCompatibleZones.map(async (zone) => {
        const readiness = await this.calculateReadiness(zone);
        return readiness.catalog_ready &&
          readiness.delivery_fees_ready &&
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
    const catalogSource = this.requireCatalogSource(
      zone.operator_tenant.category,
    );
    const allowedCategories =
      await findActiveCatalogCategoryNamesForSource(
        this.prisma,
        catalogSource,
      );
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const search = query.search?.trim();
    const category = query.category?.trim();

    return this.runInOperatorTenant(
      zone.operator_tenant_id,
      async (manager) => {
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
          ...(search
            ? { name: { contains: search, mode: 'insensitive' } }
            : {}),
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
      },
    );
  }

  /** Returns public category summaries without leaking operator tenant details. */
  async findPublicCategories(slug: string) {
    const zone = await this.requirePublicZone(slug);
    const catalogSource = this.requireCatalogSource(
      zone.operator_tenant.category,
    );
    const allowedCategories =
      await findActiveCatalogCategoryNamesForSource(
        this.prisma,
        catalogSource,
      );
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
      where: this.buildEligibleMerchantWhere(zone, tenantId, requireMembership),
      select: { id: true, name: true, phone: true, category: true },
    });
    if (!merchant) {
      const eligibility = await this.getMerchantEligibility(zone, tenantId);
      throw new BadRequestException({
        message: 'Merchant is not eligible for this zone',
        code: eligibility.blocker ?? MERCHANT_ELIGIBILITY_BLOCKERS.notFound,
      });
    }
    return merchant;
  }

  /** Returns a configured zone with operator identity for trusted workflows. */
  async requireZone(zoneId: number) {
    const zone = await this.prisma.zoneStorefront.findUnique({
      where: { id: zoneId },
      include: {
        area: {
          include: {
            child_areas: {
              where: { is_active: true, deleted_at: null },
              orderBy: [{ sort_order: 'asc' }, { name_ar: 'asc' }],
            },
          },
        },
        operator_tenant: {
          include: {
            tenant_delivery_areas: {
              where: { is_active: true, deleted_at: null },
              include: { area: true },
            },
          },
        },
      },
    });
    if (!zone) throw new NotFoundException('Zone storefront not found');
    if (zone.category !== zone.operator_tenant.category) {
      throw new BadRequestException('Zone storefront category is inconsistent');
    }
    return zone;
  }

  /** Runs tenant-owned work under the operator tenant's PostgreSQL RLS context. */
  async runInOperatorTenant<T>(
    operatorTenantId: number,
    callback: (manager: Prisma.TransactionClient) => Promise<T>,
    transactionOptions?: { maxWait?: number; timeout?: number },
  ): Promise<T> {
    return this.prisma.$transaction(async (manager) => {
      await manager.$executeRaw`SELECT set_config('app.tenant_id', ${String(operatorTenantId)}, true)`;
      return DbTenantContext.run({ tenantId: operatorTenantId, manager }, () =>
        callback(manager),
      );
    }, transactionOptions);
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
      include: {
        area: {
          include: {
            child_areas: {
              where: { is_active: true, deleted_at: null },
              orderBy: [{ sort_order: 'asc' }, { name_ar: 'asc' }],
            },
          },
        },
        operator_tenant: {
          include: {
            tenant_delivery_areas: {
              where: { is_active: true, deleted_at: null },
              include: { area: true },
            },
          },
        },
      },
    });
    if (!zone) throw new NotFoundException('Zone storefront not found');
    if (zone.category !== zone.operator_tenant.category) {
      throw new NotFoundException('Zone storefront not found');
    }

    const readiness = await this.getReadiness(zone.id);
    if (
      !readiness.catalog_ready ||
      !readiness.delivery_fees_ready ||
      readiness.active_eligible_merchants < 1
    ) {
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
    const catalogSource = this.requireCatalogSource(
      zone.operator_tenant.category,
    );
    const allowedCategories =
      await findActiveCatalogCategoryNamesForSource(
        this.prisma,
        catalogSource,
      );
    const requiredProducts = MIN_SYNCHRONIZED_ZONE_PRODUCTS;
    const requiredDeliveryAreas = zone.area.child_areas.length;
    const configuredDeliveryAreas = zone.area.child_areas.filter((childArea) =>
      zone.operator_tenant.tenant_delivery_areas.some(
        (entry) =>
          entry.area_id === childArea.id &&
          entry.is_active &&
          Number(entry.delivery_fee) >= 0 &&
          entry.area.is_active &&
          entry.area.parent_area_id === zone.area_id,
      ),
    ).length;
    const deliveryFeesReady =
      requiredDeliveryAreas > 0 &&
      configuredDeliveryAreas === requiredDeliveryAreas;
    const [essentialCatalogProducts, activeProducts, activeEligibleMerchants] =
      await Promise.all([
        this.prisma.catalogItem.count({
          where: {
            source: catalogSource,
            is_essential: true,
            is_active: true,
            deleted_at: null,
            category: { in: allowedCategories },
          },
        }),
        this.runInOperatorTenant(zone.operator_tenant_id, (manager) =>
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
        ),
        this.prisma.zoneStorefrontMerchant.count({
          where: {
            zone_storefront_id: zone.id,
            is_active: true,
            tenant: this.buildEligibleMerchantWhere(zone),
          },
        }),
      ]);
    return {
      catalog_ready: activeProducts >= requiredProducts,
      delivery_fees_ready: deliveryFeesReady,
      required_delivery_areas: requiredDeliveryAreas,
      configured_delivery_areas: configuredDeliveryAreas,
      catalog_in_sync: activeProducts === essentialCatalogProducts,
      active_products: activeProducts,
      essential_catalog_products: essentialCatalogProducts,
      required_products: requiredProducts,
      active_eligible_merchants: activeEligibleMerchants,
      catalog_source: catalogSource,
      activation_blockers: this.getActivationBlockers(
        zone,
        activeProducts >= requiredProducts,
        deliveryFeesReady,
        activeEligibleMerchants,
      ),
    };
  }

  /** Builds the single authoritative Prisma filter for zone fulfillment eligibility. */
  private buildEligibleMerchantWhere(
    zone: Awaited<ReturnType<ZoneStorefrontsService['requireZone']>>,
    tenantId?: number,
    requireMembership = false,
  ): Prisma.TenantWhereInput {
    return {
      ...(tenantId ? { id: tenantId } : {}),
      status: TenantStatus.active,
      deleted_at: null,
      delivery_available: true,
      category: zone.operator_tenant.category,
      operated_zone_storefront: { is: null },
      tenant_delivery_areas: {
        some: this.buildZoneChildCoverageWhere(zone.area_id, true),
      },
      ...(requireMembership
        ? {
            zone_storefront_memberships: {
              some: { zone_storefront_id: zone.id, is_active: true },
            },
          }
        : {}),
    };
  }

  /** Explains why configured merchants do or do not satisfy the eligibility filter. */
  private async getMerchantEligibilityMap(
    zone: Awaited<ReturnType<ZoneStorefrontsService['requireZone']>>,
    tenantIds: number[],
  ): Promise<Map<number, MerchantEligibility>> {
    if (tenantIds.length === 0) return new Map();

    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: {
        id: true,
        status: true,
        deleted_at: true,
        delivery_available: true,
        category: true,
        operated_zone_storefront: { select: { id: true } },
        tenant_delivery_areas: {
          where: this.buildZoneChildCoverageWhere(zone.area_id, false),
          select: { is_active: true, deleted_at: true },
        },
      },
    });
    const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));

    return new Map(
      tenantIds.map((tenantId) => {
        const tenant = tenantById.get(tenantId);
        const deliveryAreas = tenant?.tenant_delivery_areas ?? [];
        const hasActiveChild = deliveryAreas.some(
          (deliveryArea) => deliveryArea.is_active && !deliveryArea.deleted_at,
        );
        let blocker: MerchantEligibilityBlocker | null = null;

        if (!tenant) blocker = MERCHANT_ELIGIBILITY_BLOCKERS.notFound;
        else if (tenant.deleted_at)
          blocker = MERCHANT_ELIGIBILITY_BLOCKERS.deleted;
        else if (tenant.status !== TenantStatus.active)
          blocker = MERCHANT_ELIGIBILITY_BLOCKERS.inactive;
        else if (!tenant.delivery_available)
          blocker = MERCHANT_ELIGIBILITY_BLOCKERS.deliveryDisabled;
        else if (tenant.category !== zone.operator_tenant.category)
          blocker = MERCHANT_ELIGIBILITY_BLOCKERS.categoryMismatch;
        else if (tenant.operated_zone_storefront)
          blocker = MERCHANT_ELIGIBILITY_BLOCKERS.zoneOperator;
        else if (deliveryAreas.length === 0)
          blocker = MERCHANT_ELIGIBILITY_BLOCKERS.deliveryAreaMissing;
        else if (!hasActiveChild)
          blocker = MERCHANT_ELIGIBILITY_BLOCKERS.deliveryAreaInactive;

        return [tenantId, { eligible: blocker === null, blocker }];
      }),
    );
  }

  private async getMerchantEligibility(
    zone: Awaited<ReturnType<ZoneStorefrontsService['requireZone']>>,
    tenantId: number,
  ): Promise<MerchantEligibility> {
    const eligibility = await this.getMerchantEligibilityMap(zone, [tenantId]);
    return (
      eligibility.get(tenantId) ?? {
        eligible: false,
        blocker: MERCHANT_ELIGIBILITY_BLOCKERS.notFound,
      }
    );
  }

  /** Builds the authoritative direct-child coverage predicate for one zone. */
  private buildZoneChildCoverageWhere(
    zoneAreaId: number,
    requireActiveCoverage: boolean,
  ): Prisma.TenantDeliveryAreaWhereInput {
    return {
      ...(requireActiveCoverage ? { is_active: true, deleted_at: null } : {}),
      area: {
        parent_area_id: zoneAreaId,
        is_active: true,
        deleted_at: null,
      },
    };
  }

  private getActivationBlockers(
    zone: Awaited<ReturnType<ZoneStorefrontsService['requireZone']>>,
    catalogReady: boolean,
    deliveryFeesReady: boolean,
    activeEligibleMerchants: number,
  ): ZoneActivationBlocker[] {
    const blockers: ZoneActivationBlocker[] = [];
    if (
      zone.operator_tenant.status !== TenantStatus.active ||
      zone.operator_tenant.deleted_at ||
      zone.operator_tenant.delivery_available !== true ||
      !resolveCatalogSourceForTenantCategory(zone.operator_tenant.category)
    ) {
      blockers.push(ZONE_ACTIVATION_BLOCKERS.operatorNotReady);
    }
    if (!catalogReady) blockers.push(ZONE_ACTIVATION_BLOCKERS.catalogNotReady);
    if (!deliveryFeesReady) {
      blockers.push(ZONE_ACTIVATION_BLOCKERS.deliveryFeesNotReady);
    }
    if (activeEligibleMerchants < 1) {
      blockers.push(ZONE_ACTIVATION_BLOCKERS.noEligibleMerchant);
    }
    return blockers;
  }

  /** Builds the private slug used only by trusted operator-tenant workflows. */
  private buildOperatorSlug(publicSlug: string): string {
    return `zone-operator-${publicSlug}`;
  }

  /** Builds a unique non-customer-facing identity for the userless operator. */
  private buildOperatorPhone(publicSlug: string): string {
    return `internal-zone:${publicSlug}`;
  }

  /** Resolves expected create conflicts without relying on database errors. */
  private async findCreateConflict(
    areaId: number,
    category: TenantCategory,
    slug: string,
  ): Promise<ZoneCreateConflictCode | null> {
    const [areaCategoryZone, slugZone, operatorIdentity] = await Promise.all([
      this.prisma.zoneStorefront.findFirst({
        where: { area_id: areaId, category },
        select: { id: true },
      }),
      this.prisma.zoneStorefront.findUnique({
        where: { slug },
        select: { id: true },
      }),
      this.prisma.tenant.findFirst({
        where: {
          OR: [
            { slug: this.buildOperatorSlug(slug) },
            { phone: this.buildOperatorPhone(slug) },
          ],
        },
        select: { id: true },
      }),
    ]);

    if (areaCategoryZone) return ZONE_AREA_CATEGORY_CONFLICT;
    if (slugZone) return ZONE_SLUG_CONFLICT;
    if (operatorIdentity) return ZONE_OPERATOR_SLUG_CONFLICT;
    return null;
  }

  /** Converts expected create conflicts into stable, admin-safe responses. */
  private throwCreateConflict(
    code: ZoneCreateConflictCode,
    category: TenantCategory,
  ): never {
    const message = (() => {
      if (code === ZONE_AREA_CATEGORY_CONFLICT) {
        return category === TenantCategory.pharmacy
          ? 'يوجد بالفعل واجهة صيدلية لهذه المنطقة.'
          : 'يوجد بالفعل واجهة سوبر ماركت لهذه المنطقة.';
      }
      if (code === ZONE_SLUG_CONFLICT) {
        return 'الرابط مستخدم بالفعل. اختر رابطًا مختلفًا.';
      }
      if (code === ZONE_OPERATOR_SLUG_CONFLICT) {
        return 'الرابط محجوز لواجهة داخلية. اختر رابطًا مختلفًا.';
      }
      return 'تعذر إنشاء واجهة المنطقة بسبب تعارض متزامن. حاول مرة أخرى.';
    })();

    throw new ConflictException({ code, message });
  }

  private getUniqueConstraintConflict(
    error: unknown,
  ): ZoneCreateConflictCode | null {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return null;
    }

    const rawTarget = error.meta?.target;
    const target = Array.isArray(rawTarget)
      ? rawTarget.map(String).join(',')
      : String(rawTarget ?? '');

    if (
      target.includes('UQ_zone_storefronts_area_category') ||
      (target.includes('area_id') && target.includes('category'))
    ) {
      return ZONE_AREA_CATEGORY_CONFLICT;
    }
    if (target.includes('UQ_zone_storefronts_slug') || target === 'slug') {
      return ZONE_SLUG_CONFLICT;
    }
    if (
      target.includes('UQ_2310ecc5cb8be427097154b18fc') ||
      target.includes('UQ_23d5a62128e1a248126c8453ff0') ||
      target === 'phone'
    ) {
      return ZONE_OPERATOR_SLUG_CONFLICT;
    }
    return ZONE_CREATE_CONFLICT;
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
    const deliveryAreas = this.resolveZoneDeliveryAreas(zone);
    const deliveryFees = deliveryAreas.map((entry) => entry.delivery_fee);
    const minimumFee = Math.min(...deliveryFees);
    const maximumFee = Math.max(...deliveryFees);

    return {
      id: zone.id,
      name: zone.name,
      slug: zone.slug,
      category: zone.category,
      delivery_fee: minimumFee,
      delivery_fee_min: minimumFee,
      delivery_fee_max: maximumFee,
      delivery_areas: deliveryAreas,
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
  private mapAdminZone(
    zone: AdminZoneRecord,
    readiness: ZoneReadiness,
    merchantEligibility = new Map<number, MerchantEligibility>(),
  ) {
    const deliveryAreas = this.mapZoneDeliveryAreas(zone);
    const configuredFees = deliveryAreas
      .map((entry) => entry.delivery_fee)
      .filter((fee): fee is number => fee !== null);
    const minimumFee =
      configuredFees.length > 0 ? Math.min(...configuredFees) : null;
    const maximumFee =
      configuredFees.length > 0 ? Math.max(...configuredFees) : null;

    return {
      id: zone.id,
      name: zone.name,
      slug: zone.slug,
      operations_phone: zone.operations_phone,
      is_active: zone.is_active,
      created_at: zone.created_at,
      updated_at: zone.updated_at,
      area: zone.area,
      delivery_areas: deliveryAreas,
      delivery_fee_min: minimumFee,
      delivery_fee_max: maximumFee,
      operator_tenant: {
        id: zone.operator_tenant.id,
        name: zone.operator_tenant.name,
        category: zone.operator_tenant.category,
        status: zone.operator_tenant.status,
        delivery_fee: minimumFee,
      },
      merchants: (zone.merchants ?? []).map((membership) => ({
        ...membership,
        eligibility: merchantEligibility.get(membership.tenant_id) ?? {
          eligible: false,
          blocker: MERCHANT_ELIGIBILITY_BLOCKERS.notFound,
        },
      })),
      readiness,
    };
  }

  /** Maps every active direct child and its currently active operator fee. */
  private mapZoneDeliveryAreas(zone: {
    area: {
      child_areas: Array<{
        id: number;
        name_ar: string;
        name_en: string | null;
        slug: string;
        parent_area_id: number | null;
        city: string | null;
        governorate: string | null;
        is_active: boolean;
        sort_order: number;
      }>;
    };
    operator_tenant: {
      tenant_delivery_areas: Array<{
        area_id: number;
        delivery_fee: Prisma.Decimal;
        is_active: boolean;
      }>;
    };
  }) {
    return zone.area.child_areas.map((area) => {
      const configuredArea = zone.operator_tenant.tenant_delivery_areas.find(
        (entry) => entry.area_id === area.id && entry.is_active,
      );
      return {
        area_id: area.id,
        delivery_fee: configuredArea
          ? Number(configuredArea.delivery_fee)
          : null,
        is_active: Boolean(configuredArea),
        area: {
          id: area.id,
          name_ar: area.name_ar,
          name_en: area.name_en,
          slug: area.slug,
          parent_area_id: area.parent_area_id,
          city: area.city,
          governorate: area.governorate,
          is_active: area.is_active,
          sort_order: area.sort_order,
        },
      };
    });
  }

  /** Returns the complete public child fee set or rejects incomplete state. */
  private resolveZoneDeliveryAreas(
    zone: Awaited<ReturnType<ZoneStorefrontsService['requireZone']>>,
  ) {
    const deliveryAreas = this.mapZoneDeliveryAreas(zone);
    if (
      deliveryAreas.length === 0 ||
      deliveryAreas.some(
        (entry) => entry.delivery_fee === null || entry.delivery_fee < 0,
      )
    ) {
      throw new BadRequestException(
        'Zone storefront child delivery fees are not configured',
      );
    }
    return deliveryAreas as Array<
      (typeof deliveryAreas)[number] & { delivery_fee: number }
    >;
  }
}
