/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Logger } from '@nestjs/common';
import { config } from 'dotenv';
import { Pool } from 'pg';
import {
  CATALOG_SOURCE_TALABAT,
  normalizeCatalogCategoryForSource,
} from 'src/products/catalog-source-policy';

config({
  path:
    process.env.NODE_ENV === 'production'
      ? '.env.production'
      : '.env.development',
});

const logger = new Logger('GroceryCatalogCategoryNormalizer');

async function main() {
  const pool = new Pool({
    connectionString: process.env.MIGRATE_DB_URL ?? process.env.DB_URL,
  });

  try {
    const categoriesResult = await pool.query<{ category: string }>(
      `
        SELECT DISTINCT category
        FROM catalog_items
        WHERE source = $1
      `,
      [CATALOG_SOURCE_TALABAT],
    );

    let normalizedRows = 0;
    let skippedCategories = 0;

    for (const row of categoriesResult.rows) {
      const normalizedCategory = normalizeCatalogCategoryForSource(
        CATALOG_SOURCE_TALABAT,
        row.category,
      );

      if (!normalizedCategory) {
        skippedCategories += 1;
        continue;
      }

      const updateResult = await pool.query(
        `
          UPDATE catalog_items
          SET category = $1,
              is_active = true,
              updated_at = NOW()
          WHERE source = $2
            AND category = $3
        `,
        [normalizedCategory, CATALOG_SOURCE_TALABAT, row.category],
      );

      normalizedRows += updateResult.rowCount ?? 0;
    }

    logger.log(
      `Normalized/reactivated ${normalizedRows} ${CATALOG_SOURCE_TALABAT} catalog rows.`,
    );
    logger.log(
      `Skipped ${skippedCategories} unmapped ${CATALOG_SOURCE_TALABAT} categories.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  logger.error('Grocery catalog category normalization failed', error);
  process.exit(1);
});
