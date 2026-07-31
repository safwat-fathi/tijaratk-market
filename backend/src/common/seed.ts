import { Logger } from '@nestjs/common';
import { config } from 'dotenv';
import {
  seedSupermarketMerchant,
  SUPERMARKET_SEED_MERCHANTS,
} from './seeders/supermarket-merchant.seeder';
import {
  seedPharmacyMerchant,
  PHARMACY_SEED_MERCHANTS,
} from './seeders/pharmacy-merchant.seeder';
import { seedAdmin } from './seeders/admin.seeder';
import { DirectoryStatus, PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { passwordExtension } from '../prisma/password.extension';

import {
  EGYPT_DIRECTORY_AREAS,
  DIRECTORY_AREA_PARENT_ASSIGNMENTS,
} from './seeders/directory-areas.seeder';

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
  const rawPrisma = new PrismaClient({ adapter });
  const prisma = rawPrisma.$extends(passwordExtension) as unknown as PrismaClient;

  await prisma.$connect();

  try {
    await seedAdmin(prisma);
    await seedDirectoryAreas(prisma);
    await seedSupermarketMerchant(prisma);
    await seedPharmacyMerchant(prisma);
    await seedDirectoryProfiles(prisma);

    logger.log('Seeding completed successfully.');
  } catch (error) {
    logger.error('Seeding error:', error);
    process.exitCode = 1;
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
  const parentAssignments = DIRECTORY_AREA_PARENT_ASSIGNMENTS;

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

  const allAreas = await prisma.directoryArea.findMany();
  const areaBySlug = new Map(allAreas.map((a) => [a.slug, a]));

  for (const [parentSlug, zoneSlugs] of Object.entries(
    DIRECTORY_AREA_PARENT_ASSIGNMENTS,
  )) {
    const parentArea = areaBySlug.get(parentSlug);
    if (!parentArea) continue;

    for (const zoneSlug of zoneSlugs) {
      const zoneArea = areaBySlug.get(zoneSlug);
      if (!zoneArea) continue;

      // Seed 5 Supermarkets per zone
      for (let i = 1; i <= 5; i++) {
        const slug = `${zoneSlug}-supermarket-${i}`;
        const tenant = await prisma.tenant.findUnique({ where: { slug } });
        if (tenant) {
          await seedRankingDirectoryProfile(prisma, {
            slug,
            primaryArea: zoneArea,
            deliveryAreas: [zoneArea], // Restricted ONLY to that zone
            address: `${zoneArea.name_en}, ${parentArea.name_en}`,
            description: `Order groceries from ${tenant.name} in ${zoneArea.name_en}.`,
          });
        }
      }

      // Seed 5 Pharmacies per zone
      for (let i = 1; i <= 5; i++) {
        const slug = `${zoneSlug}-pharmacy-${i}`;
        const tenant = await prisma.tenant.findUnique({ where: { slug } });
        if (tenant) {
          await seedRankingDirectoryProfile(prisma, {
            slug,
            primaryArea: zoneArea,
            deliveryAreas: [zoneArea], // Restricted ONLY to that zone
            address: `${zoneArea.name_en}, ${parentArea.name_en}`,
            description: `Order medicines from ${tenant.name} in ${zoneArea.name_en}.`,
          });
        }
      }
    }
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

  const profileData = {
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
      seo_title: `${tenant.name} | Directory test store`,
      seo_description: input.description,
    },
    create: {
      tenant_id: tenant.id,
      ...profileData,
      directory_status: DirectoryStatus.listed,
      display_name: tenant.name,
      seo_title: `${tenant.name} | Directory test store`,
      seo_description: input.description,
    },
  });

  for (const area of input.deliveryAreas) {
    await prisma.tenantDeliveryArea.upsert({
      where: {
        tenant_id_area_id: {
          tenant_id: tenant.id,
          area_id: area.id,
        },
      },
      update: {
        delivery_fee: tenant.delivery_fee,
        is_active: true,
        deleted_at: null,
      },
      create: {
        tenant_id: tenant.id,
        area_id: area.id,
        delivery_fee: tenant.delivery_fee,
        is_active: true,
      },
    });
  }

  logger.log(`Seeded directory profile for ${tenant.slug}.`);
}
