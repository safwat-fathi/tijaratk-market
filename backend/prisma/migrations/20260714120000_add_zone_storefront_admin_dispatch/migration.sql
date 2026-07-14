ALTER TYPE "orders_source_enum" ADD VALUE IF NOT EXISTS 'zone_storefront';
ALTER TYPE "activity_logs_entity_type_enum" ADD VALUE IF NOT EXISTS 'zone_storefront';
ALTER TYPE "activity_logs_entity_type_enum" ADD VALUE IF NOT EXISTS 'order_dispatch';
ALTER TYPE "admin_audit_logs_entity_type_enum" ADD VALUE IF NOT EXISTS 'zone_storefront';
ALTER TYPE "admin_audit_logs_entity_type_enum" ADD VALUE IF NOT EXISTS 'order_dispatch';

CREATE TYPE "order_dispatches_status_enum" AS ENUM (
  'pending',
  'awaiting_merchant',
  'accepted',
  'cancelled'
);

CREATE TYPE "order_dispatch_assignments_status_enum" AS ENUM (
  'pending',
  'accepted',
  'rejected',
  'revoked',
  'cancelled'
);

CREATE TABLE "zone_storefronts" (
  "id" SERIAL NOT NULL,
  "area_id" INTEGER NOT NULL,
  "operator_tenant_id" INTEGER NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "slug" VARCHAR(120) NOT NULL,
  "operations_phone" VARCHAR(32) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PK_zone_storefronts_id" PRIMARY KEY ("id")
);

CREATE TABLE "zone_storefront_merchants" (
  "id" SERIAL NOT NULL,
  "zone_storefront_id" INTEGER NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PK_zone_storefront_merchants_id" PRIMARY KEY ("id")
);

CREATE TABLE "order_dispatches" (
  "id" SERIAL NOT NULL,
  "order_id" INTEGER NOT NULL,
  "zone_storefront_id" INTEGER NOT NULL,
  "status" "order_dispatches_status_enum" NOT NULL DEFAULT 'pending',
  "version" INTEGER NOT NULL DEFAULT 0,
  "cancellation_reason" TEXT,
  "cancelled_by_admin_id" INTEGER,
  "cancelled_at" TIMESTAMPTZ(6),
  "accepted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PK_order_dispatches_id" PRIMARY KEY ("id")
);

CREATE TABLE "order_dispatch_assignments" (
  "id" SERIAL NOT NULL,
  "order_dispatch_id" INTEGER NOT NULL,
  "target_tenant_id" INTEGER NOT NULL,
  "assigned_by_admin_id" INTEGER NOT NULL,
  "responded_by_user_id" INTEGER,
  "status" "order_dispatch_assignments_status_enum" NOT NULL DEFAULT 'pending',
  "is_current" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT,
  "internal_notes" TEXT,
  "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "responded_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PK_order_dispatch_assignments_id" PRIMARY KEY ("id")
);

CREATE TABLE "order_dispatch_quote_lines" (
  "id" SERIAL NOT NULL,
  "assignment_id" INTEGER NOT NULL,
  "order_item_id" INTEGER NOT NULL,
  "unit_price" DECIMAL(10,2) NOT NULL,
  "total_price" DECIMAL(10,2) NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PK_order_dispatch_quote_lines_id" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UQ_zone_storefronts_area_id"
  ON "zone_storefronts"("area_id");
CREATE UNIQUE INDEX "UQ_zone_storefronts_operator_tenant_id"
  ON "zone_storefronts"("operator_tenant_id");
CREATE UNIQUE INDEX "UQ_zone_storefronts_slug"
  ON "zone_storefronts"("slug");
CREATE INDEX "IDX_zone_storefronts_active_slug"
  ON "zone_storefronts"("is_active", "slug");

CREATE UNIQUE INDEX "UQ_zone_storefront_merchants_zone_tenant"
  ON "zone_storefront_merchants"("zone_storefront_id", "tenant_id");
CREATE INDEX "IDX_zone_storefront_merchants_zone_active_priority"
  ON "zone_storefront_merchants"("zone_storefront_id", "is_active", "priority");
CREATE INDEX "IDX_zone_storefront_merchants_tenant_active"
  ON "zone_storefront_merchants"("tenant_id", "is_active");

CREATE UNIQUE INDEX "UQ_order_dispatches_order_id"
  ON "order_dispatches"("order_id");
CREATE INDEX "IDX_order_dispatches_zone_status_created"
  ON "order_dispatches"("zone_storefront_id", "status", "created_at" DESC);

CREATE UNIQUE INDEX "UQ_order_dispatch_assignments_current_dispatch"
  ON "order_dispatch_assignments"("order_dispatch_id")
  WHERE "is_current" = true;
CREATE INDEX "IDX_order_dispatch_assignments_target_status_current"
  ON "order_dispatch_assignments"("target_tenant_id", "status", "is_current", "assigned_at" DESC);
CREATE INDEX "IDX_order_dispatch_assignments_dispatch_created"
  ON "order_dispatch_assignments"("order_dispatch_id", "created_at");

CREATE UNIQUE INDEX "UQ_order_dispatch_quote_lines_assignment_item"
  ON "order_dispatch_quote_lines"("assignment_id", "order_item_id");
CREATE INDEX "IDX_order_dispatch_quote_lines_order_item"
  ON "order_dispatch_quote_lines"("order_item_id");

ALTER TABLE "zone_storefronts"
  ADD CONSTRAINT "FK_zone_storefronts_area"
  FOREIGN KEY ("area_id") REFERENCES "directory_areas"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "FK_zone_storefronts_operator_tenant"
  FOREIGN KEY ("operator_tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "zone_storefront_merchants"
  ADD CONSTRAINT "FK_zone_storefront_merchants_zone"
  FOREIGN KEY ("zone_storefront_id") REFERENCES "zone_storefronts"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT "FK_zone_storefront_merchants_tenant"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "order_dispatches"
  ADD CONSTRAINT "FK_order_dispatches_order"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT "FK_order_dispatches_zone"
  FOREIGN KEY ("zone_storefront_id") REFERENCES "zone_storefronts"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "FK_order_dispatches_cancelled_by_admin"
  FOREIGN KEY ("cancelled_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "order_dispatch_assignments"
  ADD CONSTRAINT "FK_order_dispatch_assignments_dispatch"
  FOREIGN KEY ("order_dispatch_id") REFERENCES "order_dispatches"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT "FK_order_dispatch_assignments_target_tenant"
  FOREIGN KEY ("target_tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "FK_order_dispatch_assignments_assigning_admin"
  FOREIGN KEY ("assigned_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "FK_order_dispatch_assignments_responding_user"
  FOREIGN KEY ("responded_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "order_dispatch_quote_lines"
  ADD CONSTRAINT "FK_order_dispatch_quote_lines_assignment"
  FOREIGN KEY ("assignment_id") REFERENCES "order_dispatch_assignments"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT "FK_order_dispatch_quote_lines_order_item"
  FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION app.audit_admin_tenant_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  audit_entity_type "admin_audit_logs_entity_type_enum";
BEGIN
  IF NEW."actor_admin_id" IS NULL THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.admin_activity_audit_recorded', true) = 'true' THEN
    RETURN NEW;
  END IF;

  audit_entity_type := CASE NEW."entity_type"::text
    WHEN 'tenant' THEN 'tenant'::"admin_audit_logs_entity_type_enum"
    WHEN 'subscription' THEN 'subscription'::"admin_audit_logs_entity_type_enum"
    WHEN 'csv_import' THEN 'import'::"admin_audit_logs_entity_type_enum"
    WHEN 'product' THEN 'product'::"admin_audit_logs_entity_type_enum"
    WHEN 'order' THEN 'order'::"admin_audit_logs_entity_type_enum"
    WHEN 'zone_storefront' THEN 'zone_storefront'::"admin_audit_logs_entity_type_enum"
    WHEN 'order_dispatch' THEN 'order_dispatch'::"admin_audit_logs_entity_type_enum"
    ELSE NULL
  END;

  INSERT INTO "admin_audit_logs" (
    "actor_admin_id",
    "actor_admin_name_snapshot",
    "actor_admin_role_snapshot",
    "tenant_id",
    "management_session_id",
    "entity_type",
    "entity_id",
    "action",
    "title",
    "outcome",
    "request_id",
    "ip_address",
    "metadata"
  ) VALUES (
    NEW."actor_admin_id",
    NEW."actor_admin_name_snapshot",
    NEW."actor_admin_role_snapshot",
    NEW."tenant_id",
    NEW."management_session_id",
    audit_entity_type,
    NEW."entity_id",
    NEW."action",
    NEW."title",
    'success',
    NEW."request_id",
    NEW."ip_address",
    jsonb_build_object('activity_log_id', NEW."id")
  );

  PERFORM set_config('app.admin_activity_audit_recorded', 'true', true);
  RETURN NEW;
END;
$$;
