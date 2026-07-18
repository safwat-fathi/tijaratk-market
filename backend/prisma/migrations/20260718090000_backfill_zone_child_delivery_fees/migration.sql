-- Backfill every active direct child of each zone with the operator's legacy
-- parent fee. Existing child-specific fees win; historical rows are retained.
INSERT INTO "tenant_delivery_areas" (
  "tenant_id",
  "area_id",
  "delivery_fee",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  zone."operator_tenant_id",
  child."id",
  COALESCE(parent_fee."delivery_fee", operator."delivery_fee"),
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "zone_storefronts" AS zone
JOIN "tenants" AS operator
  ON operator."id" = zone."operator_tenant_id"
JOIN "directory_areas" AS child
  ON child."parent_area_id" = zone."area_id"
  AND child."is_active" = true
  AND child."deleted_at" IS NULL
LEFT JOIN "tenant_delivery_areas" AS parent_fee
  ON parent_fee."tenant_id" = zone."operator_tenant_id"
  AND parent_fee."area_id" = zone."area_id"
ON CONFLICT ("tenant_id", "area_id") DO UPDATE
SET
  "is_active" = true,
  "deleted_at" = NULL,
  "updated_at" = CURRENT_TIMESTAMP;

-- Operator coverage is valid only for active direct children of its own zone.
-- Deactivate parent, unrelated, deleted, and inactive-area rows without deleting
-- fees or history.
UPDATE "tenant_delivery_areas" AS delivery_area
SET
  "is_active" = false,
  "updated_at" = CURRENT_TIMESTAMP
FROM "zone_storefronts" AS zone
WHERE delivery_area."tenant_id" = zone."operator_tenant_id"
  AND delivery_area."is_active" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "directory_areas" AS child
    WHERE child."id" = delivery_area."area_id"
      AND child."parent_area_id" = zone."area_id"
      AND child."is_active" = true
      AND child."deleted_at" IS NULL
  );
