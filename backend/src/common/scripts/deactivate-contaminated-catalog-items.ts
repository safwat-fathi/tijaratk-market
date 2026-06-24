/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Logger } from '@nestjs/common';
import { config } from 'dotenv';
import { Pool } from 'pg';
import {
  CATALOG_SOURCE_CHEFAA,
  CATALOG_SOURCE_TALABAT,
  getAllowedCatalogCategoriesForSource,
} from 'src/products/catalog-source-policy';

config({
  path:
    process.env.NODE_ENV === 'production'
      ? '.env.production'
      : '.env.development',
});

const logger = new Logger('CatalogSourceCleanup');

async function main() {
  const sources = [CATALOG_SOURCE_CHEFAA, CATALOG_SOURCE_TALABAT];

  const pool = new Pool({
    connectionString: process.env.MIGRATE_DB_URL ?? process.env.DB_URL,
  });

  try {
    for (const source of sources) {
      const allowedCategories = getAllowedCatalogCategoriesForSource(source);
      const result = await pool.query(
        `
          UPDATE catalog_items
          SET is_active = false, updated_at = NOW()
          WHERE source = $1
            AND is_active = true
            AND category <> ALL($2::text[])
        `,
        [source, allowedCategories],
      );

      logger.log(
        `Deactivated ${result.rowCount ?? 0} contaminated ${source} catalog items.`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  logger.error('Catalog source cleanup failed', error);
  process.exit(1);
});
