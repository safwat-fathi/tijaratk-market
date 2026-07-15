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
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    for (const source of sources) {
      const allowedCategories = getAllowedCatalogCategoriesForSource(source);
      const result = await client.query(
        `
          UPDATE catalog_items
          SET is_active = false,
              is_essential = false,
              essential_sort_order = NULL,
              updated_at = NOW()
          WHERE source = $1
            AND is_active = true
            AND category <> ALL($2::text[])
        `,
        [source, allowedCategories],
      );

      logger.log(
        `Deactivated ${result.rowCount ?? 0} contaminated ${source} catalog items.`,
      );

      await client.query(
        `
          INSERT INTO zone_catalog_reconciliations (
            source,
            requested_revision,
            completed_revision,
            next_attempt_at,
            requested_at,
            updated_at
          )
          VALUES ($1, 1, 0, NOW(), NOW(), NOW())
          ON CONFLICT (source) DO UPDATE
          SET requested_revision = zone_catalog_reconciliations.requested_revision + 1,
              next_attempt_at = NOW(),
              requested_at = NOW(),
              last_error = NULL,
              updated_at = NOW()
        `,
        [source],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  logger.error('Catalog source cleanup failed', error);
  process.exit(1);
});
