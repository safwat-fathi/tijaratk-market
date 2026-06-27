-- AlterTable
ALTER TABLE "catalog_items"
  ADD COLUMN "is_essential" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "essential_sort_order" INTEGER;

-- Index
CREATE INDEX "IDX_catalog_items_source_essential_category"
  ON "catalog_items"("source", "is_essential", "category");
