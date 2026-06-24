import { Logger } from '@nestjs/common';
import { config } from 'dotenv';
import {
  // seedSupermarketMerchant,
  SUPERMARKET_RANKING_MERCHANTS,
} from './seeders/supermarket-merchant.seeder';
import {
  // seedPharmacyMerchant,
  PHARMACY_RANKING_MERCHANTS,
} from './seeders/pharmacy-merchant.seeder';
import { seedAdmin } from './seeders/admin.seeder';
import { DirectoryStatus, PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { EGYPT_DIRECTORY_AREAS } from './seeders/directory-areas.seeder';

config({
  path: process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env',
  quiet: true,
});

async function bootstrap() {
  const logger = new Logger('Seed');
  logger.log('Seeding...');

  const seedDatabaseUrl =
    process.env.SEED_DB_URL ?? process.env.MIGRATE_DB_URL ?? process.env.DB_URL;

  if (!seedDatabaseUrl) {
    throw new Error(
      'SEED_DB_URL, MIGRATE_DB_URL, or DB_URL is required to run the database seed.',
    );
  }

  const adapter = new PrismaPg({ connectionString: seedDatabaseUrl });
  const prisma = new PrismaClient({ adapter });

  await prisma.$connect();

  try {
    await seedAdmin(prisma);
    await seedDirectoryAreas(prisma);
    // await seedSupermarketMerchant(prisma);
    // await seedPharmacyMerchant(prisma);
    await seedDirectoryProfiles(prisma);

    logger.log('Seeding completed successfully.');
  } catch (error) {
    logger.error('Seeding error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

void bootstrap();

/**
 * Seeds active Egyptian areas used by public SEO stores directory pages.
 */
async function seedDirectoryAreas(prisma: PrismaClient) {
  const logger = new Logger('DirectoryAreasSeeder');

  for (const area of EGYPT_DIRECTORY_AREAS) {
    await prisma.directoryArea.upsert({
      where: { slug: area.slug },
      update: {
        name_ar: area.name_ar,
        name_en: area.name_en,
        city: area.city,
        governorate: area.governorate,
        is_active: true,
        sort_order: area.sort_order,
        latitude: area.latitude,
        longitude: area.longitude,
        seo_title: `Stores delivering in ${area.name_en} | Tijaratk`,
        seo_description: `Browse supermarkets and pharmacies delivering in ${area.name_en} and order directly from local stores.`,
      },
      create: {
        ...area,
        is_active: true,
        seo_title: `Stores delivering in ${area.name_en} | Tijaratk`,
        seo_description: `Browse supermarkets and pharmacies delivering in ${area.name_en} and order directly from local stores.`,
      },
    });
  }

  await assignDirectoryAreaParents(prisma);

  logger.log(`Seeded ${EGYPT_DIRECTORY_AREAS.length} directory areas.`);
}

async function assignDirectoryAreaParents(prisma: PrismaClient) {
  const parentAssignments = {
    'sheikh-zayed': ['al-khamayel'],
    '6th-of-october': [
      'october-1st-district',
      'october-2nd-district',
      'october-3rd-district',
      'october-4th-district',
      'october-5th-district',
      'october-6th-district',
      'october-7th-district',
      'october-8th-district',
      'october-9th-district',
      'october-10th-district',
      'october-11th-district',
      'october-12th-district',
      'october-al-motamayez',
      'october-gharb-somid',
      'hadayek-october',
      'october-northern-expansions',
    ],
  } as const;

  await prisma.directoryArea.updateMany({
    where: { slug: { in: Object.keys(parentAssignments) } },
    data: { parent_area_id: null },
  });

  for (const [parentSlug, childSlugs] of Object.entries(parentAssignments)) {
    const parent = await prisma.directoryArea.findUnique({
      where: { slug: parentSlug },
      select: { id: true },
    });

    if (!parent) continue;

    await prisma.directoryArea.updateMany({
      where: { slug: { in: [...childSlugs] } },
      data: { parent_area_id: parent.id },
    });
  }
}

/**
 * Seeds directory profile and delivery areas for the demo tenants.
 */
async function seedDirectoryProfiles(prisma: PrismaClient) {
  const logger = new Logger('DirectoryProfilesSeeder');

  const zayedArea = await prisma.directoryArea.findUnique({
    where: { slug: 'sheikh-zayed' },
  });
  const octoberArea = await prisma.directoryArea.findUnique({
    where: { slug: '6th-of-october' },
  });

  if (!zayedArea || !octoberArea) {
    logger.warn(
      'Skipping ranking directory profile seed because required areas are missing.',
    );
    return;
  }

  for (const merchant of SUPERMARKET_RANKING_MERCHANTS) {
    await seedRankingDirectoryProfile(prisma, {
      slug: merchant.slug,
      primaryArea: zayedArea,
      deliveryAreas: [zayedArea, octoberArea],
      address: 'Sheikh Zayed, Giza',
      description:
        'Order groceries and supermarket essentials through Tijaratk.',
      missingLocation: merchant.variant === 'missing_location',
    });
  }

  for (const merchant of PHARMACY_RANKING_MERCHANTS) {
    await seedRankingDirectoryProfile(prisma, {
      slug: merchant.slug,
      primaryArea: octoberArea,
      deliveryAreas: [octoberArea, zayedArea],
      address: '6th of October City, Giza',
      description: 'Order medicines, vitamins and cosmetics through Tijaratk.',
      missingLocation: merchant.variant === 'missing_location',
    });
  }
}

async function seedRankingDirectoryProfile(
  prisma: PrismaClient,
  input: {
    slug: string;
    primaryArea: NonNullable<
      Awaited<ReturnType<PrismaClient['directoryArea']['findUnique']>>
    >;
    deliveryAreas: NonNullable<
      Awaited<ReturnType<PrismaClient['directoryArea']['findUnique']>>
    >[];
    address: string;
    description: string;
    missingLocation: boolean;
  },
) {
  const logger = new Logger('DirectoryProfilesSeeder');
  const tenant = await prisma.tenant.findUnique({
    where: { slug: input.slug },
  });

  if (!tenant) {
    logger.warn(
      `Skipping directory profile seed for missing tenant ${input.slug}.`,
    );
    return;
  }

  const profileData = input.missingLocation
    ? {
        area_id: null,
        address: null,
        latitude: null,
        longitude: null,
        profile_completion_score: 55,
        missing_fields: ['missing_logo', 'missing_area'],
      }
    : {
        area_id: input.primaryArea.id,
        address: input.address,
        latitude: input.primaryArea.latitude,
        longitude: input.primaryArea.longitude,
        profile_completion_score: 90,
        missing_fields: ['missing_logo'],
      };

  await prisma.tenantDirectoryProfile.upsert({
    where: { tenant_id: tenant.id },
    update: {
      ...profileData,
      directory_status: DirectoryStatus.listed,
      display_name: tenant.name,
      seo_title: `${tenant.name} | Directory ranking test store`,
      seo_description: input.description,
    },
    create: {
      tenant_id: tenant.id,
      ...profileData,
      directory_status: DirectoryStatus.listed,
      display_name: tenant.name,
      seo_title: `${tenant.name} | Directory ranking test store`,
      seo_description: input.description,
    },
  });

  if (input.missingLocation) {
    await prisma.tenantDeliveryArea.updateMany({
      where: { tenant_id: tenant.id },
      data: { is_active: false },
    });
    logger.log(`Seeded missing-location directory profile for ${tenant.slug}.`);
    return;
  }

  for (const area of input.deliveryAreas) {
    await prisma.tenantDeliveryArea.upsert({
      where: {
        tenant_id_area_id: {
          tenant_id: tenant.id,
          area_id: area.id,
        },
      },
      update: { is_active: true, deleted_at: null },
      create: {
        tenant_id: tenant.id,
        area_id: area.id,
        is_active: true,
      },
    });
  }

  logger.log(`Seeded directory profile for ${tenant.slug}.`);
}
