import { Logger } from '@nestjs/common';
import { PrismaClient } from '../../../generated/prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import {
  CATALOG_SOURCE_TALABAT,
  isCatalogCategoryAllowedForSource,
} from 'src/products/catalog-source-policy';

const DEFAULT_CATALOG_CATEGORY = 'أخرى';
const EXPECTED_CATALOG_CURRENCY = 'EGP';

type CatalogCsvRecord = {
  name?: string;
  price?: string;
  currency?: string;
  image_url?: string;
  product_id?: string;
  category?: string;
};

type CatalogSeedItem = {
  name: string;
  price: string | null;
  currency: string;
  image_url: string | null;
  category: string;
  external_id: string | null;
};

/**
 * Normalizes optional CSV text fields into nullable database values.
 */
function normalizeOptionalText(value: string | undefined): string | null {
  const normalizedValue = value?.trim();
  return normalizedValue || null;
}

/**
 * Normalizes CSV catalog prices into two-decimal decimal strings.
 */
function normalizeCatalogPrice(value: string | undefined): string | null {
  const normalizedValue = normalizeOptionalText(value);
  if (!normalizedValue) return null;

  const numericValue = Number(normalizedValue);
  if (!Number.isFinite(numericValue) || numericValue < 0) return null;

  return numericValue.toFixed(2);
}

function processCatalogRecord(
  record: CatalogCsvRecord,
  uniqueItemsMap: Map<string, CatalogSeedItem>,
  counters: {
    skippedNameCount: number;
    skippedCurrencyCount: number;
    skippedCategoryCount: number;
  },
) {
  const name = record.name?.trim();
  if (!name) {
    counters.skippedNameCount += 1;
    return;
  }

  const currency =
    record.currency?.trim().toUpperCase() || EXPECTED_CATALOG_CURRENCY;
  if (currency !== EXPECTED_CATALOG_CURRENCY) {
    counters.skippedCurrencyCount += 1;
    return;
  }

  const category = record.category?.trim() || DEFAULT_CATALOG_CATEGORY;
  if (!isCatalogCategoryAllowedForSource(CATALOG_SOURCE_TALABAT, category)) {
    counters.skippedCategoryCount += 1;
    return;
  }

  const productId = normalizeOptionalText(record.product_id);
  const key = productId || `${name}|${category}`;

  if (!uniqueItemsMap.has(key)) {
    uniqueItemsMap.set(key, {
      name,
      price: normalizeCatalogPrice(record.price),
      currency,
      image_url: normalizeOptionalText(record.image_url),
      category,
      external_id: productId,
    });
  }
}

export async function seedCatalog(prisma: PrismaClient) {
  const logger = new Logger('CatalogSeeder');
  try {
    // Read the CSV from the root directory
    const csvPath = path.resolve(process.cwd(), '../catalog-items.csv');
    if (!fs.existsSync(csvPath)) {
      logger.warn(`CSV file not found at ${csvPath}. Skipping CSV seeding.`);
      return;
    }

    const fileContent = fs.readFileSync(csvPath, 'utf8');

    const records: CatalogCsvRecord[] = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const uniqueItemsMap = new Map<string, CatalogSeedItem>();
    const counters = {
      skippedCurrencyCount: 0,
      skippedNameCount: 0,
      skippedCategoryCount: 0,
    };

    for (const record of records) {
      processCatalogRecord(record, uniqueItemsMap, counters);
    }

    const newItems = Array.from(uniqueItemsMap.values());
    logger.log(`Found ${newItems.length} unique catalog items from CSV.`);
    if (counters.skippedCurrencyCount > 0) {
      logger.warn(
        `Skipped ${counters.skippedCurrencyCount} catalog rows with non-EGP currency.`,
      );
    }
    if (counters.skippedNameCount > 0) {
      logger.warn(`Skipped ${counters.skippedNameCount} catalog rows without a name.`);
    }
    if (counters.skippedCategoryCount > 0) {
      logger.warn(
        `Skipped ${counters.skippedCategoryCount} catalog rows with invalid ${CATALOG_SOURCE_TALABAT} categories.`,
      );
    }

    let createdItemsCount = 0;
    let updatedItemsCount = 0;

    for (const item of newItems) {
      const existingItem = await prisma.catalogItem.findFirst({
        where: {
          source: CATALOG_SOURCE_TALABAT,
          OR: [
            item.external_id
              ? { external_id: item.external_id }
              : { name: item.name, category: item.category },
            { name: item.name, category: item.category },
          ],
        },
        orderBy: { id: 'asc' },
      });

      if (existingItem) {
        await prisma.catalogItem.update({
          where: { id: existingItem.id },
          data: {
            name: item.name,
            price: item.price,
            currency: item.currency,
            image_url: item.image_url,
            category: item.category,
            source: CATALOG_SOURCE_TALABAT,
            external_id: item.external_id,
            is_active: true,
          },
        });
        updatedItemsCount += 1;
        continue;
      }

      await prisma.catalogItem.create({
        data: {
          name: item.name,
          price: item.price,
          currency: item.currency,
          image_url: item.image_url,
          category: item.category,
          source: CATALOG_SOURCE_TALABAT,
          external_id: item.external_id,
          is_active: true,
        },
      });
      createdItemsCount += 1;
    }

    logger.log(
      `Catalog seed synced ${createdItemsCount} new and ${updatedItemsCount} existing items.`,
    );
    logger.log('Seeding completed successfully.');
  } catch (error) {
    logger.error('Seeding failed:', error);
    throw error;
  }
}
