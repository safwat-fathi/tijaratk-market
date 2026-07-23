import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { extname } from 'path';
import { parse } from 'csv-parse';
import readExcelFile from 'read-excel-file/node';
import { PrismaService } from 'src/prisma/prisma.service';
import { DbTenantContext } from 'src/common/contexts/db-tenant.context';
import { ProductOrderMode } from 'src/common/enums/product-order-mode.enum';
import { ProductSource } from 'src/common/enums/product-source.enum';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { ActivityActions } from 'src/activity-log/constants/activity-actions';
import {
  ActivityEntityTypes,
  ActivitySources,
} from 'src/activity-log/constants/activity-types';
import type { ActivityActor } from 'src/activity-log/activity-log.types';
import {
  Prisma,
  TenantCategory,
} from '../../generated/prisma/client';
import { ProductImportMappingDto } from './dto/product-import.dto';
import { ProductsService } from './products.service';
import {
  type CatalogSource,
  findActiveCatalogCategoryNamesForSource,
  isCatalogCategoryCompatibleWithSource,
  resolveCatalogSourceForTenantCategory,
} from './catalog-source-policy';

const MAX_PRODUCT_IMPORT_ROWS = 5_000;
const PRODUCT_IMPORT_PREVIEW_ROWS = 10;
const PRODUCT_IMPORT_WRITE_CHUNK_SIZE = 250;
const DEFAULT_PRODUCT_CATEGORY = 'أخرى';
const DEFAULT_QUANTITY_UNIT_LABEL = 'قطعة';
const DEFAULT_PHARMACY_QUANTITY_UNIT_LABEL = 'علبة';
const PRODUCT_IMPORT_TRANSACTION_TIMEOUT_MS = 120_000;
const MAX_PRODUCT_PRICE = 99_999_999.99;

type ProductImportCell = string | number | boolean | null;

type ParsedSpreadsheetRow = {
  rowNumber: number;
  cells: ProductImportCell[];
};

type ParsedProductSpreadsheet = {
  format: 'csv' | 'xlsx';
  sheetName: string | null;
  headers: ProductImportCell[];
  rows: ParsedSpreadsheetRow[];
  columnCount: number;
};

type ValidProductImportRow = {
  rowNumber: number;
  normalizedNameKey: string;
  name: string;
  currentPrice: number;
  category?: string;
  imageUrl?: string;
  isAvailable?: boolean;
};

type ExistingProductImportMatch = {
  id: number;
  name: string;
  status: ProductStatus | string;
  source: ProductSource | string;
  category: string;
  current_price: Prisma.Decimal | null;
  catalog_item_id: number | null;
  catalog_item: {
    id: number;
    source: string;
    category: string;
    is_active: boolean;
    deleted_at: Date | null;
  } | null;
};

export type ProductImportColumn = {
  index: number;
  label: string;
  examples: ProductImportCell[];
};

export type ProductImportPreview = {
  file_name: string;
  format: 'csv' | 'xlsx';
  sheet_name: string | null;
  total_rows: number;
  columns: ProductImportColumn[];
  sample_rows: ProductImportCell[][];
};

export type ProductImportRowError = {
  row_number: number;
  field: keyof ProductImportMappingDto | 'row';
  message: string;
};

export type ProductImportSummary = {
  total_rows: number;
  created_rows: number;
  updated_rows: number;
  failed_rows: number;
  errors: ProductImportRowError[];
};

/**
 * Parses, validates, previews, and imports tenant product spreadsheets.
 */
@Injectable()
export class ProductImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
    private readonly productsService: ProductsService,
  ) {}

  /**
   * Returns upload headers and sample rows without persisting any data.
   */
  async preview(file: Express.Multer.File): Promise<ProductImportPreview> {
    const spreadsheet = await this.parseSpreadsheet(file);

    return {
      file_name: file.originalname,
      format: spreadsheet.format,
      sheet_name: spreadsheet.sheetName,
      total_rows: spreadsheet.rows.length,
      columns: Array.from(
        { length: spreadsheet.columnCount },
        (_, index): ProductImportColumn => ({
          index,
          label:
            this.cellToDisplayText(spreadsheet.headers[index]) ||
            `عمود ${index + 1}`,
          examples: spreadsheet.rows
            .map((row) => row.cells[index] ?? null)
            .filter((cell) => !this.isEmptyCell(cell))
            .slice(0, 3),
        }),
      ),
      sample_rows: spreadsheet.rows
        .slice(0, PRODUCT_IMPORT_PREVIEW_ROWS)
        .map((row) =>
          Array.from(
            { length: spreadsheet.columnCount },
            (_, index) => row.cells[index] ?? null,
          ),
        ),
    };
  }

  /**
   * Imports valid spreadsheet rows inside one tenant-scoped transaction.
   */
  async import(
    tenantId: number,
    file: Express.Multer.File,
    mapping: ProductImportMappingDto,
    actor: ActivityActor,
  ): Promise<ProductImportSummary> {
    const spreadsheet = await this.parseSpreadsheet(file);
    this.validateMapping(mapping, spreadsheet.columnCount);

    const { validRows, errors } = this.validateRows(
      spreadsheet.rows,
      mapping,
    );
    const summary: ProductImportSummary = {
      total_rows: spreadsheet.rows.length,
      created_rows: 0,
      updated_rows: 0,
      failed_rows: new Set(errors.map((error) => error.row_number)).size,
      errors,
    };

    if (validRows.length === 0) {
      return summary;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, category: true },
    });
    if (!tenant) {
      throw new NotFoundException('المتجر غير موجود');
    }

    const writeResult = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenantId)}, true)`;

        return DbTenantContext.run({ tenantId, manager: tx }, async () => {
          const existingProducts = await tx.product.findMany({
            where: {
              tenant_id: tenantId,
              deleted_at: null,
            },
            select: {
              id: true,
              name: true,
              status: true,
              source: true,
              category: true,
              current_price: true,
              catalog_item_id: true,
              catalog_item: {
                select: {
                  id: true,
                  source: true,
                  category: true,
                  is_active: true,
                  deleted_at: true,
                },
              },
            },
            orderBy: { updated_at: 'desc' },
          });
          const existingByName = this.buildExistingProductMap(
            existingProducts,
          );
          const rowsToCreate: ValidProductImportRow[] = [];
          const rowsToUpdate: Array<{
            row: ValidProductImportRow;
            product: (typeof existingProducts)[number];
          }> = [];
          const catalogErrors: ProductImportRowError[] = [];
          const allowedCatalogSource =
            resolveCatalogSourceForTenantCategory(tenant.category);
          const activeCatalogCategories = allowedCatalogSource
            ? new Set(
                await findActiveCatalogCategoryNamesForSource(
                  tx,
                  allowedCatalogSource,
                ),
              )
            : new Set<string>();

          for (const row of validRows) {
            const existingProduct = existingByName.get(
              row.normalizedNameKey,
            );
            if (existingProduct) {
              const catalogError =
                this.validateExistingCatalogProductMatch(
                  row,
                  existingProduct,
                  allowedCatalogSource,
                  activeCatalogCategories,
                );
              if (catalogError) {
                catalogErrors.push(catalogError);
                continue;
              }
              rowsToUpdate.push({ row, product: existingProduct });
            } else {
              rowsToCreate.push(row);
            }
          }

          await this.storeCategories(
            tx,
            tenantId,
            [
              ...rowsToCreate.map(
                (row) => row.category || DEFAULT_PRODUCT_CATEGORY,
              ),
              ...rowsToUpdate.flatMap(({ row }) =>
                row.category ? [row.category] : [],
              ),
            ],
          );
          await this.updateExistingProducts(
            tx,
            tenantId,
            rowsToUpdate,
          );
          await this.createNewProducts(
            tx,
            tenantId,
            tenant.category,
            rowsToCreate,
          );

          const counts = {
            createdRows: rowsToCreate.length,
            updatedRows: rowsToUpdate.length,
          };
          const failedRows = new Set([
            ...summary.errors.map((error) => error.row_number),
            ...catalogErrors.map((error) => error.row_number),
          ]).size;

          await this.activityLogService.create(
            {
              tenantId,
              actorUserId: actor.userId ?? null,
              actorAdminId: actor.adminId ?? null,
              actorAdminName: actor.adminName ?? null,
              actorAdminRole: actor.adminRole ?? null,
              managementSessionId: actor.managementSessionId ?? null,
              requestId: actor.requestId ?? null,
              ipAddress: actor.ipAddress ?? null,
              entityType: ActivityEntityTypes.CsvImport,
              action: ActivityActions.ProductCsvImportCompleted,
              title: 'تم استيراد ملف منتجات',
              description: `تم استيراد ${counts.createdRows} منتج جديد وتحديث ${counts.updatedRows} منتج`,
              metadata: {
                file_name: file.originalname,
                file_format: spreadsheet.format,
                total_rows: summary.total_rows,
                created_rows: counts.createdRows,
                updated_rows: counts.updatedRows,
                failed_rows: failedRows,
              },
              source: ActivitySources.CsvImport,
            },
            tx,
          );

          return { ...counts, catalogErrors };
        });
      },
      {
        maxWait: 10_000,
        timeout: PRODUCT_IMPORT_TRANSACTION_TIMEOUT_MS,
      },
    );

    summary.errors.push(...writeResult.catalogErrors);
    summary.failed_rows = new Set(
      summary.errors.map((error) => error.row_number),
    ).size;
    summary.created_rows = writeResult.createdRows;
    summary.updated_rows = writeResult.updatedRows;
    if (summary.created_rows + summary.updated_rows > 0) {
      await this.productsService.refreshAfterProductImport(tenantId);
    }

    return summary;
  }

  /** Parses one supported upload into normalized header and data rows. */
  private async parseSpreadsheet(
    file: Express.Multer.File,
  ): Promise<ParsedProductSpreadsheet> {
    if (!file.buffer?.length) {
      throw new BadRequestException('ملف المنتجات مطلوب');
    }

    const extension = extname(file.originalname).toLowerCase();
    let format: 'csv' | 'xlsx';
    let sheetName: string | null = null;
    let rawRows: unknown[][];

    try {
      if (extension === '.csv') {
        format = 'csv';
        rawRows = await this.parseCsv(file.buffer);
      } else if (extension === '.xlsx') {
        format = 'xlsx';
        const sheets = await readExcelFile(file.buffer);
        const firstNonEmptySheet = sheets.find((sheet) =>
          sheet.data.some((row) => !this.isEmptyRow(row)),
        );
        if (!firstNonEmptySheet) {
          throw new BadRequestException('ملف Excel لا يحتوي على بيانات');
        }
        sheetName = firstNonEmptySheet.sheet;
        rawRows = firstNonEmptySheet.data;
      } else {
        throw new BadRequestException(
          'الصيغة غير مدعومة. استخدم ملف CSV أو XLSX',
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        'تعذر قراءة ملف المنتجات المرفوع',
      );
    }

    const normalizedRows = rawRows.map((row, index) => ({
      rowNumber: index + 1,
      cells: row.map((cell) => this.normalizeCell(cell)),
    }));
    const headerIndex = normalizedRows.findIndex(
      (row) => !this.isEmptyRow(row.cells),
    );
    if (headerIndex < 0) {
      throw new BadRequestException('ملف المنتجات لا يحتوي على عناوين أعمدة');
    }

    const headers = normalizedRows[headerIndex].cells;
    const rows = normalizedRows
      .slice(headerIndex + 1)
      .filter((row) => !this.isEmptyRow(row.cells));

    if (rows.length === 0) {
      throw new BadRequestException(
        'ملف المنتجات لا يحتوي على صفوف منتجات',
      );
    }
    if (rows.length > MAX_PRODUCT_IMPORT_ROWS) {
      throw new BadRequestException(
        `الحد الأقصى للاستيراد هو ${MAX_PRODUCT_IMPORT_ROWS} صف`,
      );
    }

    const columnCount = Math.max(
      headers.length,
      ...rows.map((row) => row.cells.length),
    );
    if (columnCount === 0) {
      throw new BadRequestException('ملف المنتجات لا يحتوي على أعمدة');
    }

    return {
      format,
      sheetName,
      headers,
      rows,
      columnCount,
    };
  }

  /** Parses a CSV buffer while preserving physical row positions. */
  private parseCsv(buffer: Buffer): Promise<unknown[][]> {
    return new Promise((resolve, reject) => {
      parse(
        buffer,
        {
          bom: true,
          relax_column_count: true,
          skip_empty_lines: false,
        },
        (error, records: unknown[][]) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(records);
        },
      );
    });
  }

  /** Validates mapping bounds and prevents source-column reuse. */
  private validateMapping(
    mapping: ProductImportMappingDto,
    columnCount: number,
  ): void {
    const entries = Object.entries(mapping).filter(
      ([, value]) => value !== undefined,
    ) as Array<[keyof ProductImportMappingDto, number]>;
    const usedIndexes = new Set<number>();

    for (const [field, index] of entries) {
      if (!Number.isInteger(index) || index < 0 || index >= columnCount) {
        throw new BadRequestException(
          `العمود المعيّن للحقل ${this.getMappingFieldLabel(field)} غير موجود في الملف`,
        );
      }
      if (usedIndexes.has(index)) {
        throw new BadRequestException(
          'لا يمكن تعيين عمود الملف نفسه لأكثر من حقل',
        );
      }
      usedIndexes.add(index);
    }
  }

  /** Converts raw spreadsheet rows into valid imports and row errors. */
  private validateRows(
    rows: ParsedSpreadsheetRow[],
    mapping: ProductImportMappingDto,
  ): {
    validRows: ValidProductImportRow[];
    errors: ProductImportRowError[];
  } {
    const validRows: ValidProductImportRow[] = [];
    const errors: ProductImportRowError[] = [];
    const importedNames = new Set<string>();

    for (const row of rows) {
      const rowErrors: ProductImportRowError[] = [];
      const name = this.normalizeName(row.cells[mapping.name]);
      if (!name) {
        rowErrors.push(
          this.rowError(row.rowNumber, 'name', 'اسم المنتج مطلوب'),
        );
      } else if (name.length > 120) {
        rowErrors.push(
          this.rowError(
            row.rowNumber,
            'name',
            'اسم المنتج يجب ألا يتجاوز 120 حرفًا',
          ),
        );
      }

      const currentPrice = this.parsePrice(
        row.cells[mapping.current_price],
      );
      if (currentPrice === null) {
        rowErrors.push(
          this.rowError(
            row.rowNumber,
            'current_price',
            'السعر يجب أن يكون رقمًا موجبًا وبحد أقصى منزلتين عشريتين',
          ),
        );
      }

      const category = this.optionalText(
        this.readOptionalCell(row, mapping.category),
      );
      if (category && category.length > 64) {
        rowErrors.push(
          this.rowError(
            row.rowNumber,
            'category',
            'التصنيف يجب ألا يتجاوز 64 حرفًا',
          ),
        );
      }

      const imageUrl = this.optionalText(
        this.readOptionalCell(row, mapping.image_url),
      );
      let isAvailable: boolean | undefined;
      const rawAvailability = this.readOptionalCell(
        row,
        mapping.is_available,
      );
      if (!this.isEmptyCell(rawAvailability)) {
        isAvailable = this.parseAvailability(rawAvailability);
        if (isAvailable === undefined) {
          rowErrors.push(
            this.rowError(
              row.rowNumber,
              'is_available',
              'قيمة الإتاحة غير معروفة',
            ),
          );
        }
      }

      const normalizedNameKey = this.normalizeNameKey(name);
      if (
        normalizedNameKey &&
        importedNames.has(normalizedNameKey)
      ) {
        rowErrors.push(
          this.rowError(
            row.rowNumber,
            'name',
            'اسم المنتج مكرر داخل الملف',
          ),
        );
      }

      if (rowErrors.length > 0 || !name || currentPrice === null) {
        errors.push(...rowErrors);
        continue;
      }

      importedNames.add(normalizedNameKey);
      validRows.push({
        rowNumber: row.rowNumber,
        normalizedNameKey,
        name,
        currentPrice,
        category,
        imageUrl,
        isAvailable,
      });
    }

    return { validRows, errors };
  }

  /** Chooses an active product before archived matches for each name key. */
  private buildExistingProductMap<
    T extends {
      name: string;
      status: ProductStatus | string;
    },
  >(products: T[]): Map<string, T> {
    const result = new Map<string, T>();

    for (const product of products) {
      const key = this.normalizeNameKey(product.name);
      const current = result.get(key);
      if (
        !current ||
        (current.status !== ProductStatus.ACTIVE &&
          product.status === ProductStatus.ACTIVE)
      ) {
        result.set(key, product);
      }
    }

    return result;
  }

  /**
   * Rejects catalog-backed name matches that would cross tenant catalog
   * boundaries or reactivate invalid catalog data.
   */
  private validateExistingCatalogProductMatch(
    row: ValidProductImportRow,
    product: ExistingProductImportMatch,
    allowedSource: CatalogSource | null,
    activeCategories: ReadonlySet<string>,
  ): ProductImportRowError | null {
    const isCatalogBacked =
      product.source === ProductSource.CATALOG ||
      product.catalog_item_id !== null;
    if (!isCatalogBacked) {
      return null;
    }

    const catalogItem = product.catalog_item;
    if (
      !allowedSource ||
      !catalogItem ||
      catalogItem.id !== product.catalog_item_id ||
      catalogItem.source !== allowedSource
    ) {
      return this.rowError(
        row.rowNumber,
        'row',
        'المنتج المطابق مرتبط بكتالوج غير مسموح لهذا المتجر',
      );
    }

    if (!catalogItem.is_active || catalogItem.deleted_at) {
      return this.rowError(
        row.rowNumber,
        'row',
        'عنصر الكتالوج المرتبط بهذا المنتج غير نشط',
      );
    }

    const linkedCategory = catalogItem.category.trim();
    const effectiveCategory = (row.category ?? product.category).trim();
    const categoryIsValid = (category: string) =>
      activeCategories.has(category) &&
      isCatalogCategoryCompatibleWithSource(
        allowedSource,
        category,
      );

    if (
      !categoryIsValid(linkedCategory) ||
      !categoryIsValid(effectiveCategory)
    ) {
      return this.rowError(
        row.rowNumber,
        'category',
        'تصنيف المنتج غير صالح لمصدر كتالوج هذا المتجر',
      );
    }

    return null;
  }

  /** Creates or restores all tenant-specific categories used by an import. */
  private async storeCategories(
    tx: Prisma.TransactionClient,
    tenantId: number,
    rawCategories: string[],
  ): Promise<void> {
    const categories = Array.from(
      new Set(
        rawCategories
          .map((category) => category.trim())
          .filter(Boolean),
      ),
    );
    if (categories.length === 0) {
      return;
    }

    await tx.tenantProductCategory.updateMany({
      where: {
        tenant_id: tenantId,
        name: { in: categories },
        deleted_at: { not: null },
      },
      data: { deleted_at: null },
    });
    await tx.tenantProductCategory.createMany({
      data: categories.map((name) => ({
        tenant_id: tenantId,
        name,
      })),
      skipDuplicates: true,
    });
  }

  /** Applies existing-product updates and changed-price history in batches. */
  private async updateExistingProducts(
    tx: Prisma.TransactionClient,
    tenantId: number,
    rows: Array<{
      row: ValidProductImportRow;
      product: {
        id: number;
        current_price: Prisma.Decimal | null;
      };
    }>,
  ): Promise<void> {
    const priceHistory: Prisma.ProductPriceHistoryCreateManyInput[] = [];

    for (const chunk of this.chunk(rows)) {
      const values = chunk.map(({ row, product }) => {
        if (
          product.current_price === null ||
          Number(product.current_price) !== row.currentPrice
        ) {
          priceHistory.push({
            tenant_id: tenantId,
            product_id: product.id,
            price: row.currentPrice,
            reason: 'Imported from mapped spreadsheet',
          });
        }

        return Prisma.sql`(
          ${product.id}::integer,
          ${row.name}::text,
          ${row.currentPrice}::numeric,
          ${row.category ?? null}::text,
          ${row.imageUrl ?? null}::text,
          ${row.isAvailable ?? null}::boolean
        )`;
      });

      await tx.$executeRaw`
        UPDATE products AS product
        SET
          name = incoming.name,
          current_price = incoming.current_price,
          category = COALESCE(incoming.category, product.category),
          image_url = COALESCE(incoming.image_url, product.image_url),
          is_available = COALESCE(incoming.is_available, product.is_available),
          status = ${ProductStatus.ACTIVE}::products_status_enum,
          price_needs_review = false,
          updated_at = NOW()
        FROM (
          VALUES ${Prisma.join(values)}
        ) AS incoming(
          id,
          name,
          current_price,
          category,
          image_url,
          is_available
        )
        WHERE product.id = incoming.id
          AND product.tenant_id = ${tenantId}
          AND product.deleted_at IS NULL
      `;
    }

    for (const chunk of this.chunk(priceHistory)) {
      await tx.productPriceHistory.createMany({ data: chunk });
    }
  }

  /** Creates new manual products and their initial price history in batches. */
  private async createNewProducts(
    tx: Prisma.TransactionClient,
    tenantId: number,
    tenantCategory: TenantCategory,
    rows: ValidProductImportRow[],
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    const unitLabel =
      tenantCategory === TenantCategory.pharmacy
        ? DEFAULT_PHARMACY_QUANTITY_UNIT_LABEL
        : DEFAULT_QUANTITY_UNIT_LABEL;
    const orderConfig = {
      quantity: {
        unit_label: unitLabel,
        unit_options: [],
      },
    } as Prisma.InputJsonValue;
    const createdProducts: Array<{
      id: number;
      current_price: Prisma.Decimal | null;
    }> = [];

    for (const chunk of this.chunk(rows)) {
      const created = await tx.product.createManyAndReturn({
        data: chunk.map((row) => ({
          tenant_id: tenantId,
          name: row.name,
          current_price: row.currentPrice,
          category: row.category || DEFAULT_PRODUCT_CATEGORY,
          image_url: row.imageUrl || null,
          is_available: row.isAvailable ?? true,
          source: ProductSource.MANUAL,
          status: ProductStatus.ACTIVE,
          order_mode: ProductOrderMode.QUANTITY,
          order_config: orderConfig,
          price_needs_review: false,
        })),
        select: {
          id: true,
          current_price: true,
        },
      });
      createdProducts.push(...created);
    }

    for (const chunk of this.chunk(createdProducts)) {
      await tx.productPriceHistory.createMany({
        data: chunk.map((product) => ({
          tenant_id: tenantId,
          product_id: product.id,
          price: product.current_price as Prisma.Decimal,
          reason: 'Initial price from mapped spreadsheet import',
        })),
      });
    }
  }

  /** Splits database writes into bounded batches. */
  private chunk<T>(items: T[]): T[][] {
    const chunks: T[][] = [];
    for (
      let index = 0;
      index < items.length;
      index += PRODUCT_IMPORT_WRITE_CHUNK_SIZE
    ) {
      chunks.push(
        items.slice(index, index + PRODUCT_IMPORT_WRITE_CHUNK_SIZE),
      );
    }
    return chunks;
  }

  /** Reads an optional mapped cell without treating column zero as absent. */
  private readOptionalCell(
    row: ParsedSpreadsheetRow,
    index: number | undefined,
  ): ProductImportCell | undefined {
    return index === undefined ? undefined : row.cells[index];
  }

  /** Converts parser-specific cell values into JSON-safe primitives. */
  private normalizeCell(value: unknown): ProductImportCell {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }
    return String(value);
  }

  /** Returns whether every cell in a row is empty. */
  private isEmptyRow(row: unknown[]): boolean {
    return row.every((cell) => this.isEmptyCell(cell));
  }

  /** Returns whether one cell has no meaningful value. */
  private isEmptyCell(value: unknown): boolean {
    return (
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim().length === 0)
    );
  }

  /** Converts a cell into trimmed display text and removes spreadsheet BOMs. */
  private cellToDisplayText(value: ProductImportCell | undefined): string {
    if (value === null || value === undefined) return '';
    return String(value).trim().replace(/^[\uFEFF\u200B]/, '');
  }

  /** Normalizes stored product names without changing their letter forms. */
  private normalizeName(value: ProductImportCell | undefined): string {
    return this.cellToDisplayText(value).replace(/\s+/g, ' ');
  }

  /** Builds the tenant duplicate-matching key used by current product policy. */
  private normalizeNameKey(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  /** Returns trimmed optional text while preserving an absent value. */
  private optionalText(
    value: ProductImportCell | undefined,
  ): string | undefined {
    const normalized = this.cellToDisplayText(value);
    return normalized || undefined;
  }

  /** Parses strict positive EGP prices from English or Arabic numerals. */
  private parsePrice(
    value: ProductImportCell | undefined,
  ): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) &&
        value > 0 &&
        value <= MAX_PRODUCT_PRICE &&
        Number(value.toFixed(2)) === value
        ? value
        : null;
    }
    if (typeof value !== 'string') {
      return null;
    }

    let normalized = value
      .trim()
      .replace(/[٠-٩]/g, (digit) =>
        String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)),
      )
      .replace(/[۰-۹]/g, (digit) =>
        String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)),
      )
      .replace(/٬/g, ',')
      .replace(/٫/g, '.')
      .replace(/\s/g, '');

    if (normalized.includes('.') && normalized.includes(',')) {
      normalized = normalized.replace(/,/g, '');
    } else if (normalized.includes(',')) {
      const isThousandsSeparated =
        /^\d{1,3}(,\d{3})+$/.test(normalized);
      normalized = isThousandsSeparated
        ? normalized.replace(/,/g, '')
        : normalized.replace(',', '.');
    }

    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) &&
      parsed > 0 &&
      parsed <= MAX_PRODUCT_PRICE
      ? parsed
      : null;
  }

  /** Parses supported English and Arabic availability values. */
  private parseAvailability(
    value: ProductImportCell | undefined,
  ): boolean | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
      return undefined;
    }

    const normalized = String(value).trim().toLowerCase();
    if (
      ['true', '1', 'yes', 'نعم', 'متاح'].includes(normalized)
    ) {
      return true;
    }
    if (
      ['false', '0', 'no', 'لا', 'غير متاح'].includes(normalized)
    ) {
      return false;
    }
    return undefined;
  }

  /** Builds a field-specific row validation error. */
  private rowError(
    rowNumber: number,
    field: ProductImportRowError['field'],
    message: string,
  ): ProductImportRowError {
    return {
      row_number: rowNumber,
      field,
      message,
    };
  }

  /** Returns the Arabic label used in mapping validation messages. */
  private getMappingFieldLabel(
    field: keyof ProductImportMappingDto,
  ): string {
    const labels: Record<keyof ProductImportMappingDto, string> = {
      name: 'اسم المنتج',
      current_price: 'السعر الحالي',
      category: 'التصنيف',
      image_url: 'رابط الصورة',
      is_available: 'الإتاحة',
    };
    return labels[field];
  }
}
