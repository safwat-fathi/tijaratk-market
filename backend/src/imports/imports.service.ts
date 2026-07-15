import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { readdir, rm } from 'fs/promises';
import { basename, dirname, extname, join } from 'path';
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
  detectCatalogImportFormat,
  parseCatalogImportRow,
} from './schemas/catalog-import-row.schema';
import { parse } from 'csv-parse';
import {
  type CatalogSource,
  isCatalogCategoryAllowedForSource,
  normalizeCatalogCategory,
  resolveCatalogSourceForImportFormat,
} from 'src/products/catalog-source-policy';
import { ImageProcessorService } from 'src/common/services/image-processor.service';
import {
  CatalogImportImageService,
  type ExistingCatalogImageState,
} from './services/catalog-import-image.service';
import { parseBooleanLike } from 'src/products/utils/parse-boolean-like';

const EXPECTED_CURRENCY = 'EGP';
const PROGRESS_UPDATE_INTERVAL = 100;
const ROW_ERROR_BATCH_SIZE = 50;

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
  original_image_url?: string | null;
  category: string;
  source: CatalogSource;
  external_id: string | null;
  last_seen_at: Date;
  is_active: boolean;
  is_essential?: boolean;
};

type CatalogReplacementState = {
  source: string | null;
  externalIds: Set<string>;
};

/**
 * Service responsible for creating, tracking, and processing admin imports.
 */
@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);
  private readonly rowErrorBatches = new Map<
    number,
    Prisma.ImportRowErrorCreateManyInput[]
  >();
  private readonly cancelledImports = new Set<number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogImportImageService: CatalogImportImageService,
    private readonly imageProcessorService: ImageProcessorService,
  ) {}

  /**
   * Creates an import run from an uploaded file and starts processing in-process.
   */
  async createImport(
    file: Express.Multer.File,
    body: CreateImportDto,
    images: Express.Multer.File[] = [],
  ) {
    if (body.type !== ImportType.catalog_items) {
      throw new BadRequestException('Only catalog item imports are supported');
    }

    let inferredFormat: CatalogImportFormat | undefined = undefined;
    if (body.catalogType === 'grocery') {
      inferredFormat = CatalogImportFormat.talabat;
    } else if (body.catalogType === 'pharmacy') {
      inferredFormat = CatalogImportFormat.chefaa;
    }

    const importRun = await this.prisma.importRun.create({
      data: {
        type: ImportType.catalog_items,
        mode: (body.mode ?? ImportMode.upsert) as ImportMode,
        status: ImportStatus.pending,
        original_file_name: file.originalname,
        file_path: file.path,
        format: inferredFormat,
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
   * Cancels a running import process.
   */
  async cancelImport(importRunId: number) {
    const importRun = await this.prisma.importRun.findUnique({
      where: { id: importRunId },
    });
    if (!importRun) {
      throw new NotFoundException(`Import run with ID ${importRunId} not found`);
    }

    if (importRun.status !== ImportStatus.processing && importRun.status !== ImportStatus.pending) {
      throw new BadRequestException(`Cannot cancel import with status ${importRun.status}`);
    }

    this.cancelledImports.add(importRunId);
    return { success: true, message: 'Cancellation requested' };
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

    const sessionDir = dirname(importRun.file_path);
    const sessionImagesDir = join(sessionDir, 'images');

    const counters: CatalogImportCounters = {
      totalRows: 0,
      successRows: 0,
      failedRows: 0,
      createdRows: 0,
      updatedRows: 0,
      skippedRows: 0,
    };
    const replacementState: CatalogReplacementState = {
      source: null,
      externalIds: new Set<string>(),
    };

    await this.prisma.importRun.update({
      where: { id: importRunId },
      data: { status: ImportStatus.processing, started_at: new Date() },
    });

    try {
      await this.doProcessCatalogImport(importRunId, importRun, counters, replacementState, sessionImagesDir);
    } catch (error) {
      await this.flushRowErrors(importRunId);
      await this.prisma.importRun.update({
        where: { id: importRunId },
        data: {
          status: ImportStatus.failed,
          error_message: error instanceof Error ? error.message : String(error),
          finished_at: new Date(),
        },
      });
      throw error;
    } finally {
      try {
        await rm(sessionDir, { recursive: true, force: true });
      } catch (cleanupError) {
        this.logger.error(`Failed to clean up session dir ${sessionDir}`, cleanupError);
      }
    }
  }

  private async doProcessCatalogImport(
    importRunId: number,
    importRun: any,
    counters: CatalogImportCounters,
    replacementState: CatalogReplacementState,
    sessionImagesDir: string,
  ) {
    const parser = createReadStream(importRun.file_path).pipe(
      parse({ columns: true, skip_empty_lines: true, trim: true, bom: true }),
    );

    const batchSize = 10;
    let batch: { rowNumber: number; row: Record<string, unknown> }[] = [];

    for await (const row of parser) {
      counters.totalRows += 1;
      batch.push({
        rowNumber: counters.totalRows,
        row: row as Record<string, unknown>,
      });

      if (batch.length >= batchSize) {
        await this.processBatch(
          importRunId,
          batch,
          importRun.mode,
          importRun.format,
          counters,
          replacementState,
          sessionImagesDir,
        );
        batch = [];

        if (this.cancelledImports.has(importRunId)) {
          this.cancelledImports.delete(importRunId);
          await this.flushRowErrors(importRunId);
          await this.prisma.importRun.update({
            where: { id: importRunId },
            data: {
              status: ImportStatus.cancelled,
              error_message: 'تم إلغاء الاستيراد من قبل المستخدم',
              ...this.toImportProgressData(counters),
            },
          });
          return;
        }

        if (counters.totalRows % PROGRESS_UPDATE_INTERVAL === 0) {
          await this.flushRowErrors(importRunId);
          await this.updateImportProgress(importRunId, counters);
        }
      }
    }

    if (batch.length > 0) {
      await this.processBatch(
        importRunId,
        batch,
        importRun.mode,
        importRun.format,
        counters,
        replacementState,
        sessionImagesDir,
      );
      await this.flushRowErrors(importRunId);
      await this.updateImportProgress(importRunId, counters);
    }

    if (
      importRun.mode === ImportMode.replace_source &&
      counters.failedRows === 0
    ) {
      await this.deactivateMissingSourceItems(replacementState, counters);
    }

    await this.flushRowErrors(importRunId);
    await this.finishImport(importRunId, counters);
  }

  private async processBatch(
    importRunId: number,
    batch: { rowNumber: number; row: Record<string, unknown> }[],
    mode: ImportMode,
    format: string | null | undefined,
    counters: CatalogImportCounters,
    replacementState: CatalogReplacementState,
    sessionImagesDir: string,
  ) {
    await Promise.all(
      batch.map((b) =>
        this.processCatalogImportRow(
          importRunId,
          b.rowNumber,
          b.row,
          mode,
          format,
          counters,
          replacementState,
          sessionImagesDir,
        ),
      ),
    );
  }

  private async processCatalogImportRow(
    importRunId: number,
    rowNumber: number,
    row: Record<string, unknown>,
    mode: ImportMode,
    format: string | null | undefined,
    counters: CatalogImportCounters,
    replacementState: CatalogReplacementState,
    sessionImagesDir: string,
  ) {
    if (this.isDuplicateHeaderRow(row)) {
      counters.skippedRows += 1;
      counters.successRows += 1;
      return;
    }

    const effectiveFormat = this.resolveImportFormat(row, format);
    const parsed = parseCatalogImportRow(row, effectiveFormat);
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
      this.trackReplacementSource(mode, itemData, replacementState);
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

      const incomingExternalUrl = itemData.image_url;
      const { finalImageUrl, finalOriginalImageUrl } =
        await this.processCatalogItemImage(
          incomingExternalUrl,
          existingItem,
          itemData.source,
          sessionImagesDir,
        );

      itemData.image_url = finalImageUrl;
      itemData.original_image_url = finalOriginalImageUrl;

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

  private async processCatalogItemImage(
    incomingExternalUrl: string | null,
    existingItem: ExistingCatalogImageState | null,
    source: CatalogItemData['source'],
    sessionImagesDir: string,
  ) {
    if (!incomingExternalUrl || this.isExternalImageUrl(incomingExternalUrl)) {
      return this.catalogImportImageService.processExternalImage({
        source,
        incomingExternalUrl,
        existingItem,
      });
    }

    const localImagePath = await this.resolveStagedLocalImagePath(
      incomingExternalUrl,
      sessionImagesDir,
    );

    if (!localImagePath) {
      throw new Error(
        `Local image matching '${incomingExternalUrl}' was not uploaded in the payload.`,
      );
    }

    const processedUrl =
      await this.imageProcessorService.processProductThumbnail(localImagePath);
    if (existingItem?.image_url && existingItem.image_url !== processedUrl) {
      await this.imageProcessorService.deleteManagedProductImage(
        existingItem.image_url,
      );
    }

    return {
      finalImageUrl: processedUrl,
      finalOriginalImageUrl: incomingExternalUrl,
    };
  }

  /**
   * Resolves a local CSV image reference to the matching staged upload path.
   */
  private async resolveStagedLocalImagePath(
    incomingImageReference: string,
    sessionImagesDir: string,
  ): Promise<string | null> {
    const requestedFileName =
      this.normalizeCatalogImageFileName(incomingImageReference);
    if (!requestedFileName) return null;

    const requestedKeys = this.buildCatalogImageFileNameKeys(requestedFileName);

    let stagedFileNames: string[];
    try {
      stagedFileNames = await readdir(sessionImagesDir);
    } catch (error) {
      if (this.isMissingDirectoryError(error)) {
        return null;
      }
      throw error;
    }

    for (const stagedFileName of stagedFileNames) {
      const candidateFileNames = [
        stagedFileName,
        this.decodeStagedImportImageFileName(stagedFileName),
      ].filter((fileName): fileName is string => Boolean(fileName));

      const candidateKeys = new Set(
        candidateFileNames.flatMap((fileName) =>
          Array.from(this.buildCatalogImageFileNameKeys(fileName)),
        ),
      );

      if (Array.from(candidateKeys).some((key) => requestedKeys.has(key))) {
        return join(sessionImagesDir, stagedFileName);
      }
    }

    return null;
  }

  /**
   * Normalizes an image reference down to a comparable file name.
   */
  private normalizeCatalogImageFileName(value: string): string | null {
    const normalizedPath = value.trim().replace(/\\/g, '/');
    const fileName = basename(normalizedPath).trim().normalize('NFC');
    return fileName || null;
  }

  /**
   * Builds all comparison keys accepted for a catalog image file name.
   */
  private buildCatalogImageFileNameKeys(fileName: string): Set<string> {
    const keys = new Set<string>();

    for (const variant of this.getCatalogImageFileNameVariants(fileName)) {
      const normalizedVariant = this.normalizeCatalogImageFileName(variant);
      if (!normalizedVariant) continue;

      keys.add(normalizedVariant.toLocaleLowerCase('en-US'));
    }

    return keys;
  }

  /**
   * Returns the original and common mojibake-repaired file name variants.
   */
  private getCatalogImageFileNameVariants(fileName: string): string[] {
    const variants = new Set<string>([fileName]);
    const repairedFileName = this.repairMojibakeFileName(fileName);

    if (repairedFileName) {
      variants.add(repairedFileName);
    }

    return Array.from(variants);
  }

  /**
   * Decodes a staged import image name stored as a hex-encoded stem.
   */
  private decodeStagedImportImageFileName(
    stagedFileName: string,
  ): string | null {
    const extension = extname(stagedFileName);
    const encodedName = stagedFileName.substring(
      0,
      stagedFileName.length - extension.length,
    );

    if (!encodedName || !/^[a-f0-9]+$/i.test(encodedName)) {
      return null;
    }

    try {
      return `${Buffer.from(encodedName, 'hex').toString('utf8')}${extension}`;
    } catch {
      return null;
    }
  }

  /**
   * Repairs filenames decoded as Latin-1 even though they were sent as UTF-8.
   */
  private repairMojibakeFileName(fileName: string): string | null {
    try {
      const repaired = Buffer.from(fileName, 'latin1')
        .toString('utf8')
        .normalize('NFC');

      return repaired !== fileName && !repaired.includes('\uFFFD')
        ? repaired
        : null;
    } catch {
      return null;
    }
  }

  /**
   * Detects a missing staged images directory.
   */
  private isMissingDirectoryError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    );
  }

  /**
   * Detects external image URLs that should be downloaded instead of matched.
   */
  private isExternalImageUrl(imageUrl: string): boolean {
    return /^https?:\/\//i.test(imageUrl);
  }

  private trackReplacementSource(
    mode: ImportMode,
    itemData: CatalogItemData,
    replacementState: CatalogReplacementState,
  ) {
    if (mode !== ImportMode.replace_source) return;

    if (!itemData.external_id) {
      throw new Error('Replacement imports require product_id for every row');
    }

    if (!replacementState.source) {
      replacementState.source = itemData.source;
    } else if (replacementState.source !== itemData.source) {
      throw new Error(
        `Replacement imports must contain a single catalog source. Found ${replacementState.source} and ${itemData.source}`,
      );
    }

    replacementState.externalIds.add(itemData.external_id);
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

    const source = resolveCatalogSourceForImportFormat(row.format);
    const categorySource = this.resolveCategorySource(row);
    const category = this.mapCategory(categorySource);
    if (!category || !isCatalogCategoryAllowedForSource(source, category)) {
      throw new Error(`Category ${category} is not allowed for ${source}`);
    }

    return {
      name: row.data.name.trim(),
      price: this.normalizePrice(row.data.price),
      currency,
      image_url: this.normalizeOptionalText(row.data.image_url),
      category,
      source,
      external_id: this.normalizeOptionalText(row.data.product_id),
      last_seen_at: new Date(),
      is_active: true,
      ...('is_essential' in row.data && row.data.is_essential !== undefined
        ? { is_essential: parseBooleanLike(row.data.is_essential) ?? false }
        : {}),
    };
  }

  private resolveCategorySource(row: CatalogImportRow): string | undefined {
    if (row.format === CatalogImportFormat.chefaa) {
      return row.data.category_path || row.data.category;
    }

    if (row.format === CatalogImportFormat.carrefour) {
      return (
        row.data.category_title_ar ||
        row.data.category_path_ar ||
        row.data.category_title ||
        row.data.category_path
      );
    }

    return row.data.category;
  }

  private isDuplicateHeaderRow(row: Record<string, unknown>): boolean {
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (name.toLowerCase() !== 'name') return false;

    const headerLikeFields = [
      'price',
      'currency',
      'image_url',
      'product_id',
      'category',
      'category_title',
      'category_path',
    ];

    return headerLikeFields.some((fieldName) => {
      const value = row[fieldName];
      return (
        typeof value === 'string' &&
        value.trim().toLowerCase() === fieldName.toLowerCase()
      );
    });
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
    return normalizeCatalogCategory(value) ?? '';
  }

  /**
   * Resolves a row format, preferring the import-run format selected by admin.
   */
  private resolveImportFormat(
    row: Record<string, unknown>,
    explicitFormat: string | null | undefined,
  ): CatalogImportFormat | undefined {
    if (this.isCatalogImportFormat(explicitFormat)) {
      return explicitFormat;
    }

    return detectCatalogImportFormat(row) ?? undefined;
  }

  /**
   * Checks whether a stored import format is one of the supported CSV formats.
   */
  private isCatalogImportFormat(
    format: string | null | undefined,
  ): format is CatalogImportFormat {
    return Object.values(CatalogImportFormat).includes(
      format as CatalogImportFormat,
    );
  }

  private async saveRowError(
    importRunId: number,
    rowNumber: number,
    rowData: Record<string, unknown>,
    errorCode: string,
    errorMessage: string,
  ) {
    const batch = this.rowErrorBatches.get(importRunId) ?? [];
    batch.push({
      import_run_id: importRunId,
      row_number: rowNumber,
      row_data: rowData as Prisma.InputJsonValue,
      error_code: errorCode,
      error_message: errorMessage,
    });
    this.rowErrorBatches.set(importRunId, batch);

    if (batch.length >= ROW_ERROR_BATCH_SIZE) {
      await this.flushRowErrors(importRunId);
    }
  }

  private async flushRowErrors(importRunId: number): Promise<void> {
    const batch = this.rowErrorBatches.get(importRunId);
    if (!batch?.length) return;

    this.rowErrorBatches.delete(importRunId);
    await this.prisma.importRowError.createMany({ data: batch });
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

  private async deactivateMissingSourceItems(
    replacementState: CatalogReplacementState,
    counters: CatalogImportCounters,
  ) {
    if (!replacementState.source) {
      throw new Error('Replacement import did not contain any valid rows');
    }

    const result = await this.prisma.catalogItem.updateMany({
      where: {
        source: replacementState.source,
        is_active: true,
        OR: [
          { external_id: null },
          { external_id: { notIn: Array.from(replacementState.externalIds) } },
        ],
      },
      data: {
        is_active: false,
        updated_at: new Date(),
      },
    });

    counters.skippedRows += result.count;
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
