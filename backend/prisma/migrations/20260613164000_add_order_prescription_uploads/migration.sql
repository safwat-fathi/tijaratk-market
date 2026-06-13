ALTER TABLE "orders"
  ADD COLUMN "prescription_file_url" TEXT,
  ADD COLUMN "prescription_original_filename" VARCHAR(255),
  ADD COLUMN "prescription_mime_type" VARCHAR(120),
  ADD COLUMN "prescription_unavailability_action" VARCHAR(64);
