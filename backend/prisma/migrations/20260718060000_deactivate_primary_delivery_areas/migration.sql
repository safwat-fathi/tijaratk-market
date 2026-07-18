UPDATE "tenant_delivery_areas" AS delivery_area
SET
  "is_active" = false,
  "updated_at" = CURRENT_TIMESTAMP
FROM "tenant_directory_profiles" AS directory_profile
WHERE directory_profile."tenant_id" = delivery_area."tenant_id"
  AND directory_profile."area_id" = delivery_area."area_id"
  AND directory_profile."deleted_at" IS NULL
  AND delivery_area."is_active" = true;
