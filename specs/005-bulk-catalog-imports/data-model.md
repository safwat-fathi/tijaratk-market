# Data Model: Bulk Catalog Imports (Updates)

## Entity Updates

### `CatalogImportRowSchema` (Zod)
- **File**: `backend/src/imports/schemas/catalog-import-row.schema.ts`
- **Updates**:
  - Add `is_essential: optionalText` to `TalabatCatalogImportRowSchema`.
  - Add `is_essential: optionalText` to `ChefaaCatalogImportRowSchema`.

### `CatalogItem` (Prisma)
- **File**: `backend/prisma/schema.prisma`
- **Field**: `is_essential` (Boolean) - Already exists.
- **Mapping**: The `import-worker.service.ts` will parse the string value of `is_essential` from the CSV row and map it to a boolean when upserting the `CatalogItem`.

### Export Columns (AdminService)
- **File**: `backend/src/admin/admin.service.ts`
- **Updates**:
  - Replace `CATALOG_EXPORT_COLUMNS` with source-specific export column definitions.
  - `TALABAT_EXPORT_COLUMNS`: `['name', 'price', 'currency', 'image_url', 'product_id', 'category', 'is_essential']`
  - `CHEFAA_EXPORT_COLUMNS`: `['name', 'price', 'currency', 'image_url', 'product_id', 'product_slug', 'product_url', 'category_path', 'category', 'is_essential']`
