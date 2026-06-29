export type ImportType = "catalog_items";
export type ImportMode =
  | "create_only"
  | "upsert"
  | "update_only"
  | "replace_source";
export type ImportStatus =
  | "pending"
  | "processing"
  | "success"
  | "failed"
  | "partial_success"
  | "cancelled";
export type ImportFormat = "talabat" | "chefaa" | "carrefour";

export type ImportRun = {
  id: number;
  type: ImportType;
  format?: ImportFormat | null;
  mode: ImportMode;
  status: ImportStatus;
  original_file_name: string;
  file_path?: string | null;
  total_rows: number;
  processed_rows: number;
  success_rows: number;
  failed_rows: number;
  created_rows: number;
  updated_rows: number;
  skipped_rows: number;
  error_message?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type ImportRowError = {
  id: number;
  import_run_id: number;
  row_number: number;
  row_data: Record<string, unknown>;
  error_code?: string | null;
  error_message: string;
  created_at: string;
};
