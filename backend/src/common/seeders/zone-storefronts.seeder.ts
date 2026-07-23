import { Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '../../../generated/prisma/client';
import { TENANT_CATEGORIES } from 'src/tenants/constants/tenant-category';
import { SUPERMARKET_SEED_MERCHANTS } from './supermarket-merchant.seeder';
import { PHARMACY_SEED_MERCHANTS } from './pharmacy-merchant.seeder';
import {
  isZoneStorefrontEnabled,
} from 'src/zone-storefronts/zone-storefront-feature';

/** Seeds demo zone storefronts only when the experiment is explicitly enabled. */
export async function seedZoneStorefronts(prisma: PrismaClient) {
  const logger = new Logger('ZoneStorefrontsSeeder');
  if (!isZoneStorefrontEnabled()) {
    logger.log(
      'Skipping zone storefronts seed because the feature is disabled.',
    );
    return;
  }

  const zayedArea = await prisma.directoryArea.findUnique({
    where: { slug: 'sheikh-zayed' },
  });
  const octoberArea = await prisma.directoryArea.findUnique({
    where: { slug: '6th-of-october' },
  });

  if (!zayedArea || !octoberArea) {
    logger.warn('Skipping zone storefronts seed because required areas are missing.');
    return;
  }

  // 1. Create Tijaratk Zayed Operator
  const zayedOperator = await upsertOperatorTenant(prisma, {
    name: 'Tijaratk Zayed Operator',
    slug: 'zayed-operator',
    phone: '+201000000100',
  });

  const zayedZone = await upsertZoneStorefront(prisma, {
    area_id: zayedArea.id,
    operator_tenant_id: zayedOperator.id,
    name: 'تجارة الشيخ زايد',
    slug: 'sheikh-zayed-market',
    category: TENANT_CATEGORIES.GROCERY.value,
    operations_phone: '+201000000100',
    is_active: true,
  });

  for (const [index, merchant] of SUPERMARKET_SEED_MERCHANTS.entries()) {
    const tenant = await prisma.tenant.findUnique({ where: { slug: merchant.slug } });
    if (tenant) {
      await addMerchantToZone(prisma, zayedZone.id, tenant.id, 10 - index);
    }
  }

  // 2. Create Tijaratk October Operator
  const octoberOperator = await upsertOperatorTenant(prisma, {
    name: 'Tijaratk October Operator',
    slug: 'october-operator',
    phone: '+201000000200',
  });

  const octoberZone = await upsertZoneStorefront(prisma, {
    area_id: octoberArea.id,
    operator_tenant_id: octoberOperator.id,
    name: 'تجارة 6 أكتوبر',
    slug: 'october-market',
    category: TENANT_CATEGORIES.PHARMACY.value,
    operations_phone: '+201000000200',
    is_active: true,
  });

  for (const [index, merchant] of PHARMACY_SEED_MERCHANTS.entries()) {
    const tenant = await prisma.tenant.findUnique({ where: { slug: merchant.slug } });
    if (tenant) {
      await addMerchantToZone(prisma, octoberZone.id, tenant.id, 10 - index);
    }
  }

  logger.log('Seeded zone storefronts successfully.');
}

async function upsertOperatorTenant(
  prisma: PrismaClient,
  data: { name: string; slug: string; phone: string },
) {
  const existing = await prisma.tenant.findFirst({
    where: { OR: [{ slug: data.slug }, { phone: data.phone }] },
  });

  if (existing) {
    return prisma.tenant.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        category: TENANT_CATEGORIES.OTHER.value,
      },
    });
  }

  return prisma.tenant.create({
    data: {
      name: data.name,
      slug: data.slug,
      phone: data.phone,
      category: TENANT_CATEGORIES.OTHER.value,
      delivery_fee: 0,
      delivery_available: true,
      onboarding_completed: true,
      onboarding_step: 6,
    },
  });
}

async function upsertZoneStorefront(
  prisma: PrismaClient,
  data: {
    area_id: number;
    operator_tenant_id: number;
    name: string;
    slug: string;
    category: any;
    operations_phone: string;
    is_active: boolean;
  },
) {
  const existing = await prisma.zoneStorefront.findUnique({
    where: { slug: data.slug },
  });

  if (existing) {
    return prisma.zoneStorefront.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        area_id: data.area_id,
        operator_tenant_id: data.operator_tenant_id,
        category: data.category,
        operations_phone: data.operations_phone,
        is_active: data.is_active,
      },
    });
  }

  return prisma.zoneStorefront.create({ data });
}

async function addMerchantToZone(
  prisma: PrismaClient,
  zone_storefront_id: number,
  tenant_id: number,
  priority: number,
) {
  await prisma.zoneStorefrontMerchant.upsert({
    where: {
      zone_storefront_id_tenant_id: {
        zone_storefront_id,
        tenant_id,
      },
    },
    update: {
      priority,
      is_active: true,
    },
    create: {
      zone_storefront_id,
      tenant_id,
      priority,
      is_active: true,
    },
  });
}
