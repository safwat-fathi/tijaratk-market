DO $$ BEGIN
  CREATE TYPE "import_runs_type_enum" AS ENUM ('catalog_items');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "import_runs_mode_enum" AS ENUM ('create_only', 'upsert', 'update_only');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "import_runs_status_enum" AS ENUM ('pending', 'processing', 'success', 'failed', 'partial_success');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "catalog_items"
  ADD COLUMN IF NOT EXISTS "source" VARCHAR(64) NOT NULL DEFAULT 'seed',
  ADD COLUMN IF NOT EXISTS "external_id" VARCHAR(128),
  ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMP(6);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_catalog_items_source_external_id"
  ON "catalog_items"("source", "external_id");

CREATE TABLE IF NOT EXISTS "import_runs" (
  "id" SERIAL PRIMARY KEY,
  "type" "import_runs_type_enum" NOT NULL,
  "mode" "import_runs_mode_enum" NOT NULL DEFAULT 'upsert',
  "status" "import_runs_status_enum" NOT NULL DEFAULT 'pending',
  "original_file_name" VARCHAR NOT NULL,
  "file_path" VARCHAR,
  "total_rows" INTEGER NOT NULL DEFAULT 0,
  "processed_rows" INTEGER NOT NULL DEFAULT 0,
  "success_rows" INTEGER NOT NULL DEFAULT 0,
  "failed_rows" INTEGER NOT NULL DEFAULT 0,
  "created_rows" INTEGER NOT NULL DEFAULT 0,
  "updated_rows" INTEGER NOT NULL DEFAULT 0,
  "skipped_rows" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "started_at" TIMESTAMP(6),
  "finished_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "IDX_import_runs_type_status_created_at"
  ON "import_runs"("type", "status", "created_at");

CREATE TABLE IF NOT EXISTS "import_row_errors" (
  "id" SERIAL PRIMARY KEY,
  "import_run_id" INTEGER NOT NULL,
  "row_number" INTEGER NOT NULL,
  "row_data" JSONB NOT NULL,
  "error_code" VARCHAR(64),
  "error_message" TEXT NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_row_errors_import_run_id_fkey"
    FOREIGN KEY ("import_run_id") REFERENCES "import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_import_row_errors_import_run_id"
  ON "import_row_errors"("import_run_id");
