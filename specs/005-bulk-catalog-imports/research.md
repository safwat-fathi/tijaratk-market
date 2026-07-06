# Phase 0: Research & Technical Decisions

**Branch**: `005-bulk-catalog-imports`

## 1. File Upload Handling

- **Decision**: Use NestJS `@UseInterceptors(FileFieldsInterceptor(...))` to handle multipart/form-data containing both the CSV file and the array of images.
- **Rationale**: `FileInterceptor` only supports a single file. `FilesInterceptor` supports multiple files but all under the same field name. `FileFieldsInterceptor` allows distinct schema validation: exactly 1 `file` (the CSV) and up to 1000 `images`.
- **Alternatives considered**: 
  - Submitting images and CSV in separate endpoints (requires complex session management and tracking upload completion).
  - Base64 encoding images inside the CSV (drastically inflates payload size and breaks CSV structure).

## 2. Temporary Staging Strategy

- **Decision**: Stage all incoming files for a specific import task in a dedicated session directory (e.g., `uploads/imports/session-{timestamp}-{randomId}/`).
- **Rationale**: Bulk uploads are asynchronous. Saving directly to the final `uploads/products/` folder before verifying the catalog format could leave orphaned files. A session directory makes cleanup trivial—if the import fails or succeeds, the worker just recursively deletes the session folder.
- **Alternatives considered**: 
  - Staging in OS temporary directory (`/tmp`). Rejected because if the worker restarts, OS-level cleanup could interfere, and it's cleaner to keep application state inside its own work directory.

## 3. Catalog Type Inference

- **Decision**: The frontend passes the `catalogType` (`grocery` or `pharmacy`) instead of specific sources. The backend uses existing logic (from `catalog-source-policy.ts`) to map this to `talabat`, `carrefour`, or `chefaa`.
- **Rationale**: Decouples the admin UI from internal source details. Reduces cognitive load on administrators and prevents mapping errors.
- **Alternatives considered**: 
  - Making admins select `talabat` or `carrefour` manually. Rejected because it violates domain isolation rules and user experience guidelines.

## 4. Payload Size Limits

- **Decision**: Next.js Server Actions limit is configured to 15MB, and NestJS is configured to 25MB. We will enforce these limits and recommend users batch large catalogs.
- **Rationale**: High payload limits can cause Node.js event loop starvation. 500 WebP/JPEG thumbnails should comfortably fit within 15-25MB.
- **Alternatives considered**: 
  - Streaming uploads directly to S3. Rejected because the system architecture currently relies on local disk storage (`uploads/`).
