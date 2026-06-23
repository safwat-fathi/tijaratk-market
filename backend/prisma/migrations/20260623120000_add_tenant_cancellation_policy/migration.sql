CREATE TYPE "tenant_cancellation_policy_event_type_enum" AS ENUM (
  'merchant_order_cancelled',
  'warning_issued',
  'auto_suspended',
  'admin_reactivated'
);

CREATE TYPE "tenant_cancellation_policy_actor_type_enum" AS ENUM (
  'merchant',
  'system',
  'admin'
);

CREATE TABLE "tenant_cancellation_policy_states" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "window_start" TIMESTAMPTZ(6) NOT NULL,
  "window_end" TIMESTAMPTZ(6) NOT NULL,
  "cancellation_count" INTEGER NOT NULL DEFAULT 0,
  "warning_threshold" INTEGER NOT NULL DEFAULT 10,
  "suspension_threshold" INTEGER NOT NULL DEFAULT 16,
  "is_probation" BOOLEAN NOT NULL DEFAULT false,
  "last_warning_at" TIMESTAMPTZ(6),
  "last_suspension_at" TIMESTAMPTZ(6),
  "last_suspension_event_id" INTEGER,
  "last_suspension_policy" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PK_tenant_cancellation_policy_states_id" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_cancellation_policy_events" (
  "id" SERIAL NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "order_id" INTEGER,
  "event_type" "tenant_cancellation_policy_event_type_enum" NOT NULL,
  "actor_type" "tenant_cancellation_policy_actor_type_enum" NOT NULL,
  "cancellation_count" INTEGER,
  "threshold" INTEGER,
  "window_start" TIMESTAMPTZ(6),
  "window_end" TIMESTAMPTZ(6),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PK_tenant_cancellation_policy_events_id" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UQ_tenant_cancellation_policy_states_tenant_id"
  ON "tenant_cancellation_policy_states"("tenant_id");

CREATE INDEX "IDX_tenant_cancellation_policy_states_tenant_window"
  ON "tenant_cancellation_policy_states"("tenant_id", "window_start");

CREATE INDEX "IDX_tenant_cancellation_policy_events_tenant_created"
  ON "tenant_cancellation_policy_events"("tenant_id", "created_at");

CREATE INDEX "IDX_tenant_cancellation_policy_events_tenant_type_created"
  ON "tenant_cancellation_policy_events"("tenant_id", "event_type", "created_at");

CREATE INDEX "IDX_tenant_cancellation_policy_events_order_id"
  ON "tenant_cancellation_policy_events"("order_id");

ALTER TABLE "tenant_cancellation_policy_states"
  ADD CONSTRAINT "FK_tenant_cancellation_policy_states_tenant"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "tenant_cancellation_policy_events"
  ADD CONSTRAINT "FK_tenant_cancellation_policy_events_tenant"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "tenant_cancellation_policy_events"
  ADD CONSTRAINT "FK_tenant_cancellation_policy_events_order"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "tenant_cancellation_policy_states" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_tenant_cancellation_policy_states"
ON "tenant_cancellation_policy_states"
USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

ALTER TABLE "tenant_cancellation_policy_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_tenant_cancellation_policy_events"
ON "tenant_cancellation_policy_events"
USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());
