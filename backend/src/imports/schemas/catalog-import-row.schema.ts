import { z } from 'zod';

export enum CatalogImportFormat {
  talabat = 'talabat',
  chefaa = 'chefaa',
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

export type TalabatCatalogImportRow = z.infer<
  typeof TalabatCatalogImportRowSchema
>;
export type ChefaaCatalogImportRow = z.infer<
  typeof ChefaaCatalogImportRowSchema
>;

export type CatalogImportRow =
  | {
      format: CatalogImportFormat.talabat;
      data: TalabatCatalogImportRow;
    }
  | {
      format: CatalogImportFormat.chefaa;
      data: ChefaaCatalogImportRow;
    };

type CatalogImportRowParseResult =
  | { success: true; data: CatalogImportRow }
  | { success: false; error: z.ZodError };

export function detectCatalogImportFormat(
  row: Record<string, unknown>,
): CatalogImportFormat | null {
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
          'Unsupported catalog import format. Expected Talabat or Chefaa CSV headers.',
      },
    ]),
  };
}
