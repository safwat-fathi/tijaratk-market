-- Main areas are location metadata, not selectable delivery zones. Preserve
-- historical rows and their fees while removing them from active coverage.
UPDATE "tenant_delivery_areas" AS delivery_area
SET
  "is_active" = false,
  "updated_at" = CURRENT_TIMESTAMP
FROM "directory_areas" AS area
WHERE area."id" = delivery_area."area_id"
  AND area."parent_area_id" IS NULL
  AND delivery_area."is_active" = true;
