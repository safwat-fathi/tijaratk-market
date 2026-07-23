# Admin Product Spreadsheet Mapping Wizard

## Summary

Add an Arabic four-step import wizard to the managed store products page:
upload, map columns, review a sample, and confirm/results. Support CSV and
XLSX files, upsert manual store products, and preserve the audited managed
admin-session security model.

## Backend

- Add a focused product import service and validated multipart DTOs.
- Add preview and import routes under
  `/admin/managed-tenants/:tenantId/products/import`.
- Accept CSV and XLSX files up to 5 MB and 5,000 non-empty rows. Read the
  first non-empty worksheet and use the first non-empty row as headers.
- Map source columns by index to required `name` and `current_price`, plus
  optional `category`, `image_url`, and `is_available`.
- Import valid rows, return row/field errors for invalid rows, create missing
  tenant categories, preserve blank optional values on updates, reactivate
  archived matches, and record price history only for initial/new prices or
  changed existing prices.
- Keep imported products manual and tenant-scoped. Do not write catalog items
  or bypass the centralized catalog source policy.
- Require the managed create, update, and update-price permissions, plus
  update-availability when that column is mapped.

## Frontend

- Add typed admin-service methods and server actions for preview and import.
- Add the wizard beside the existing add-product action on the managed store
  products page.
- Suggest common Arabic and English header mappings, allow manual correction,
  show ten mapped sample rows, report results and errors, and refresh products
  after a successful import.
- Keep the global admin products page read-only and leave the merchant CSV
  importer unchanged.

## Verification

- Do not add unit tests or run repository verification commands as an AI
  agent.
- The user installs `read-excel-file` and runs backend/frontend lint commands,
  then shares the output for follow-up.
