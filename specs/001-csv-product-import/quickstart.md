# Quickstart: CSV Product Import and Export

## Validation Scenarios

### Scenario 1: Download Template
1. Run backend and frontend servers.
2. Log in as an Admin or Merchant.
3. Navigate to the Products page.
4. Click "Download CSV Template".
5. **Expected Outcome**: A file named `product-import-template.csv` downloads, containing headers like `name,sku,price,stock,description`.

### Scenario 2: Successful Import
1. Add a few valid rows to the downloaded template.
2. Ensure the SKUs do not already exist in the target store.
3. Upload the file via the "Import CSV" button.
4. **Expected Outcome**: A success message shows "Imported X products". The products appear in the list.

### Scenario 3: Validation and Duplicates
1. Upload a CSV where one row has a missing name, and another row has an SKU that already exists in the store.
2. **Expected Outcome**: The import completes, but shows a warning: "Skipped 1 duplicate product. Failed to import 1 product: Row 3 missing name". The valid rows are imported successfully.
