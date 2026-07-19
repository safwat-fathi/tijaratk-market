ALTER TABLE "orders"
ADD COLUMN "scheduled_delivery_date" DATE,
ADD COLUMN "scheduled_delivery_starts_at" VARCHAR(5),
ADD COLUMN "scheduled_delivery_ends_at" VARCHAR(5);

CREATE INDEX "IDX_orders_tenant_scheduled_delivery"
ON "orders"("tenant_id", "scheduled_delivery_date", "scheduled_delivery_starts_at");
