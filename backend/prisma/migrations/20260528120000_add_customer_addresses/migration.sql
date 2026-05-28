CREATE TABLE "customer_addresses" (
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(6),
  "tenant_id" INTEGER NOT NULL,
  "id" SERIAL NOT NULL,
  "customer_id" INTEGER NOT NULL,
  "address" TEXT NOT NULL,
  "last_used_at" TIMESTAMP(6),

  CONSTRAINT "PK_customer_addresses_id" PRIMARY KEY ("id")
);

ALTER TABLE "customers" DISABLE ROW LEVEL SECURITY;

INSERT INTO "customer_addresses" (
  "tenant_id",
  "customer_id",
  "address",
  "last_used_at",
  "created_at",
  "updated_at"
)
SELECT
  "tenant_id",
  "id",
  btrim("address"),
  "last_order_at",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "customers"
WHERE "address" IS NOT NULL AND btrim("address") <> ''
ON CONFLICT DO NOTHING;

ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX "UQ_customer_addresses_tenant_customer_address"
  ON "customer_addresses" ("tenant_id", "customer_id", "address");

CREATE INDEX "IDX_customer_addresses_customer_id"
  ON "customer_addresses" ("customer_id");

CREATE INDEX "IDX_customer_addresses_tenant_id"
  ON "customer_addresses" ("tenant_id");

ALTER TABLE "customer_addresses"
  ADD CONSTRAINT "FK_customer_addresses_customer"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "customer_addresses"
  ADD CONSTRAINT "FK_customer_addresses_tenant"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "customer_addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_addresses" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_customer_addresses"
ON "customer_addresses"
USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());
