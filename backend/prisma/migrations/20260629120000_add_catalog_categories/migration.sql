CREATE TABLE IF NOT EXISTS "catalog_categories" (
  "id" SERIAL PRIMARY KEY,
  "source" VARCHAR(64) NOT NULL,
  "name" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(6)
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_catalog_categories_source_name"
  ON "catalog_categories"("source", "name");

CREATE INDEX IF NOT EXISTS "IDX_catalog_categories_source_deleted_at"
  ON "catalog_categories"("source", "deleted_at");

INSERT INTO "catalog_categories" ("source", "name")
VALUES
  ('talabat_csv', 'ألبان و بيض'),
  ('talabat_csv', 'مخبوزات'),
  ('talabat_csv', 'زيت وسمن'),
  ('talabat_csv', 'أرز ومكرونة'),
  ('talabat_csv', 'بقوليات'),
  ('talabat_csv', 'سكر و دقيق'),
  ('talabat_csv', 'توابل'),
  ('talabat_csv', 'صلصات و خل'),
  ('talabat_csv', 'مشروبات'),
  ('talabat_csv', 'لحوم و دواجن'),
  ('talabat_csv', 'مجمدات'),
  ('talabat_csv', 'سناكس و حلويات'),
  ('talabat_csv', 'شيبس ومقبلات'),
  ('talabat_csv', 'عسل ومربى وشوكولاتة'),
  ('talabat_csv', 'منظفات ومنتجات ورقية'),
  ('talabat_csv', 'عناية شخصية'),
  ('talabat_csv', 'أخرى'),
  ('chefaa_csv', 'أدوية'),
  ('chefaa_csv', 'عناية شخصية')
ON CONFLICT ("source", "name") DO UPDATE
SET "deleted_at" = NULL,
    "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "tenant_product_categories" ("tenant_id", "name")
SELECT DISTINCT "tenant_id", LEFT(TRIM("category"), 64)
FROM "products"
WHERE "deleted_at" IS NULL
  AND NULLIF(TRIM("category"), '') IS NOT NULL
ON CONFLICT ("tenant_id", "name") DO UPDATE
SET "deleted_at" = NULL,
    "updated_at" = CURRENT_TIMESTAMP;
