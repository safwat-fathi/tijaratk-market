-- DropIndex
DROP INDEX "IDX_products_name_normalized_trgm_active";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "deleted_by_id" INTEGER;
