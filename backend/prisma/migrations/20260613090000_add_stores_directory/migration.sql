CREATE TYPE "orders_source_enum" AS ENUM ('storefront', 'directory', 'whatsapp', 'manual');
CREATE TYPE "tenant_directory_status_enum" AS ENUM ('draft', 'listed', 'hidden', 'suspended');
CREATE TYPE "directory_events_type_enum" AS ENUM (
  'area_page_visit',
  'category_page_visit',
  'store_click',
  'whatsapp_click',
  'storefront_order_created'
);

ALTER TABLE "orders"
  ADD COLUMN "order_source" "orders_source_enum" NOT NULL DEFAULT 'storefront',
  ADD COLUMN "source_metadata" JSONB;

CREATE TABLE "directory_areas" (
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(6),
  "id" SERIAL NOT NULL,
  "name_ar" VARCHAR(120) NOT NULL,
  "name_en" VARCHAR(120),
  "slug" VARCHAR(120) NOT NULL,
  "city" VARCHAR(120),
  "governorate" VARCHAR(120),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "seo_title" VARCHAR(180),
  "seo_description" VARCHAR(300),
  CONSTRAINT "PK_directory_areas_id" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_directory_profiles" (
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(6),
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "area_id" INTEGER,
  "directory_status" "tenant_directory_status_enum" NOT NULL DEFAULT 'draft',
  "display_name" VARCHAR(120),
  "logo_url" TEXT,
  "cover_url" TEXT,
  "address" TEXT,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "seo_title" VARCHAR(180),
  "seo_description" VARCHAR(300),
  "profile_completion_score" INTEGER NOT NULL DEFAULT 0,
  "missing_fields" JSONB,
  CONSTRAINT "PK_tenant_directory_profiles_id" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_delivery_areas" (
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(6),
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "area_id" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "PK_tenant_delivery_areas_id" PRIMARY KEY ("id")
);

CREATE TABLE "directory_events" (
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "id" SERIAL NOT NULL,
  "event_type" "directory_events_type_enum" NOT NULL,
  "tenant_id" INTEGER,
  "area_id" INTEGER,
  "category_slug" VARCHAR(64),
  "visitor_key" VARCHAR(128),
  "metadata" JSONB,
  CONSTRAINT "PK_directory_events_id" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UQ_directory_areas_slug" ON "directory_areas"("slug");
CREATE INDEX "IDX_directory_areas_active_sort_name" ON "directory_areas"("is_active", "sort_order", "name_ar");

CREATE UNIQUE INDEX "UQ_tenant_directory_profiles_tenant_id" ON "tenant_directory_profiles"("tenant_id");
CREATE INDEX "IDX_tenant_directory_profiles_area_id" ON "tenant_directory_profiles"("area_id");
CREATE INDEX "IDX_tenant_directory_profiles_status" ON "tenant_directory_profiles"("directory_status");

CREATE UNIQUE INDEX "UQ_tenant_delivery_areas_tenant_area" ON "tenant_delivery_areas"("tenant_id", "area_id");
CREATE INDEX "IDX_tenant_delivery_areas_area_active" ON "tenant_delivery_areas"("area_id", "is_active");
CREATE INDEX "IDX_tenant_delivery_areas_tenant_active" ON "tenant_delivery_areas"("tenant_id", "is_active");

CREATE INDEX "IDX_directory_events_type_created" ON "directory_events"("event_type", "created_at");
CREATE INDEX "IDX_directory_events_tenant_type_created" ON "directory_events"("tenant_id", "event_type", "created_at");
CREATE INDEX "IDX_directory_events_area_type_created" ON "directory_events"("area_id", "event_type", "created_at");

ALTER TABLE "tenant_directory_profiles"
  ADD CONSTRAINT "FK_tenant_directory_profiles_tenant"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "tenant_directory_profiles"
  ADD CONSTRAINT "FK_tenant_directory_profiles_area"
  FOREIGN KEY ("area_id") REFERENCES "directory_areas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "tenant_delivery_areas"
  ADD CONSTRAINT "FK_tenant_delivery_areas_tenant"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "tenant_delivery_areas"
  ADD CONSTRAINT "FK_tenant_delivery_areas_area"
  FOREIGN KEY ("area_id") REFERENCES "directory_areas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "directory_events"
  ADD CONSTRAINT "FK_directory_events_tenant"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "directory_events"
  ADD CONSTRAINT "FK_directory_events_area"
  FOREIGN KEY ("area_id") REFERENCES "directory_areas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
