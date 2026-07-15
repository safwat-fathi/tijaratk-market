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
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const categoriesResult = await client.query<{ category: string }>(
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
      const mappedCategory = normalizeCatalogCategoryForSource(
        CATALOG_SOURCE_TALABAT,
        row.category,
      );
      const normalizedCategory = mappedCategory ?? 'أخرى';
      if (!mappedCategory) skippedCategories += 1;

      const updateResult = await client.query(
        `
          UPDATE catalog_items
          SET category = $1,
              updated_at = NOW()
          WHERE source = $2
            AND category = $3
        `,
        [normalizedCategory, CATALOG_SOURCE_TALABAT, row.category],
      );

      normalizedRows += updateResult.rowCount ?? 0;
    }

    const repairedEssentials = await client.query(
      `
        UPDATE catalog_items
        SET is_active = true,
            deleted_at = NULL,
            updated_at = NOW()
        WHERE source = $1
          AND is_essential = true
          AND (is_active = false OR deleted_at IS NOT NULL)
      `,
      [CATALOG_SOURCE_TALABAT],
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
      [CATALOG_SOURCE_TALABAT],
    );
    await client.query('COMMIT');

    logger.log(
      `Normalized ${normalizedRows} ${CATALOG_SOURCE_TALABAT} catalog rows and repaired ${repairedEssentials.rowCount ?? 0} essential rows.`,
    );
    logger.log(
      `Mapped ${skippedCategories} unmapped legacy ${CATALOG_SOURCE_TALABAT} categories to أخرى.`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  logger.error('Grocery catalog category normalization failed', error);
  process.exit(1);
});
