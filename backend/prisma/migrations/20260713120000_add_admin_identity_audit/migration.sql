CREATE TYPE "admin_audit_logs_outcome_enum" AS ENUM (
  'success',
  'denied'
);

CREATE TYPE "admin_audit_logs_entity_type_enum" AS ENUM (
  'admin',
  'tenant',
  'subscription',
  'catalog_item',
  'catalog_category',
  'import',
  'area',
  'product',
  'order',
  'management_session'
);

ALTER TABLE "activity_logs"
  ADD COLUMN "actor_admin_name_snapshot" VARCHAR(160),
  ADD COLUMN "actor_admin_role_snapshot" "admin_users_role_enum";

-- FORCE RLS also applies to the migration owner, so temporarily disable it for
-- the trusted backfill and restore both RLS flags immediately afterwards.
ALTER TABLE "activity_logs" DISABLE ROW LEVEL SECURITY;

UPDATE "activity_logs" AS activity
SET
  "actor_admin_name_snapshot" = admin_user."name",
  "actor_admin_role_snapshot" = admin_user."role"
FROM "admin_users" AS admin_user
WHERE activity."actor_admin_id" = admin_user."id";

ALTER TABLE "activity_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_logs" FORCE ROW LEVEL SECURITY;

ALTER TABLE "activity_logs"
  ADD CONSTRAINT "CHK_activity_logs_admin_snapshot"
  CHECK (
    "actor_admin_id" IS NULL
    OR (
      "actor_admin_name_snapshot" IS NOT NULL
      AND "actor_admin_role_snapshot" IS NOT NULL
    )
  );

CREATE TABLE "admin_audit_logs" (
  "id" SERIAL NOT NULL,
  "actor_admin_id" INTEGER,
  "actor_admin_name_snapshot" VARCHAR(160),
  "actor_admin_role_snapshot" "admin_users_role_enum",
  "tenant_id" INTEGER,
  "management_session_id" INTEGER,
  "entity_type" "admin_audit_logs_entity_type_enum",
  "entity_id" INTEGER,
  "action" VARCHAR(96) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "outcome" "admin_audit_logs_outcome_enum" NOT NULL DEFAULT 'success',
  "request_id" VARCHAR(64),
  "ip_address" VARCHAR(64),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PK_admin_audit_logs_id" PRIMARY KEY ("id"),
  CONSTRAINT "CHK_admin_audit_logs_actor_snapshot" CHECK (
    "actor_admin_id" IS NULL
    OR (
      "actor_admin_name_snapshot" IS NOT NULL
      AND "actor_admin_role_snapshot" IS NOT NULL
    )
  )
);

CREATE INDEX "IDX_admin_audit_logs_created_id"
  ON "admin_audit_logs"("created_at" DESC, "id" DESC);

CREATE INDEX "IDX_admin_audit_logs_actor_created"
  ON "admin_audit_logs"("actor_admin_id", "created_at" DESC);

CREATE INDEX "IDX_admin_audit_logs_tenant_created"
  ON "admin_audit_logs"("tenant_id", "created_at" DESC);

CREATE INDEX "IDX_admin_audit_logs_action_outcome_created"
  ON "admin_audit_logs"("action", "outcome", "created_at" DESC);

CREATE INDEX "IDX_admin_audit_logs_request_id"
  ON "admin_audit_logs"("request_id");

ALTER TABLE "admin_audit_logs"
  ADD CONSTRAINT "FK_admin_audit_logs_actor_admin"
  FOREIGN KEY ("actor_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION,
  ADD CONSTRAINT "FK_admin_audit_logs_tenant"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION,
  ADD CONSTRAINT "FK_admin_audit_logs_management_session"
  FOREIGN KEY ("management_session_id") REFERENCES "admin_management_sessions"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

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

CREATE TRIGGER "TRG_activity_logs_admin_audit"
AFTER INSERT ON "activity_logs"
FOR EACH ROW
EXECUTE FUNCTION app.audit_admin_tenant_activity();
