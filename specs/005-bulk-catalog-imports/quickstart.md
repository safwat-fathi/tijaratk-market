# Quickstart Validation Guide: Bulk Catalog Imports (Updates)

## Validation Scenarios

### Scenario 1: Essential Item Import
1. Create a `test-catalog.csv` matching the catalog type format (e.g. Grocery) and include an `is_essential` column.
2. Set `is_essential` to `true` for one row and `false` for another.
3. Upload the CSV through the Admin Imports page.
4. Verify in the database or catalog items list that the imported products have their `is_essential` flag set accurately based on the CSV.

### Scenario 2: CSV Template Download
1. Go to the Admin Catalog Items page (`/admin/catalog-items`).
2. Select the "سوبر ماركت" (Supermarket/Grocery) tab.
3. Click "تنزيل CSV للمنتجات" (Download Products CSV).
4. Verify that the downloaded CSV headers strictly match `TalabatCatalogImportRowSchema` (e.g., `name,price,currency,image_url,product_id,category,is_essential`).
5. Select the "صيدلية" (Pharmacy) tab and click the download button again.
6. Verify that the downloaded CSV headers strictly match `ChefaaCatalogImportRowSchema` (including fields like `product_slug` and `category_path`).
