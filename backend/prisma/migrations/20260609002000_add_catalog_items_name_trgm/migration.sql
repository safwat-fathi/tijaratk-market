-- Add trigram index to catalog_items.name for fast search
CREATE INDEX "IDX_catalog_items_name_trgm_active" ON "catalog_items" USING GIN (LOWER("name") gin_trgm_ops) WHERE "is_active" = true;
