import { Logger } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { PrismaClient } from '../../../generated/prisma/client';
import { seedZoneStorefront } from '../seeders/zone-storefront.seeder';

config({ path: '.env.development', quiet: true });

async function bootstrap() {
  const logger = new Logger('ZoneStorefrontFixture');
  if (process.env.NODE_ENV !== 'development') {
    throw new Error(
      'The zone storefront fixture requires NODE_ENV=development.',
    );
  }

  const connectionString =
    process.env.SEED_DB_URL ?? process.env.MIGRATE_DB_URL ?? process.env.DB_URL;
  if (!connectionString) {
    throw new Error('SEED_DB_URL, MIGRATE_DB_URL, or DB_URL is required.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  await prisma.$connect();

  try {
    await seedZoneStorefront(prisma);
    logger.log('Zone storefront fixture completed successfully.');
  } finally {
    await prisma.$disconnect();
  }
}

void bootstrap().catch((error) => {
  const logger = new Logger('ZoneStorefrontFixture');
  logger.error('Zone storefront fixture failed:', error);
  process.exitCode = 1;
});
