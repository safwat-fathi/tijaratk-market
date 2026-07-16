ALTER TABLE "tenant_delivery_areas"
ADD COLUMN "delivery_fee" DECIMAL(10, 2);

UPDATE "tenant_delivery_areas" AS delivery_area
SET "delivery_fee" = tenant."delivery_fee"
FROM "tenants" AS tenant
WHERE tenant."id" = delivery_area."tenant_id";

ALTER TABLE "tenant_delivery_areas"
ALTER COLUMN "delivery_fee" SET NOT NULL;
