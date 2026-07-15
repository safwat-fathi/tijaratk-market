ALTER TABLE "products"
ADD COLUMN "catalog_item_id" INTEGER;

CREATE UNIQUE INDEX "UQ_products_tenant_catalog_item_id"
ON "products"("tenant_id", "catalog_item_id");

CREATE INDEX "IDX_products_catalog_item_id"
ON "products"("catalog_item_id");

ALTER TABLE "products"
ADD CONSTRAINT "FK_products_catalog_item_id"
FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_items"("id")
ON DELETE SET NULL ON UPDATE NO ACTION;
