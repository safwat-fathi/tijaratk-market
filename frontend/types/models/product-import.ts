export const PRODUCT_IMPORT_FIELDS = {
  NAME: "name",
  CURRENT_PRICE: "current_price",
  CATEGORY: "category",
  IMAGE_URL: "image_url",
  IS_AVAILABLE: "is_available",
} as const;

export type ProductImportField =
  (typeof PRODUCT_IMPORT_FIELDS)[keyof typeof PRODUCT_IMPORT_FIELDS];

export type ProductImportCell = string | number | boolean | null;

export type ProductImportColumn = {
  index: number;
  label: string;
  examples: ProductImportCell[];
};

export type ProductImportPreview = {
  file_name: string;
  format: "csv" | "xlsx";
  sheet_name: string | null;
  total_rows: number;
  columns: ProductImportColumn[];
  sample_rows: ProductImportCell[][];
};

export type ProductImportMapping = {
  name: number;
  current_price: number;
  category?: number;
  image_url?: number;
  is_available?: number;
};

export type ProductImportRowError = {
  row_number: number;
  field: ProductImportField | "row";
  message: string;
};

export type ProductImportSummary = {
  total_rows: number;
  created_rows: number;
  updated_rows: number;
  failed_rows: number;
  errors: ProductImportRowError[];
};

export type ProductImportActionResult<T> = {
  success: boolean;
  data?: T;
  message?: string;
};
