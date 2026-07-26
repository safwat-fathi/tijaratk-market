ALTER TYPE "push_notification_event_type_enum"
  ADD VALUE IF NOT EXISTS 'customer_order_status_changed';

ALTER TYPE "push_notification_event_type_enum"
  ADD VALUE IF NOT EXISTS 'customer_replacement_requested';

ALTER TABLE "push_subscriptions"
  ADD COLUMN "customer_device_token_hash" CHAR(64);

ALTER TABLE "push_subscriptions"
  DROP CONSTRAINT "CK_push_subscriptions_exact_actor";

ALTER TABLE "push_subscriptions"
  ADD CONSTRAINT "CK_push_subscriptions_exact_actor" CHECK (
    (
      "merchant_user_id" IS NOT NULL
      AND "merchant_tenant_id" IS NOT NULL
      AND "admin_user_id" IS NULL
      AND "customer_device_token_hash" IS NULL
    )
    OR (
      "merchant_user_id" IS NULL
      AND "merchant_tenant_id" IS NULL
      AND "admin_user_id" IS NOT NULL
      AND "customer_device_token_hash" IS NULL
    )
    OR (
      "merchant_user_id" IS NULL
      AND "merchant_tenant_id" IS NULL
      AND "admin_user_id" IS NULL
      AND "customer_device_token_hash" IS NOT NULL
    )
  );

CREATE UNIQUE INDEX "UQ_push_subscriptions_customer_device_token_hash"
  ON "push_subscriptions"("customer_device_token_hash");

CREATE TABLE "push_subscription_customers" (
  "id" SERIAL NOT NULL,
  "push_subscription_id" INTEGER NOT NULL,
  "global_customer_id" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PK_push_subscription_customers_id" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UQ_push_subscription_customers_pair"
  ON "push_subscription_customers"(
    "push_subscription_id",
    "global_customer_id"
  );

CREATE INDEX "IDX_push_subscription_customers_customer"
  ON "push_subscription_customers"(
    "global_customer_id",
    "push_subscription_id"
  );

CREATE INDEX "IDX_push_subscription_customers_subscription"
  ON "push_subscription_customers"("push_subscription_id");

ALTER TABLE "push_subscription_customers"
  ADD CONSTRAINT "FK_push_subscription_customers_subscription"
  FOREIGN KEY ("push_subscription_id") REFERENCES "push_subscriptions"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "push_subscription_customers"
  ADD CONSTRAINT "FK_push_subscription_customers_global_customer"
  FOREIGN KEY ("global_customer_id") REFERENCES "global_customers"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
