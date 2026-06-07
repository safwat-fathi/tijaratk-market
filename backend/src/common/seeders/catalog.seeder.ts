import { Logger } from '@nestjs/common';
import { PrismaClient } from '../../../generated/prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

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
    let skippedCurrencyCount = 0;
    let skippedNameCount = 0;

    for (const record of records) {
      const name = record.name?.trim();
      if (!name) {
        skippedNameCount += 1;
        continue;
      }

      const currency =
        record.currency?.trim().toUpperCase() || EXPECTED_CATALOG_CURRENCY;
      if (currency !== EXPECTED_CATALOG_CURRENCY) {
        skippedCurrencyCount += 1;
        continue;
      }

      const category = record.category?.trim() || DEFAULT_CATALOG_CATEGORY;
      const productId = normalizeOptionalText(record.product_id);
      const key = productId || `${name}|${category}`;

      if (!uniqueItemsMap.has(key)) {
        uniqueItemsMap.set(key, {
          name,
          price: normalizeCatalogPrice(record.price),
          currency,
          image_url: normalizeOptionalText(record.image_url),
          category,
        });
      }
    }

    const newItems = Array.from(uniqueItemsMap.values());
    logger.log(`Found ${newItems.length} unique catalog items from CSV.`);
    if (skippedCurrencyCount > 0) {
      logger.warn(
        `Skipped ${skippedCurrencyCount} catalog rows with non-EGP currency.`,
      );
    }
    if (skippedNameCount > 0) {
      logger.warn(`Skipped ${skippedNameCount} catalog rows without a name.`);
    }

    let createdItemsCount = 0;
    let updatedItemsCount = 0;

    for (const item of newItems) {
      const existingItem = await prisma.catalogItem.findFirst({
        where: {
          OR: [
            { name: item.name, category: item.category },
            { name: item.name },
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
