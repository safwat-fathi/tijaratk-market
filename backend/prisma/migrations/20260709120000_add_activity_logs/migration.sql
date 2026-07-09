CREATE TYPE "activity_logs_entity_type_enum" AS ENUM (
  'order',
  'product',
  'customer',
  'tenant',
  'user',
  'subscription',
  'day_closure',
  'csv_import'
);

CREATE TYPE "activity_logs_source_enum" AS ENUM (
  'dashboard',
  'storefront',
  'admin',
  'system',
  'whatsapp',
  'csv_import'
);

CREATE TABLE "activity_logs" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER,
  "actor_user_id" INTEGER,
  "actor_admin_id" INTEGER,
  "entity_type" "activity_logs_entity_type_enum" NOT NULL,
  "entity_id" INTEGER,
  "action" VARCHAR(96) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "old_values" JSONB,
  "new_values" JSONB,
  "metadata" JSONB,
  "source" "activity_logs_source_enum" NOT NULL DEFAULT 'dashboard',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PK_activity_logs_id" PRIMARY KEY ("id")
);

CREATE INDEX "IDX_activity_logs_tenant_created_at"
  ON "activity_logs"("tenant_id", "created_at");

CREATE INDEX "IDX_activity_logs_tenant_entity_created_at"
  ON "activity_logs"("tenant_id", "entity_type", "entity_id", "created_at");

CREATE INDEX "IDX_activity_logs_actor_user_created_at"
  ON "activity_logs"("actor_user_id", "created_at");

CREATE INDEX "IDX_activity_logs_actor_admin_created_at"
  ON "activity_logs"("actor_admin_id", "created_at");

CREATE INDEX "IDX_activity_logs_action_created_at"
  ON "activity_logs"("action", "created_at");

ALTER TABLE "activity_logs"
  ADD CONSTRAINT "FK_activity_logs_tenant"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "activity_logs"
  ADD CONSTRAINT "FK_activity_logs_actor_user"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "activity_logs"
  ADD CONSTRAINT "FK_activity_logs_actor_admin"
  FOREIGN KEY ("actor_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "activity_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_logs" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_activity_logs"
ON "activity_logs"
USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

