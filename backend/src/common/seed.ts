import { Logger } from '@nestjs/common';
import { config } from 'dotenv';
import { seedCatalog } from './seeders/catalog.seeder';
import { seedSupermarketMerchant } from './seeders/supermarket-merchant.seeder';
import { seedAdmin } from './seeders/admin.seeder';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

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

  const pool = new Pool({ connectionString: seedDatabaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  await prisma.$connect();

  try {
    await seedCatalog(prisma);
    await seedSupermarketMerchant(prisma);
    await seedAdmin(prisma);

    logger.log('Seeding completed successfully.');
  } catch (error) {
    logger.error('Seeding error:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void bootstrap();
