import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ImportMode,
  ImportStatus,
  ImportType,
  Prisma,
} from '../../generated/prisma/client';
import { CreateImportDto } from './dto/create-import.dto';
import {
  CatalogImportRow,
  CatalogImportFormat,
  parseCatalogImportRow,
} from './schemas/catalog-import-row.schema';

const CATALOG_IMPORT_SOURCES: Record<CatalogImportFormat, string> = {
  [CatalogImportFormat.talabat]: 'talabat_csv',
  [CatalogImportFormat.chefaa]: 'chefaa_csv',
};
const DEFAULT_CATEGORY = 'أخرى';
const EXPECTED_CURRENCY = 'EGP';
const PROGRESS_UPDATE_INTERVAL = 100;

const SEEDED_CATEGORIES = new Set([
  'ألبان و بيض',
  'مخبوزات',
  'زيت وسمن',
  'أرز ومكرونة',
  'بقوليات',
  'سكر و دقيق',
  'توابل',
  'صلصات و خل',
  'مشروبات',
  'لحوم و دواجن',
  'مجمدات',
  'سناكس و حلويات',
  'عسل ومربى وشوكولاتة',
  'منظفات ومنتجات ورقية',
  'عناية شخصية',
  'أدوية',
  DEFAULT_CATEGORY,
]);

const PARENT_CATEGORY_MAP = {
  Bakery: 'مخبوزات',
  'Fruit & Veg': DEFAULT_CATEGORY,
  Dairy: 'ألبان و بيض',
  Eggs: 'ألبان و بيض',
  'Rice, Pasta & Pulses': 'أرز ومكرونة',
  'Oil & Ghee': 'زيت وسمن',
  'Herbs & Spices': 'توابل',
  Sauces: 'صلصات و خل',
  Beverages: 'مشروبات',
  'Meat & Poultry': 'لحوم و دواجن',
  Frozen: 'مجمدات',
  'Snacks & Confectionery': 'سناكس و حلويات',
  'Honey, Jam & Spreads': 'عسل ومربى وشوكولاتة',
  Cleaning: 'منظفات ومنتجات ورقية',
  'Personal Care': 'عناية شخصية',
  الأدوية: 'أدوية',
  'العناية بالشعر': 'عناية شخصية',
  'العناية بالبشرة': 'عناية شخصية',
  'العناية اليومية': 'عناية شخصية',
  'الأم والطفل': 'عناية شخصية',
  'المكياج و الاكسسوارات': 'عناية شخصية',
  'المستلزمات الطبية': 'أدوية',
  'الفيتامينات والمكملات': 'أدوية',
  'الصحة الجنسية': 'عناية شخصية',
} as const;

type CatalogImportCounters = {
  totalRows: number;
  successRows: number;
  failedRows: number;
  createdRows: number;
  updatedRows: number;
  skippedRows: number;
};

type CatalogItemData = {
  name: string;
  price: string | null;
  currency: string;
  image_url: string | null;
  category: string;
  source: string;
  external_id: string | null;
  last_seen_at: Date;
  is_active: boolean;
};

/**
 * Service responsible for creating, tracking, and processing admin imports.
 */
@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates an import run from an uploaded file and starts processing in-process.
   */
  async createImport(file: Express.Multer.File, body: CreateImportDto) {
    if (body.type !== ImportType.catalog_items) {
      throw new BadRequestException('Only catalog item imports are supported');
    }

    const importRun = await this.prisma.importRun.create({
      data: {
        type: ImportType.catalog_items,
        mode: (body.mode ?? ImportMode.upsert) as ImportMode,
        status: ImportStatus.pending,
        original_file_name: file.originalname,
        file_path: file.path,
      },
    });

    void this.processCatalogImport(importRun.id).catch((error) => {
      this.logger.error(`Import ${importRun.id} failed`, error);
    });

    return importRun;
  }

  /**
   * Returns recent import runs for the admin dashboard.
   */
  async findAll() {
    return this.prisma.importRun.findMany({
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  /**
   * Returns a single import run by ID.
   */
  async findOne(id: number) {
    const importRun = await this.prisma.importRun.findUnique({ where: { id } });
    if (!importRun) {
      throw new NotFoundException(`Import run with ID ${id} not found`);
    }

    return importRun;
  }

  /**
   * Returns row-level errors for an import run.
   */
  async findErrors(importRunId: number) {
    return this.prisma.importRowError.findMany({
      where: { import_run_id: importRunId },
      orderBy: { row_number: 'asc' },
      take: 200,
    });
  }

  /**
   * Processes a CSV catalog import in the current Node.js process.
   */
  async processCatalogImport(importRunId: number) {
    const importRun = await this.prisma.importRun.findUnique({
      where: { id: importRunId },
    });
    if (!importRun?.file_path) {
      throw new Error(`Import run ${importRunId} has no file path`);
    }

    const counters: CatalogImportCounters = {
      totalRows: 0,
      successRows: 0,
      failedRows: 0,
      createdRows: 0,
      updatedRows: 0,
      skippedRows: 0,
    };

    await this.prisma.importRun.update({
      where: { id: importRunId },
      data: { status: ImportStatus.processing, started_at: new Date() },
    });

    try {
      const parser = createReadStream(importRun.file_path).pipe(
        parse({ columns: true, skip_empty_lines: true, trim: true }),
      );

      for await (const row of parser) {
        counters.totalRows += 1;
        await this.processCatalogImportRow(
          importRunId,
          counters.totalRows,
          row as Record<string, unknown>,
          importRun.mode,
          counters,
        );

        if (counters.totalRows % PROGRESS_UPDATE_INTERVAL === 0) {
          await this.updateImportProgress(importRunId, counters);
        }
      }

      await this.finishImport(importRunId, counters);
    } catch (error) {
      await this.prisma.importRun.update({
        where: { id: importRunId },
        data: {
          status: ImportStatus.failed,
          error_message: error instanceof Error ? error.message : String(error),
          finished_at: new Date(),
        },
      });
      throw error;
    }
  }

  private async processCatalogImportRow(
    importRunId: number,
    rowNumber: number,
    row: Record<string, unknown>,
    mode: ImportMode,
    counters: CatalogImportCounters,
  ) {
    const parsed = parseCatalogImportRow(row);
    if (!parsed.success) {
      counters.failedRows += 1;
      await this.saveRowError(
        importRunId,
        rowNumber,
        row,
        'VALIDATION_ERROR',
        parsed.error.issues.map((issue) => issue.message).join(', '),
      );
      return;
    }

    try {
      const itemData = this.mapCatalogRow(parsed.data);
      const existingItem = await this.findExistingCatalogItem(itemData);

      if (mode === ImportMode.create_only && existingItem) {
        counters.skippedRows += 1;
        counters.successRows += 1;
        return;
      }

      if (mode === ImportMode.update_only && !existingItem) {
        counters.skippedRows += 1;
        counters.successRows += 1;
        return;
      }

      if (existingItem) {
        await this.prisma.catalogItem.update({
          where: { id: existingItem.id },
          data: itemData,
        });
        counters.updatedRows += 1;
      } else {
        await this.prisma.catalogItem.create({ data: itemData });
        counters.createdRows += 1;
      }

      counters.successRows += 1;
    } catch (error) {
      counters.failedRows += 1;
      await this.saveRowError(
        importRunId,
        rowNumber,
        row,
        'IMPORT_ERROR',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async findExistingCatalogItem(itemData: CatalogItemData) {
    if (itemData.external_id) {
      return this.prisma.catalogItem.findUnique({
        where: {
          source_external_id: {
            source: itemData.source,
            external_id: itemData.external_id,
          },
        },
      });
    }

    return this.prisma.catalogItem.findFirst({
      where: { name: itemData.name, category: itemData.category },
      orderBy: { id: 'asc' },
    });
  }

  private mapCatalogRow(row: CatalogImportRow): CatalogItemData {
    const currency = (
      row.data.currency?.trim().toUpperCase() || EXPECTED_CURRENCY
    ).slice(0, 3);
    if (currency !== EXPECTED_CURRENCY) {
      throw new Error(`Unsupported currency: ${currency}`);
    }

    const categorySource =
      row.format === CatalogImportFormat.chefaa
        ? row.data.category_path
        : row.data.category;

    return {
      name: row.data.name.trim(),
      price: this.normalizePrice(row.data.price),
      currency,
      image_url: this.normalizeOptionalText(row.data.image_url),
      category: this.mapCategory(categorySource),
      source: CATALOG_IMPORT_SOURCES[row.format],
      external_id: this.normalizeOptionalText(row.data.product_id),
      last_seen_at: new Date(),
      is_active: true,
    };
  }

  private normalizePrice(value: string | undefined): string | null {
    const normalizedValue = this.normalizeOptionalText(value);
    if (!normalizedValue) return null;

    const numericValue = Number(normalizedValue);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      throw new Error('Price must be a non-negative number');
    }

    return numericValue.toFixed(2);
  }

  private normalizeOptionalText(value: string | undefined): string | null {
    const normalizedValue = value?.trim();
    return normalizedValue || null;
  }

  private mapCategory(value: string | undefined): string {
    const parentCategory = value?.split('>')[0]?.trim();
    if (!parentCategory) return DEFAULT_CATEGORY;

    const mappedCategory =
      PARENT_CATEGORY_MAP[parentCategory as keyof typeof PARENT_CATEGORY_MAP] ??
      DEFAULT_CATEGORY;

    return SEEDED_CATEGORIES.has(mappedCategory)
      ? mappedCategory
      : DEFAULT_CATEGORY;
  }

  private async saveRowError(
    importRunId: number,
    rowNumber: number,
    rowData: Record<string, unknown>,
    errorCode: string,
    errorMessage: string,
  ) {
    await this.prisma.importRowError.create({
      data: {
        import_run_id: importRunId,
        row_number: rowNumber,
        row_data: rowData as Prisma.InputJsonValue,
        error_code: errorCode,
        error_message: errorMessage,
      },
    });
  }

  private async updateImportProgress(
    importRunId: number,
    counters: CatalogImportCounters,
  ) {
    await this.prisma.importRun.update({
      where: { id: importRunId },
      data: this.toImportProgressData(counters),
    });
  }

  private async finishImport(
    importRunId: number,
    counters: CatalogImportCounters,
  ) {
    let status: ImportStatus = ImportStatus.failed;
    if (counters.failedRows === 0) {
      status = ImportStatus.success;
    } else if (counters.successRows > 0) {
      status = ImportStatus.partial_success;
    }

    await this.prisma.importRun.update({
      where: { id: importRunId },
      data: {
        ...this.toImportProgressData(counters),
        status,
        finished_at: new Date(),
      },
    });
  }

  private toImportProgressData(counters: CatalogImportCounters) {
    return {
      total_rows: counters.totalRows,
      processed_rows: counters.totalRows,
      success_rows: counters.successRows,
      failed_rows: counters.failedRows,
      created_rows: counters.createdRows,
      updated_rows: counters.updatedRows,
      skipped_rows: counters.skippedRows,
    };
  }
}
