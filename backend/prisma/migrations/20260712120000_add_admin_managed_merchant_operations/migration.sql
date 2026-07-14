CREATE TYPE "admin_users_role_enum" AS ENUM (
  'platform_admin',
  'operations_admin'
);

CREATE TYPE "admin_management_sessions_end_reason_enum" AS ENUM (
  'user_exit',
  'store_switch',
  'idle_timeout',
  'absolute_timeout',
  'access_revoked',
  'admin_disabled',
  'logout'
);

ALTER TABLE "admin_users"
  ADD COLUMN "role" "admin_users_role_enum" NOT NULL DEFAULT 'platform_admin',
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "admin_users"
  ALTER COLUMN "role" SET DEFAULT 'operations_admin';

CREATE TABLE "admin_tenant_accesses" (
  "id" SERIAL NOT NULL,
  "admin_user_id" INTEGER NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "permissions" JSONB NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "granted_by_admin_id" INTEGER,
  "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6),
  "revoked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PK_admin_tenant_accesses_id" PRIMARY KEY ("id")
);

CREATE TABLE "admin_management_sessions" (
  "id" SERIAL NOT NULL,
  "session_token_hash" CHAR(64) NOT NULL,
  "admin_user_id" INTEGER NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "access_id" INTEGER NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_active_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "ended_at" TIMESTAMPTZ(6),
  "end_reason" "admin_management_sessions_end_reason_enum",
  "ip_address" VARCHAR(64),
  "user_agent" VARCHAR(512),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PK_admin_management_sessions_id" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UQ_admin_tenant_accesses_admin_tenant"
  ON "admin_tenant_accesses"("admin_user_id", "tenant_id");
CREATE INDEX "IDX_admin_tenant_accesses_tenant_active"
  ON "admin_tenant_accesses"("tenant_id", "is_active");
CREATE INDEX "IDX_admin_tenant_accesses_admin_active"
  ON "admin_tenant_accesses"("admin_user_id", "is_active");

CREATE UNIQUE INDEX "UQ_admin_management_sessions_token_hash"
  ON "admin_management_sessions"("session_token_hash");
CREATE UNIQUE INDEX "UQ_admin_management_sessions_one_active_admin"
  ON "admin_management_sessions"("admin_user_id")
  WHERE "ended_at" IS NULL;
CREATE INDEX "IDX_admin_management_sessions_tenant_started"
  ON "admin_management_sessions"("tenant_id", "started_at" DESC);
CREATE INDEX "IDX_admin_management_sessions_admin_ended"
  ON "admin_management_sessions"("admin_user_id", "ended_at");

ALTER TABLE "admin_tenant_accesses"
  ADD CONSTRAINT "FK_admin_tenant_accesses_admin_user"
  FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT "FK_admin_tenant_accesses_tenant"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT "FK_admin_tenant_accesses_granted_by"
  FOREIGN KEY ("granted_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "admin_management_sessions"
  ADD CONSTRAINT "FK_admin_management_sessions_admin_user"
  FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT "FK_admin_management_sessions_tenant"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT "FK_admin_management_sessions_access"
  FOREIGN KEY ("access_id") REFERENCES "admin_tenant_accesses"("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "activity_logs"
  ADD COLUMN "management_session_id" INTEGER,
  ADD COLUMN "request_id" VARCHAR(64),
  ADD COLUMN "ip_address" VARCHAR(64);

CREATE INDEX "IDX_activity_logs_management_session_created_at"
  ON "activity_logs"("management_session_id", "created_at");

ALTER TABLE "activity_logs"
  ADD CONSTRAINT "FK_activity_logs_management_session"
  FOREIGN KEY ("management_session_id") REFERENCES "admin_management_sessions"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
