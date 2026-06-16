-- CreateTable
CREATE TABLE "tenant_hidden_catalog_items" (
    "tenant_id" INTEGER NOT NULL,
    "catalog_item_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_tenant_hidden_catalog_items" PRIMARY KEY ("tenant_id","catalog_item_id")
);

-- CreateIndex
CREATE INDEX "IDX_tenant_hidden_catalog_items_tenant_id" ON "tenant_hidden_catalog_items"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_hidden_catalog_items" ADD CONSTRAINT "tenant_hidden_catalog_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_hidden_catalog_items" ADD CONSTRAINT "tenant_hidden_catalog_items_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
