import { Logger } from '@nestjs/common';
import { config } from 'dotenv';
import { seedSupermarketMerchant } from './seeders/supermarket-merchant.seeder';
import { seedPharmacyMerchant } from './seeders/pharmacy-merchant.seeder';
import { seedAdmin } from './seeders/admin.seeder';
import { DirectoryStatus, PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const EGYPT_DIRECTORY_AREAS = [
  {
    name_ar: 'الشيخ زايد',
    name_en: 'Sheikh Zayed',
    slug: 'sheikh-zayed',
    city: 'Giza',
    governorate: 'Giza',
    sort_order: 10,
    latitude: 30.0131,
    longitude: 30.9766,
  },
  {
    name_ar: '6 أكتوبر',
    name_en: '6th of October',
    slug: '6th-of-october',
    city: '6th of October',
    governorate: 'Giza',
    sort_order: 20,
    latitude: 29.9668,
    longitude: 30.9279,
  },
  {
    name_ar: 'التجمع الخامس',
    name_en: 'New Cairo',
    slug: 'new-cairo',
    city: 'Cairo',
    governorate: 'Cairo',
    sort_order: 30,
    latitude: 30.0074,
    longitude: 31.4913,
  },
  {
    name_ar: 'المعادي',
    name_en: 'Maadi',
    slug: 'maadi',
    city: 'Cairo',
    governorate: 'Cairo',
    sort_order: 40,
    latitude: 29.9602,
    longitude: 31.2569,
  },
  {
    name_ar: 'مدينة نصر',
    name_en: 'Nasr City',
    slug: 'nasr-city',
    city: 'Cairo',
    governorate: 'Cairo',
    sort_order: 50,
    latitude: 30.0561,
    longitude: 31.3301,
  },
  {
    name_ar: 'مصر الجديدة',
    name_en: 'Heliopolis',
    slug: 'heliopolis',
    city: 'Cairo',
    governorate: 'Cairo',
    sort_order: 60,
    latitude: 30.0917,
    longitude: 31.3222,
  },
  {
    name_ar: 'الزمالك',
    name_en: 'Zamalek',
    slug: 'zamalek',
    city: 'Cairo',
    governorate: 'Cairo',
    sort_order: 70,
    latitude: 30.0616,
    longitude: 31.2197,
  },
  {
    name_ar: 'الدقي',
    name_en: 'Dokki',
    slug: 'dokki',
    city: 'Giza',
    governorate: 'Giza',
    sort_order: 80,
    latitude: 30.0384,
    longitude: 31.2123,
  },
  {
    name_ar: 'المهندسين',
    name_en: 'Mohandessin',
    slug: 'mohandessin',
    city: 'Giza',
    governorate: 'Giza',
    sort_order: 90,
    latitude: 30.0525,
    longitude: 31.2006,
  },
  {
    name_ar: 'الرحاب',
    name_en: 'El Rehab',
    slug: 'el-rehab',
    city: 'New Cairo',
    governorate: 'Cairo',
    sort_order: 100,
    latitude: 30.0634,
    longitude: 31.488,
  },
  {
    name_ar: 'مدينتي',
    name_en: 'Madinaty',
    slug: 'madinaty',
    city: 'New Cairo',
    governorate: 'Cairo',
    sort_order: 110,
    latitude: 30.0949,
    longitude: 31.6387,
  },
  {
    name_ar: 'الشروق',
    name_en: 'El Shorouk',
    slug: 'el-shorouk',
    city: 'El Shorouk',
    governorate: 'Cairo',
    sort_order: 120,
    latitude: 30.1419,
    longitude: 31.6151,
  },
] as const;

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
    await seedSupermarketMerchant(prisma);
    await seedPharmacyMerchant(prisma);
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

  logger.log(`Seeded ${EGYPT_DIRECTORY_AREAS.length} directory areas.`);
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

  // 1. Supermarket Merchant (Sheikh Zayed primary, delivers to Zayed and October)
  const supermarket = await prisma.tenant.findUnique({
    where: { slug: 'khair-supermarket' },
  });

  if (supermarket && zayedArea) {
    await prisma.tenantDirectoryProfile.upsert({
      where: { tenant_id: supermarket.id },
      update: {
        area_id: zayedArea.id,
        directory_status: DirectoryStatus.listed,
        display_name: supermarket.name,
        address: 'Sheikh Zayed, Giza',
        latitude: zayedArea.latitude,
        longitude: zayedArea.longitude,
        seo_title: `${supermarket.name} | Supermarket delivering in Sheikh Zayed`,
        seo_description:
          'Order groceries and supermarket essentials from Super Market El Khair through Tijaratk.',
        profile_completion_score: 80,
        missing_fields: ['logo_url'],
      },
      create: {
        tenant_id: supermarket.id,
        area_id: zayedArea.id,
        directory_status: DirectoryStatus.listed,
        display_name: supermarket.name,
        address: 'Sheikh Zayed, Giza',
        latitude: zayedArea.latitude,
        longitude: zayedArea.longitude,
        seo_title: `${supermarket.name} | Supermarket delivering in Sheikh Zayed`,
        seo_description:
          'Order groceries and supermarket essentials from Super Market El Khair through Tijaratk.',
        profile_completion_score: 80,
        missing_fields: ['logo_url'],
      },
    });

    const deliveryAreaIds = [zayedArea.id, octoberArea?.id].filter(
      (areaId): areaId is number => typeof areaId === 'number',
    );

    for (const areaId of deliveryAreaIds) {
      await prisma.tenantDeliveryArea.upsert({
        where: {
          tenant_id_area_id: {
            tenant_id: supermarket.id,
            area_id: areaId,
          },
        },
        update: { is_active: true, deleted_at: null },
        create: {
          tenant_id: supermarket.id,
          area_id: areaId,
          is_active: true,
        },
      });
    }

    logger.log(`Seeded directory profile for ${supermarket.slug}.`);
  } else {
    logger.warn('Skipping supermarket directory profile seed because tenant or area is missing.');
  }

  // 2. Pharmacy Merchant (6th of October primary, delivers to October and Zayed)
  const pharmacy = await prisma.tenant.findUnique({
    where: { slug: 'el-shifaa-pharmacy' },
  });

  if (pharmacy && octoberArea) {
    await prisma.tenantDirectoryProfile.upsert({
      where: { tenant_id: pharmacy.id },
      update: {
        area_id: octoberArea.id,
        directory_status: DirectoryStatus.listed,
        display_name: pharmacy.name,
        address: '6th of October City, Giza',
        latitude: octoberArea.latitude,
        longitude: octoberArea.longitude,
        seo_title: `${pharmacy.name} | Pharmacy delivering in 6th of October`,
        seo_description:
          'Order medicines, vitamins and cosmetics from El Shifaa Pharmacy through Tijaratk.',
        profile_completion_score: 80,
        missing_fields: ['logo_url'],
      },
      create: {
        tenant_id: pharmacy.id,
        area_id: octoberArea.id,
        directory_status: DirectoryStatus.listed,
        display_name: pharmacy.name,
        address: '6th of October City, Giza',
        latitude: octoberArea.latitude,
        longitude: octoberArea.longitude,
        seo_title: `${pharmacy.name} | Pharmacy delivering in 6th of October`,
        seo_description:
          'Order medicines, vitamins and cosmetics from El Shifaa Pharmacy through Tijaratk.',
        profile_completion_score: 80,
        missing_fields: ['logo_url'],
      },
    });

    const deliveryAreaIds = [octoberArea.id, zayedArea?.id].filter(
      (areaId): areaId is number => typeof areaId === 'number',
    );

    for (const areaId of deliveryAreaIds) {
      await prisma.tenantDeliveryArea.upsert({
        where: {
          tenant_id_area_id: {
            tenant_id: pharmacy.id,
            area_id: areaId,
          },
        },
        update: { is_active: true, deleted_at: null },
        create: {
          tenant_id: pharmacy.id,
          area_id: areaId,
          is_active: true,
        },
      });
    }

    logger.log(`Seeded directory profile for ${pharmacy.slug}.`);
  } else {
    logger.warn('Skipping pharmacy directory profile seed because tenant or area is missing.');
  }
}
