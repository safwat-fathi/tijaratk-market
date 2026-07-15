ALTER TABLE "zone_storefronts"
  ADD COLUMN "category" "tenants_category_enum";

UPDATE "zone_storefronts" AS zone
SET "category" = tenant."category"
FROM "tenants" AS tenant
WHERE tenant."id" = zone."operator_tenant_id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "zone_storefronts"
    WHERE "category" IS NULL
       OR "category" NOT IN ('grocery', 'pharmacy')
  ) THEN
    RAISE EXCEPTION
      'Cannot migrate zone storefront categories: every operator must be grocery or pharmacy';
  END IF;
END
$$;

ALTER TABLE "zone_storefronts"
  ALTER COLUMN "category" SET NOT NULL,
  ADD CONSTRAINT "CHK_zone_storefronts_category"
    CHECK ("category" IN ('grocery', 'pharmacy'));

DROP INDEX "UQ_zone_storefronts_area_id";

CREATE UNIQUE INDEX "UQ_zone_storefronts_area_category"
  ON "zone_storefronts"("area_id", "category");
