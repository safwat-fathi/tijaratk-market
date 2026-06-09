ALTER TABLE "availability_requests"
  ADD COLUMN "customer_name" VARCHAR(120),
  ADD COLUMN "customer_phone" VARCHAR(32),
  ADD COLUMN "customer_address" TEXT,
  ADD COLUMN "customer_notes" TEXT;

CREATE INDEX "IDX_availability_requests_tenant_customer_phone"
  ON "availability_requests"("tenant_id", "customer_phone");
