import { Logger } from '@nestjs/common';
import { PrismaClient } from '../../../generated/prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

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
    
    // Parse the CSV
    const records: any[] = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    const uniqueItemsMap = new Map<string, { name: string, category: string }>();

    for (const record of records) {
      const name = record.name?.trim();
      let category = record.category?.trim();

      if (!name) continue;

      if (!category) {
        category = 'أخرى'; // fallback
      }

      const key = `${name}|${category}`;
      if (!uniqueItemsMap.has(key)) {
        uniqueItemsMap.set(key, { name, category });
      }
    }

    const newItems = Array.from(uniqueItemsMap.values());
    logger.log(`Found ${newItems.length} unique catalog items from CSV.`);

    // Load existing items to avoid duplicates
    const existingItems = await prisma.catalogItem.findMany({
      select: { name: true, category: true }
    });

    const existingSet = new Set(existingItems.map(item => `${item.name}|${item.category}`));

    const itemsToCreate = newItems.filter(item => !existingSet.has(`${item.name}|${item.category}`));

    if (itemsToCreate.length > 0) {
      logger.log(`Creating ${itemsToCreate.length} new catalog items...`);
      await prisma.catalogItem.createMany({
        data: itemsToCreate.map(item => ({
          name: item.name,
          category: item.category,
          is_active: true
        })),
        skipDuplicates: true,
      });
      logger.log(`Created ${itemsToCreate.length} items successfully.`);
    } else {
      logger.log('No new items to create.');
    }

    logger.log('Seeding completed successfully.');
  } catch (error) {
    logger.error('Seeding failed:', error);
    throw error;
  }
}

