-- CreateTable
CREATE TABLE "global_customers" (
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(6),
  "id" SERIAL NOT NULL,
  "phone" VARCHAR(32) NOT NULL,
  "access_code" VARCHAR(16) NOT NULL,
  "name" VARCHAR,

  CONSTRAINT "PK_global_customers_id" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "customers" ADD COLUMN "global_customer_id" INTEGER;

-- Backfill one global customer per existing normalized phone.
INSERT INTO "global_customers" ("phone", "access_code", "name", "created_at", "updated_at")
SELECT
  phone,
  UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8)),
  MAX(name),
  MIN(created_at),
  MAX(updated_at)
FROM "customers"
WHERE phone IS NOT NULL AND TRIM(phone) <> ''
GROUP BY phone
ON CONFLICT DO NOTHING;

UPDATE "customers" c
SET "global_customer_id" = gc."id"
FROM "global_customers" gc
WHERE c."phone" = gc."phone";

-- CreateIndex
CREATE UNIQUE INDEX "UQ_global_customers_phone" ON "global_customers"("phone");
CREATE UNIQUE INDEX "UQ_global_customers_access_code" ON "global_customers"("access_code");
CREATE INDEX "IDX_global_customers_access_code" ON "global_customers"("access_code");
CREATE INDEX "IDX_customers_global_customer_id" ON "customers"("global_customer_id");

-- AddForeignKey
ALTER TABLE "customers"
  ADD CONSTRAINT "FK_customers_global_customer"
  FOREIGN KEY ("global_customer_id") REFERENCES "global_customers"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
