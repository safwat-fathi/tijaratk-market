-- Rebuild every zone snapshot with the active persisted catalog taxonomy.
INSERT INTO "zone_catalog_reconciliations" (
  "source",
  "requested_revision",
  "completed_revision",
  "next_attempt_at",
  "requested_at",
  "updated_at"
)
VALUES
  ('talabat_csv', 1, 0, NOW(), NOW(), NOW()),
  ('chefaa_csv', 1, 0, NOW(), NOW(), NOW())
ON CONFLICT ("source") DO UPDATE
SET "requested_revision" = "zone_catalog_reconciliations"."requested_revision" + 1,
    "next_attempt_at" = NOW(),
    "requested_at" = NOW(),
    "last_error" = NULL,
    "updated_at" = NOW();
