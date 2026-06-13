ALTER TABLE "orders"
  ADD COLUMN "delivery_area_id" INTEGER;

ALTER TABLE "customer_addresses"
  ADD COLUMN "area_id" INTEGER;

DROP INDEX IF EXISTS "UQ_customer_addresses_tenant_customer_address";

CREATE UNIQUE INDEX "UQ_customer_addresses_tenant_customer_address_area"
  ON "customer_addresses"("tenant_id", "customer_id", "address", "area_id");

CREATE INDEX "IDX_orders_delivery_area_id" ON "orders"("delivery_area_id");
CREATE INDEX "IDX_customer_addresses_area_id" ON "customer_addresses"("area_id");

ALTER TABLE "orders"
  ADD CONSTRAINT "FK_orders_delivery_area"
  FOREIGN KEY ("delivery_area_id") REFERENCES "directory_areas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "customer_addresses"
  ADD CONSTRAINT "FK_customer_addresses_area"
  FOREIGN KEY ("area_id") REFERENCES "directory_areas"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
