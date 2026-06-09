ALTER TABLE "availability_requests"
  ADD COLUMN "requested_product_name" VARCHAR(120),
  ADD COLUMN "requested_product_key" VARCHAR(120);

ALTER TABLE "availability_requests"
  ALTER COLUMN "product_id" DROP NOT NULL;

CREATE UNIQUE INDEX "UQ_availability_requests_tenant_custom_visitor_date"
  ON "availability_requests"("tenant_id", "requested_product_key", "visitor_key", "request_date");

CREATE INDEX "IDX_availability_requests_tenant_custom_request_date"
  ON "availability_requests"("tenant_id", "requested_product_key", "request_date");
