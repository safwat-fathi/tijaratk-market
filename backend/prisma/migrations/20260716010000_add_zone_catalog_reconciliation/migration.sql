-- Repair contradictory legacy essentials before enforcing the invariant.
UPDATE "catalog_items"
SET "is_active" = true,
    "deleted_at" = NULL,
    "updated_at" = NOW()
WHERE "is_essential" = true
  AND ("is_active" = false OR "deleted_at" IS NOT NULL);

ALTER TABLE "catalog_items"
ADD CONSTRAINT "CK_catalog_items_essential_active_undeleted"
CHECK (
  NOT "is_essential"
  OR ("is_active" = true AND "deleted_at" IS NULL)
);

CREATE TABLE "zone_catalog_reconciliations" (
  "source" VARCHAR(64) NOT NULL,
  "requested_revision" INTEGER NOT NULL DEFAULT 0,
  "completed_revision" INTEGER NOT NULL DEFAULT 0,
  "processing_revision" INTEGER,
  "processing_started_at" TIMESTAMPTZ(6),
  "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "zone_catalog_reconciliations_pkey" PRIMARY KEY ("source"),
  CONSTRAINT "CK_zone_catalog_reconciliations_source"
    CHECK ("source" IN ('talabat_csv', 'chefaa_csv')),
  CONSTRAINT "CK_zone_catalog_reconciliations_revisions"
    CHECK (
      "requested_revision" >= 0
      AND "completed_revision" >= 0
      AND "completed_revision" <= "requested_revision"
    )
);

CREATE INDEX "IDX_zone_catalog_reconciliations_next_attempt"
ON "zone_catalog_reconciliations"("next_attempt_at");
