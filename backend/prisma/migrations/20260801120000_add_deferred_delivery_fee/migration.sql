-- Zone-level pricing mode: `fixed` keeps today's behaviour, `on_order` defers the
-- fee until the merchant has seen the customer's address.
CREATE TYPE "tenant_delivery_areas_fee_mode_enum" AS ENUM (
  'fixed',
  'on_order'
);

CREATE TYPE "orders_delivery_fee_status_enum" AS ENUM (
  'set',
  'pending'
);

ALTER TABLE "tenant_delivery_areas"
  ADD COLUMN "fee_mode" "tenant_delivery_areas_fee_mode_enum" NOT NULL DEFAULT 'fixed',
  ADD COLUMN "min_delivery_fee" DECIMAL(10, 2),
  ADD COLUMN "max_delivery_fee" DECIMAL(10, 2);

ALTER TABLE "orders"
  ADD COLUMN "delivery_fee_status" "orders_delivery_fee_status_enum" NOT NULL DEFAULT 'set',
  ADD COLUMN "delivery_fee_min_quote" DECIMAL(10, 2),
  ADD COLUMN "delivery_fee_max_quote" DECIMAL(10, 2),
  ADD COLUMN "delivery_fee_set_at" TIMESTAMPTZ(6);

ALTER TYPE "push_notification_event_type_enum"
  ADD VALUE IF NOT EXISTS 'customer_delivery_fee_set';
