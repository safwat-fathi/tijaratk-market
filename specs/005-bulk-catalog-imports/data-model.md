# Data Model: Bulk Catalog Item Imports with Local Images

**Branch**: `005-bulk-catalog-imports`

## Entities

The underlying database schema relies on the existing Prisma schema, specifically the `ImportRun`, `ImportRowError`, and `CatalogItem` models. This feature does not require database migrations, but rather changes how we handle file artifacts before they reach the database layer.

### 1. File Staging Structure (Ephemeral / Disk)

Before insertion into the database, data is represented on disk:
- `uploads/imports/session-{timestamp}-{randomId}/`
  - `catalog.csv` (The CSV payload)
  - `images/` (Directory containing raw uploaded images)
    - `example1.jpg`
    - `example2.png`

### 2. ImportRun (Existing Prisma Model)

Tracks the overall import job.

**Key Fields**:
- `id`: String (UUID)
- `mode`: Enum (`UPSERT`, `REPLACE_SOURCE`, `CREATE_ONLY`, `UPDATE_ONLY`)
- `format`: String (The inferred source format: `talabat`, `carrefour`, `chefaa`)
- `status`: Enum (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`)
- `totalRows`: Int
- `processedRows`: Int
- `errorCount`: Int
- `createdAt` / `updatedAt`: DateTime

### 3. ImportRowError (Existing Prisma Model)

Tracks individual row failures.

**Key Fields**:
- `id`: String (UUID)
- `importRunId`: String (FK to ImportRun)
- `rowNumber`: Int
- `rowData`: Json (The raw CSV row content)
- `errorMessage`: String (e.g., "Local image matching 'foo.jpg' was not uploaded in the payload.")

### 4. Product / CatalogItem (Existing Prisma Model)

The target product entity.

**Key Fields updated by this feature**:
- `imageUrl`: String. This will be updated to point to the processed local WebP thumbnail (e.g., `/uploads/products/processed-abc.webp`) rather than containing the raw local filename or external URL.

## State Transitions

**Import Job Lifecycle**:
1. `PENDING`: Files are staged in the session directory, and the job is queued.
2. `PROCESSING`: The asynchronous worker is reading the CSV, matching files in the `images/` directory, processing them via Sharp, and saving to `uploads/products/`.
3. `COMPLETED` / `FAILED`: The worker finishes all rows. Finally, the session directory `uploads/imports/session-...` is recursively deleted from disk to reclaim space.
