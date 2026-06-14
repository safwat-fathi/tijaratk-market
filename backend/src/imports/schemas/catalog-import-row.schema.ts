import { z } from 'zod';

export enum CatalogImportFormat {
  talabat = 'talabat',
  chefaa = 'chefaa',
  carrefour = 'carrefour',
}

const optionalText = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().optional(),
);

/**
 * Validates the supported Talabat catalog import CSV row shape.
 */
export const TalabatCatalogImportRowSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  price: optionalText,
  currency: optionalText,
  image_url: optionalText,
  product_id: optionalText,
  category: optionalText,
});

/**
 * Validates the supported Chefaa catalog import CSV row shape.
 */
export const ChefaaCatalogImportRowSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  price: optionalText,
  currency: optionalText,
  image_url: optionalText,
  product_id: optionalText,
  product_slug: optionalText,
  product_url: optionalText,
  category_path: optionalText,
});

/**
 * Validates the supported Carrefour catalog import CSV row shape.
 */
export const CarrefourCatalogImportRowSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  price: optionalText,
  original_price: optionalText,
  discount_text: optionalText,
  currency: optionalText,
  image_url: optionalText,
  product_url: optionalText,
  product_slug: optionalText,
  product_id: optionalText,
  category_title: optionalText,
  category_title_ar: optionalText,
  category_path: optionalText,
  category_path_ar: optionalText,
  category_url: optionalText,
  source_url: optionalText,
  page_number: optionalText,
  scraped_at: optionalText,
});

export type TalabatCatalogImportRow = z.infer<
  typeof TalabatCatalogImportRowSchema
>;
export type ChefaaCatalogImportRow = z.infer<
  typeof ChefaaCatalogImportRowSchema
>;
export type CarrefourCatalogImportRow = z.infer<
  typeof CarrefourCatalogImportRowSchema
>;

export type CatalogImportRow =
  | {
      format: CatalogImportFormat.talabat;
      data: TalabatCatalogImportRow;
    }
  | {
      format: CatalogImportFormat.chefaa;
      data: ChefaaCatalogImportRow;
    }
  | {
      format: CatalogImportFormat.carrefour;
      data: CarrefourCatalogImportRow;
    };

type CatalogImportRowParseResult =
  | { success: true; data: CatalogImportRow }
  | { success: false; error: z.ZodError };

export function detectCatalogImportFormat(
  row: Record<string, unknown>,
): CatalogImportFormat | null {
  if (
    'category_title' in row ||
    'category_title_ar' in row ||
    'category_path_ar' in row ||
    'source_url' in row ||
    'scraped_at' in row
  ) {
    return CatalogImportFormat.carrefour;
  }

  if ('category_path' in row || 'product_slug' in row) {
    return CatalogImportFormat.chefaa;
  }

  if ('category' in row || 'store_id' in row || 'area_id' in row) {
    return CatalogImportFormat.talabat;
  }

  return null;
}

export function parseCatalogImportRow(
  row: Record<string, unknown>,
): CatalogImportRowParseResult {
  const format = detectCatalogImportFormat(row);

  if (format === CatalogImportFormat.chefaa) {
    const parsed = ChefaaCatalogImportRowSchema.safeParse(row);
    return parsed.success
      ? { success: true, data: { format, data: parsed.data } }
      : parsed;
  }

  if (format === CatalogImportFormat.carrefour) {
    const parsed = CarrefourCatalogImportRowSchema.safeParse(row);
    return parsed.success
      ? { success: true, data: { format, data: parsed.data } }
      : parsed;
  }

  if (format === CatalogImportFormat.talabat) {
    const parsed = TalabatCatalogImportRowSchema.safeParse(row);
    return parsed.success
      ? { success: true, data: { format, data: parsed.data } }
      : parsed;
  }

  return {
    success: false,
    error: new z.ZodError([
      {
        code: 'custom',
        path: [],
        message:
          'Unsupported catalog import format. Expected Talabat, Chefaa, or Carrefour CSV headers.',
      },
    ]),
  };
}
