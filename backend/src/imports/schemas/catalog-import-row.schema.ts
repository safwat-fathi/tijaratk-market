import { z } from 'zod';

const optionalText = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().optional(),
);

/**
 * Validates the supported catalog import CSV row shape.
 */
export const CatalogImportRowSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  price: optionalText,
  currency: optionalText,
  image_url: optionalText,
  product_id: optionalText,
  category: optionalText,
});

export type CatalogImportRow = z.infer<typeof CatalogImportRowSchema>;
