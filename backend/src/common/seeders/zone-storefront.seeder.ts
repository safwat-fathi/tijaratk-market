import { Logger } from '@nestjs/common';
import {
  Prisma,
  PrismaClient,
  TenantCategory,
  TenantStatus,
} from '../../../generated/prisma/client';
import { CATALOG_SOURCE_TALABAT } from 'src/products/catalog-source-policy';
import {
  findZoneEssentialCatalogItems,
  syncZoneEssentialCatalog,
  type ZoneEssentialCatalogItem,
} from 'src/zone-storefronts/zone-essential-catalog-sync';
import {
  isZoneStorefrontEnabled,
} from 'src/zone-storefronts/zone-storefront-feature';

const ZONE_SLUG = 'sheikh-zayed';
const ZONE_NAME = 'تجارتك - الشيخ زايد';
const OPERATIONS_PHONE = '+201000000099';
const OPERATOR_SLUG = ZONE_SLUG;
const OPERATOR_PHONE = OPERATIONS_PHONE;
const TARGET_MERCHANT_SLUGS = [
  'khair-supermarket',
  'ranking-20-products-supermarket',
] as const;

type FixtureMerchant = {
  id: number;
  slug: string;
};

type FixtureOperatorIdentity = {
  id: number;
  slug: string;
  phone: string;
  category: TenantCategory;
  status: TenantStatus;
  deleted_at: Date | null;
  delivery_available: boolean;
};

type ExistingFixtureZone = {
  id: number;
  area_id: number;
  operator_tenant_id: number;
  slug: string;
  category: TenantCategory;
  is_active: boolean;
  operator_tenant: FixtureOperatorIdentity;
};

type ZoneSeedReadiness = {
  activeProducts: number;
  activeCategories: number;
  eligibleMerchants: number;
  isActive: boolean;
};

/** Seeds the explicit Sheikh Zayed development fixture after a safe preflight. */
export async function seedZoneStorefront(prisma: PrismaClient) {
  const logger = new Logger('ZoneStorefrontSeeder');
  if (!isZoneStorefrontEnabled()) {
    logger.log(
      'Skipping zone storefront fixture because the feature is disabled.',
    );
    return;
  }

  const area = await prisma.directoryArea.findFirst({
    where: { slug: ZONE_SLUG, is_active: true, deleted_at: null },
    include: {
      child_areas: {
        where: { is_active: true, deleted_at: null },
        select: { id: true },
      },
    },
  });
  if (!area) {
    throw new Error(
      `Cannot seed zone storefront: active directory area '${ZONE_SLUG}' is missing.`,
    );
  }
  if (area.child_areas.length === 0) {
    throw new Error(
      `Cannot seed zone storefront: directory area '${ZONE_SLUG}' has no active direct children.`,
    );
  }

  const [catalogProducts, merchants, existingZone, identityTenants] =
    await Promise.all([
      findFixtureCatalogProducts(prisma),
      findFixtureMerchants(prisma),
      prisma.zoneStorefront.findFirst({
        where: {
          OR: [
            {
              area_id: area.id,
              category: TenantCategory.grocery,
            },
            { slug: ZONE_SLUG },
          ],
        },
        include: { operator_tenant: true },
      }),
      prisma.tenant.findMany({
        where: { OR: [{ slug: OPERATOR_SLUG }, { phone: OPERATOR_PHONE }] },
        select: {
          id: true,
          slug: true,
          phone: true,
          category: true,
          status: true,
          deleted_at: true,
          delivery_available: true,
        },
      }),
    ]);

  assertFixturePrerequisites({
    areaId: area.id,
    catalogProducts,
    merchants,
    existingZone,
    identityTenants,
  });

  const reusableOperator = identityTenants[0] ?? null;
  const result = await prisma.$transaction(
    async (tx) => {
      const operatorTenant = await ensureOperatorTenant(
        tx,
        existingZone,
        reusableOperator,
      );

      await tx.$executeRaw`SELECT set_config(
        'app.tenant_id',
        ${String(operatorTenant.id)},
        true
      )`;
      await ensureDeliveryCoverage(
        tx,
        operatorTenant.id,
        area.child_areas.map((childArea) => childArea.id),
      );

      const zoneStorefront = await ensureZoneStorefront(
        tx,
        existingZone,
        operatorTenant.id,
        area.id,
      );
      const catalogSync = await syncZoneEssentialCatalog(
        tx,
        operatorTenant.id,
        CATALOG_SOURCE_TALABAT,
        catalogProducts,
      );
      const activeProducts = catalogSync.active_products;
      const eligibleMerchants = await linkZoneMerchants(
        tx,
        zoneStorefront.id,
        area.id,
        merchants,
        logger,
      );
      const isReady = activeProducts >= 1 && eligibleMerchants >= 1;

      if (!isReady) {
        throw new Error(
          `Zone storefront '${ZONE_SLUG}' is not ready: ` +
            `${activeProducts}/1 synchronized essential Talabat products and ` +
            `${eligibleMerchants} eligible merchant(s).`,
        );
      }

      if (!existingZone) {
        await tx.zoneStorefront.update({
          where: { id: zoneStorefront.id },
          data: { is_active: true },
        });
      }

      return {
        activeProducts,
        activeCategories: catalogSync.active_categories,
        eligibleMerchants,
        isActive: existingZone?.is_active ?? true,
      } satisfies ZoneSeedReadiness;
    },
    { maxWait: 10_000, timeout: 120_000 },
  );

  logger.log(
    `Prepared ${result.isActive ? 'active' : 'inactive'} Zone Storefront ` +
      `'${ZONE_SLUG}' with ${result.activeProducts} products and ` +
      `${result.activeCategories} categories across ` +
      `${result.eligibleMerchants} eligible merchants.`,
  );
}

async function findFixtureCatalogProducts(
  prisma: PrismaClient,
): Promise<ZoneEssentialCatalogItem[]> {
  return findZoneEssentialCatalogItems(prisma, CATALOG_SOURCE_TALABAT);
}

async function findFixtureMerchants(
  prisma: PrismaClient,
): Promise<FixtureMerchant[]> {
  return prisma.tenant.findMany({
    where: {
      slug: { in: [...TARGET_MERCHANT_SLUGS] },
      category: TenantCategory.grocery,
      status: TenantStatus.active,
      deleted_at: null,
      operated_zone_storefront: { is: null },
    },
    select: { id: true, slug: true },
    orderBy: { id: 'asc' },
  });
}

function assertFixturePrerequisites(input: {
  areaId: number;
  catalogProducts: ZoneEssentialCatalogItem[];
  merchants: FixtureMerchant[];
  existingZone: ExistingFixtureZone | null;
  identityTenants: FixtureOperatorIdentity[];
}) {
  if (input.catalogProducts.length < 1) {
    throw new Error(
      `Cannot seed '${ZONE_SLUG}': at least one distinct active curated ` +
        `'${CATALOG_SOURCE_TALABAT}' essential is required.`,
    );
  }
  if (input.merchants.length < 1) {
    throw new Error(
      `Cannot seed '${ZONE_SLUG}': at least one active grocery fixture merchant is required.`,
    );
  }
  if (input.identityTenants.length > 1) {
    throw new Error(
      `Cannot seed '${ZONE_SLUG}': fixture operator slug and phone belong to different tenants.`,
    );
  }

  if (input.existingZone) {
    const operator = input.existingZone.operator_tenant;
    if (
      input.existingZone.area_id !== input.areaId ||
      input.existingZone.slug !== ZONE_SLUG ||
      input.existingZone.category !== TenantCategory.grocery ||
      operator.slug !== OPERATOR_SLUG ||
      operator.phone !== OPERATOR_PHONE ||
      !isSafeFixtureOperator(operator)
    ) {
      throw new Error(
        `Cannot seed '${ZONE_SLUG}': the area or public slug belongs to a non-fixture zone.`,
      );
    }
    if (
      input.identityTenants[0] &&
      input.identityTenants[0].id !== input.existingZone.operator_tenant_id
    ) {
      throw new Error(
        `Cannot seed '${ZONE_SLUG}': fixture identity conflicts with the existing operator.`,
      );
    }
    return;
  }

  const reusableOperator = input.identityTenants[0];
  if (
    reusableOperator &&
    (reusableOperator.slug !== OPERATOR_SLUG ||
      reusableOperator.phone !== OPERATOR_PHONE ||
      !isSafeFixtureOperator(reusableOperator))
  ) {
    throw new Error(
      `Cannot seed '${ZONE_SLUG}': the fixture operator identity is only partially available.`,
    );
  }
}

function isSafeFixtureOperator(operator: FixtureOperatorIdentity): boolean {
  return (
    (operator.category === TenantCategory.grocery ||
      operator.category === TenantCategory.other) &&
    operator.status === TenantStatus.active &&
    operator.deleted_at === null &&
    operator.delivery_available === true
  );
}

async function ensureOperatorTenant(
  tx: Prisma.TransactionClient,
  existingZone: ExistingFixtureZone | null,
  reusableOperator: FixtureOperatorIdentity | null,
) {
  const operator = existingZone?.operator_tenant ?? reusableOperator;
  if (operator) {
    await assertOperatorIsUserless(tx, operator.id);
    if (operator.category === TenantCategory.grocery) return operator;

    return tx.tenant.update({
      where: { id: operator.id },
      data: {
        category: TenantCategory.grocery,
        onboarding_completed: true,
        onboarding_step: 4,
      },
    });
  }

  return tx.tenant.create({ data: operatorData });
}

async function assertOperatorIsUserless(
  tx: Prisma.TransactionClient,
  tenantId: number,
) {
  const [users, subscriptions] = await Promise.all([
    tx.user.count({ where: { tenant_id: tenantId } }),
    tx.tenantSubscription.count({ where: { tenant_id: tenantId } }),
  ]);

  if (users > 0 || subscriptions > 0) {
    throw new Error(
      `Refusing to use tenant ${tenantId} as a zone operator: found ` +
        `${users} merchant user(s) and ${subscriptions} subscription(s).`,
    );
  }
}

const operatorData = {
  name: ZONE_NAME,
  slug: OPERATOR_SLUG,
  phone: OPERATOR_PHONE,
  category: TenantCategory.grocery,
  status: TenantStatus.active,
  deleted_at: null,
  delivery_fee: 15,
  delivery_available: true,
  delivery_starts_at: '09:00',
  delivery_ends_at: '22:00',
  onboarding_completed: true,
  onboarding_step: 4,
} satisfies Prisma.TenantUncheckedCreateInput;

async function ensureDeliveryCoverage(
  tx: Prisma.TransactionClient,
  tenantId: number,
  areaIds: number[],
) {
  const tenant = await tx.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { delivery_fee: true },
  });
  await tx.tenantDeliveryArea.updateMany({
    where: { tenant_id: tenantId, area_id: { notIn: areaIds } },
    data: { is_active: false },
  });
  for (const areaId of areaIds) {
    await tx.tenantDeliveryArea.upsert({
      where: { tenant_id_area_id: { tenant_id: tenantId, area_id: areaId } },
      update: {
        is_active: true,
        deleted_at: null,
      },
      create: {
        tenant_id: tenantId,
        area_id: areaId,
        delivery_fee: tenant.delivery_fee,
        is_active: true,
      },
    });
  }
}

async function ensureZoneStorefront(
  tx: Prisma.TransactionClient,
  existingZone: ExistingFixtureZone | null,
  operatorTenantId: number,
  areaId: number,
) {
  if (existingZone) {
    return tx.zoneStorefront.findUniqueOrThrow({
      where: { id: existingZone.id },
    });
  }

  return tx.zoneStorefront.create({
    data: {
      name: ZONE_NAME,
      slug: ZONE_SLUG,
      category: TenantCategory.grocery,
      operator_tenant_id: operatorTenantId,
      area_id: areaId,
      operations_phone: OPERATIONS_PHONE,
      is_active: false,
    },
  });
}

async function linkZoneMerchants(
  tx: Prisma.TransactionClient,
  zoneStorefrontId: number,
  areaId: number,
  tenants: FixtureMerchant[],
  logger: Logger,
) {
  for (const tenant of tenants) {
    await ensureDeliveryCoverage(tx, tenant.id, [areaId]);
    const membership = await tx.zoneStorefrontMerchant.findUnique({
      where: {
        zone_storefront_id_tenant_id: {
          zone_storefront_id: zoneStorefrontId,
          tenant_id: tenant.id,
        },
      },
      select: { id: true },
    });
    if (!membership) {
      await tx.zoneStorefrontMerchant.create({
        data: {
          zone_storefront_id: zoneStorefrontId,
          tenant_id: tenant.id,
          is_active: true,
          priority: 10,
        },
      });
    }
  }

  const eligibleMerchants = await tx.zoneStorefrontMerchant.count({
    where: {
      zone_storefront_id: zoneStorefrontId,
      is_active: true,
      tenant: {
        category: TenantCategory.grocery,
        status: TenantStatus.active,
        deleted_at: null,
        delivery_available: true,
        operated_zone_storefront: { is: null },
        tenant_delivery_areas: {
          some: {
            is_active: true,
            deleted_at: null,
            area: {
              parent_area_id: areaId,
              is_active: true,
              deleted_at: null,
            },
          },
        },
      },
    },
  });

  logger.log(
    `Linked ${tenants.length} fixture merchants; ${eligibleMerchants} are eligible for dispatch.`,
  );
  return eligibleMerchants;
}
