import { Logger } from '@nestjs/common';
import { config } from 'dotenv';
import {
  seedSupermarketMerchant,
  SUPERMARKET_RANKING_MERCHANTS,
} from './seeders/supermarket-merchant.seeder';
import {
  seedPharmacyMerchant,
  PHARMACY_RANKING_MERCHANTS,
} from './seeders/pharmacy-merchant.seeder';
import { seedAdmin } from './seeders/admin.seeder';
import { DirectoryStatus, PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const EGYPT_DIRECTORY_AREAS = [
  // Giza Areas
  {
    name_ar: 'الشيخ زايد',
    name_en: 'Sheikh Zayed',
    slug: 'sheikh-zayed',
    city: 'Giza',
    governorate: 'Giza',
    sort_order: 100,
    latitude: 30.0131,
    longitude: 30.9766,
  },
  {
    name_ar: 'الخمائل',
    name_en: 'Al Khamayel',
    slug: 'al-khamayel',
    city: 'Sheikh Zayed',
    governorate: 'Giza',
    sort_order: 110,
    latitude: 30.0286,
    longitude: 31.0331,
  },
  {
    name_ar: '6 أكتوبر',
    name_en: '6th of October',
    slug: '6th-of-october',
    city: '6th of October',
    governorate: 'Giza',
    sort_order: 200,
    latitude: 29.9668,
    longitude: 30.9279,
  },
  {
    name_ar: 'الحي الأول',
    name_en: '1st District',
    slug: 'october-1st-district',
    city: '6th of October',
    governorate: 'Giza',
    sort_order: 210,
    latitude: 29.983,
    longitude: 30.991,
  },
  {
    name_ar: 'الحي الثاني',
    name_en: '2nd District',
    slug: 'october-2nd-district',
    city: '6th of October',
    governorate: 'Giza',
    sort_order: 220,
    latitude: 29.981,
    longitude: 30.982,
  },
  {
    name_ar: 'الحي الثالث',
    name_en: '3rd District',
    slug: 'october-3rd-district',
    city: '6th of October',
    governorate: 'Giza',
    sort_order: 230,
    latitude: 29.975,
    longitude: 30.975,
  },
  {
    name_ar: 'الحي الرابع',
    name_en: '4th District',
    slug: 'october-4th-district',
    city: '6th of October',
    governorate: 'Giza',
    sort_order: 240,
    latitude: 29.97,
    longitude: 30.967,
  },
  {
    name_ar: 'الحي الخامس',
    name_en: '5th District',
    slug: 'october-5th-district',
    city: '6th of October',
    governorate: 'Giza',
    sort_order: 250,
    latitude: 29.965,
    longitude: 30.962,
  },
  {
    name_ar: 'الحي السادس',
    name_en: '6th District',
    slug: 'october-6th-district',
    city: '6th of October',
    governorate: 'Giza',
    sort_order: 260,
    latitude: 29.951,
    longitude: 30.938,
  },
  {
    name_ar: 'الحي السابع',
    name_en: '7th District',
    slug: 'october-7th-district',
    city: '6th of October',
    governorate: 'Giza',
    sort_order: 270,
    latitude: 29.977,
    longitude: 30.945,
  },
  {
    name_ar: 'الحي الثامن',
    name_en: '8th District',
    slug: 'october-8th-district',
    city: '6th of October',
    governorate: 'Giza',
    sort_order: 280,
    latitude: 29.981,
    longitude: 30.938,
  },
  {
    name_ar: 'الحي التاسع',
    name_en: '9th District',
    slug: 'october-9th-district',
    city: '6th of October',
    governorate: 'Giza',
    sort_order: 290,
    latitude: 29.96,
    longitude: 30.95,
  },
  {
    name_ar: 'الحي العاشر',
    name_en: '10th District',
    slug: 'october-10th-district',
    city: '6th of October',
    governorate: 'Giza',
    sort_order: 300,
    latitude: 29.94,
    longitude: 30.93,
  },
  {
    name_ar: 'الحي الحادي عشر',
    name_en: '11th District',
    slug: 'october-11th-district',
    city: '6th of October',
    governorate: 'Giza',
    sort_order: 310,
    latitude: 29.945,
    longitude: 30.94,
  },
  {
    name_ar: 'الحي الثاني عشر',
    name_en: '12th District',
    slug: 'october-12th-district',
    city: '6th of October',
    governorate: 'Giza',
    sort_order: 320,
    latitude: 29.935,
    longitude: 30.948,
  },
  {
    name_ar: 'الحي المتميز',
    name_en: 'Al Motamayez District',
    slug: 'october-al-motamayez',
    city: '6th of October',
    governorate: 'Giza',
    sort_order: 330,
    latitude: 29.9691,
    longitude: 30.9491,
  },
  {
    name_ar: 'غرب سوميد',
    name_en: 'Gharb Somid',
    slug: 'october-gharb-somid',
    city: '6th of October',
    governorate: 'Giza',
    sort_order: 340,
    latitude: 29.9786,
    longitude: 30.9694,
  },
  {
    name_ar: 'حدائق أكتوبر',
    name_en: 'Hadayek October',
    slug: 'hadayek-october',
    city: '6th of October',
    governorate: 'Giza',
    sort_order: 350,
    latitude: 29.8908,
    longitude: 30.9128,
  },
  {
    name_ar: 'التوسعات الشمالية',
    name_en: 'Northern Expansions',
    slug: 'october-northern-expansions',
    city: '6th of October',
    governorate: 'Giza',
    sort_order: 360,
    latitude: 29.995,
    longitude: 30.965,
  },
  {
    name_ar: 'الدقي',
    name_en: 'Dokki',
    slug: 'dokki',
    city: 'Giza',
    governorate: 'Giza',
    sort_order: 400,
    latitude: 30.0384,
    longitude: 31.2123,
  },
  {
    name_ar: 'المهندسين',
    name_en: 'Mohandessin',
    slug: 'mohandessin',
    city: 'Giza',
    governorate: 'Giza',
    sort_order: 500,
    latitude: 30.0525,
    longitude: 31.2006,
  },
  {
    name_ar: 'الهرم',
    name_en: 'Haram',
    slug: 'haram',
    city: 'Giza',
    governorate: 'Giza',
    sort_order: 600,
    latitude: 29.9874,
    longitude: 31.1429,
  },
  {
    name_ar: 'فيصل',
    name_en: 'Faisal',
    slug: 'faisal',
    city: 'Giza',
    governorate: 'Giza',
    sort_order: 700,
    latitude: 30.0174,
    longitude: 31.2038,
  },
  {
    name_ar: 'العجوزة',
    name_en: 'Agouza',
    slug: 'agouza',
    city: 'Giza',
    governorate: 'Giza',
    sort_order: 800,
    latitude: 30.0603,
    longitude: 31.2025,
  },
  {
    name_ar: 'إمبابة',
    name_en: 'Imbaba',
    slug: 'imbaba',
    city: 'Giza',
    governorate: 'Giza',
    sort_order: 900,
    latitude: 30.0796,
    longitude: 31.1984,
  },
  {
    name_ar: 'حدائق الأهرام',
    name_en: 'Hadayek El Ahram',
    slug: 'hadayek-el-ahram',
    city: 'Giza',
    governorate: 'Giza',
    sort_order: 1000,
    latitude: 29.9713,
    longitude: 31.1024,
  },
  // Cairo Areas
  {
    name_ar: 'التجمع الخامس',
    name_en: 'New Cairo',
    slug: 'new-cairo',
    city: 'Cairo',
    governorate: 'Cairo',
    sort_order: 1100,
    latitude: 30.0074,
    longitude: 31.4913,
  },
  {
    name_ar: 'المعادي',
    name_en: 'Maadi',
    slug: 'maadi',
    city: 'Cairo',
    governorate: 'Cairo',
    sort_order: 1200,
    latitude: 29.9602,
    longitude: 31.2569,
  },
  {
    name_ar: 'مدينة نصر',
    name_en: 'Nasr City',
    slug: 'nasr-city',
    city: 'Cairo',
    governorate: 'Cairo',
    sort_order: 1300,
    latitude: 30.0561,
    longitude: 31.3301,
  },
  {
    name_ar: 'مصر الجديدة',
    name_en: 'Heliopolis',
    slug: 'heliopolis',
    city: 'Cairo',
    governorate: 'Cairo',
    sort_order: 1400,
    latitude: 30.0917,
    longitude: 31.3222,
  },
  {
    name_ar: 'الزمالك',
    name_en: 'Zamalek',
    slug: 'zamalek',
    city: 'Cairo',
    governorate: 'Cairo',
    sort_order: 1500,
    latitude: 30.0616,
    longitude: 31.2197,
  },
  {
    name_ar: 'الرحاب',
    name_en: 'El Rehab',
    slug: 'el-rehab',
    city: 'New Cairo',
    governorate: 'Cairo',
    sort_order: 1600,
    latitude: 30.0634,
    longitude: 31.488,
  },
  {
    name_ar: 'مدينتي',
    name_en: 'Madinaty',
    slug: 'madinaty',
    city: 'New Cairo',
    governorate: 'Cairo',
    sort_order: 1700,
    latitude: 30.0949,
    longitude: 31.6387,
  },
  {
    name_ar: 'الشروق',
    name_en: 'El Shorouk',
    slug: 'el-shorouk',
    city: 'El Shorouk',
    governorate: 'Cairo',
    sort_order: 1800,
    latitude: 30.1419,
    longitude: 31.6151,
  },
  {
    name_ar: 'المقطم',
    name_en: 'Mokattam',
    slug: 'mokattam',
    city: 'Cairo',
    governorate: 'Cairo',
    sort_order: 1900,
    latitude: 30.0142,
    longitude: 31.2879,
  },
  {
    name_ar: 'شيراتون',
    name_en: 'Sheraton',
    slug: 'sheraton',
    city: 'Cairo',
    governorate: 'Cairo',
    sort_order: 2000,
    latitude: 30.1,
    longitude: 31.333,
  },
  {
    name_ar: 'شبرا',
    name_en: 'Shubra',
    slug: 'shubra',
    city: 'Cairo',
    governorate: 'Cairo',
    sort_order: 2100,
    latitude: 30.1002,
    longitude: 31.2506,
  },
  {
    name_ar: 'وسط البلد',
    name_en: 'Downtown Cairo',
    slug: 'downtown-cairo',
    city: 'Cairo',
    governorate: 'Cairo',
    sort_order: 2200,
    latitude: 30.0444,
    longitude: 31.2357,
  },
  {
    name_ar: 'جاردن سيتي',
    name_en: 'Garden City',
    slug: 'garden-city',
    city: 'Cairo',
    governorate: 'Cairo',
    sort_order: 2300,
    latitude: 30.0345,
    longitude: 31.2253,
  },
  {
    name_ar: 'المنيل',
    name_en: 'El Manial',
    slug: 'el-manial',
    city: 'Cairo',
    governorate: 'Cairo',
    sort_order: 2400,
    latitude: 30.0214,
    longitude: 31.2269,
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
