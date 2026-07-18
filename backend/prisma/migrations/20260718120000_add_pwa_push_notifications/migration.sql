CREATE TYPE "push_notification_event_type_enum" AS ENUM (
  'merchant_order_created',
  'zone_order_created',
  'zone_assignment_created'
);

CREATE TYPE "push_notification_outbox_status_enum" AS ENUM (
  'pending',
  'processing',
  'sent',
  'dead_letter'
);

CREATE TABLE "push_subscriptions" (
  "id" SERIAL NOT NULL,
  "endpoint_hash" CHAR(64) NOT NULL,
  "encrypted_subscription" TEXT NOT NULL,
  "merchant_user_id" INTEGER,
  "merchant_tenant_id" INTEGER,
  "admin_user_id" INTEGER,
  "expiration_time" TIMESTAMPTZ(6),
  "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PK_push_subscriptions_id" PRIMARY KEY ("id"),
  CONSTRAINT "CK_push_subscriptions_exact_actor" CHECK (
    (
      "merchant_user_id" IS NOT NULL
      AND "merchant_tenant_id" IS NOT NULL
      AND "admin_user_id" IS NULL
    )
    OR (
      "merchant_user_id" IS NULL
      AND "merchant_tenant_id" IS NULL
      AND "admin_user_id" IS NOT NULL
    )
  )
);

CREATE TABLE "push_notification_outbox" (
  "id" SERIAL NOT NULL,
  "event_key" VARCHAR(160) NOT NULL,
  "event_type" "push_notification_event_type_enum" NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "order_id" INTEGER,
  "dispatch_id" INTEGER,
  "assignment_id" INTEGER,
  "zone_id" INTEGER,
  "payload" JSONB NOT NULL,
  "status" "push_notification_outbox_status_enum" NOT NULL DEFAULT 'pending',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMPTZ(6),
  "locked_by" VARCHAR(160),
  "last_error_code" VARCHAR(64),
  "sent_at" TIMESTAMPTZ(6),
  "terminal_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PK_push_notification_outbox_id" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UQ_push_subscriptions_endpoint_hash"
  ON "push_subscriptions"("endpoint_hash");
CREATE INDEX "IDX_push_subscriptions_merchant_actor"
  ON "push_subscriptions"("merchant_tenant_id", "merchant_user_id");
CREATE INDEX "IDX_push_subscriptions_admin_actor"
  ON "push_subscriptions"("admin_user_id");
CREATE INDEX "IDX_push_subscriptions_last_seen"
  ON "push_subscriptions"("last_seen_at");

CREATE UNIQUE INDEX "UQ_push_notification_outbox_event_key"
  ON "push_notification_outbox"("event_key");
CREATE INDEX "IDX_push_notification_outbox_status_next"
  ON "push_notification_outbox"("status", "next_attempt_at");
CREATE INDEX "IDX_push_notification_outbox_locked"
  ON "push_notification_outbox"("locked_at");
CREATE INDEX "IDX_push_notification_outbox_terminal"
  ON "push_notification_outbox"("terminal_at");

ALTER TABLE "push_subscriptions"
  ADD CONSTRAINT "FK_push_subscriptions_merchant_user"
  FOREIGN KEY ("merchant_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "push_subscriptions"
  ADD CONSTRAINT "FK_push_subscriptions_merchant_tenant"
  FOREIGN KEY ("merchant_tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "push_subscriptions"
  ADD CONSTRAINT "FK_push_subscriptions_admin_user"
  FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
