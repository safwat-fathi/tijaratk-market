# Quickstart Validation Guide: Bulk Catalog Imports

## Overview
This guide provides instructions on how to end-to-end validate the bulk catalog import flow including local image uploads.

## Prerequisites

1. Run the frontend (`pnpm -C frontend dev`).
2. Run the backend (`pnpm -C backend dev`).
3. Prepare a test CSV (`test-catalog.csv`) and a matching image (`test-image.jpg`).

**Example `test-catalog.csv`**:
```csv
name_ar,name_en,category_path,price,image_url,is_active
تفاحة,Apple,Fruits,5.00,test-image.jpg,true
```

## Validation Scenarios

### Scenario 1: Basic Upload with Images

1. Go to the Admin Imports page (`http://localhost:3000/admin/imports`).
2. Fill out the import form:
   - **CSV File**: Select `test-catalog.csv`.
   - **Images**: Select `test-image.jpg`.
   - **Catalog Type**: Select "Grocery".
   - **Mode**: Select "Upsert".
3. Submit the form.
4. **Expected Outcome**:
   - You are redirected to the import details page (`/admin/imports/<id>`).
   - The status updates to `COMPLETED` shortly.
   - The processed thumbnail is generated in `backend/uploads/products/` as a WebP image.
   - Check the `Product` (CatalogItem) in the database to verify `imageUrl` is set to the local WebP path.

### Scenario 2: Missing Image Failure

1. Go to the Admin Imports page.
2. Fill out the import form using the same CSV (`test-catalog.csv`), but **DO NOT** select any images in the file picker.
3. Submit the form.
4. **Expected Outcome**:
   - The import job runs but records a row-level error.
   - The import details page shows 1 error for the row indicating "Local image matching 'test-image.jpg' was not uploaded".
   - The session directory inside `backend/uploads/imports/session-...` is successfully cleaned up after the job completes.
