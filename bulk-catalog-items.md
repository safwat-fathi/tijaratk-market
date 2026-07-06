# Plan: Bulk Catalog Item Imports with Local Images

This document outlines the plan to enhance the catalog import feature in the Admin Dashboard, enabling administrators to upload a catalog CSV file alongside multiple product images in a single request. 

Images in the CSV will be referenced by their filenames (e.g., `tomato.jpg`) rather than external URLs. The system will match, process, and store them locally.

---

## 1. Flow Overview

1. **Preparation**: The administrator prepares a CSV file where the `image_url` column contains local filenames (e.g., `tomato.jpg` or `shampoo.png`).
2. **Dashboard Selection**: In the Admin Dashboard (`/admin/imports`), the administrator selects:
   - The catalog CSV file.
   - Multiple image files via a file picker or dropzone.
   - Import mode (`upsert`, `replace_source`, `create_only`, `update_only`).
   - Catalog type (`grocery` / `pharmacy`) instead of specific sources like talabat. The backend will automatically infer the exact source based on this type.
3. **Submission**: The frontend submits the CSV and the images together in a single `multipart/form-data` request via Next.js Server Actions to the NestJS backend.
4. **Backend Staging**: The NestJS backend intercepts the files, stages them in an isolated session folder, and starts the asynchronous import process in the background.
5. **Matching & Processing**: The import worker processes the CSV row-by-row. When it encounters a filename in `image_url`, it matches it against the uploaded files, processes the image into a 256x256 WebP thumbnail using the existing `ImageProcessorService`, and saves it.
6. **Report & Details**: Row-level errors and final import statistics are saved in the database, allowing admins to track progress on the import details page (`/admin/imports/[id]`).

---

## 2. Backend Implementation (NestJS)

### A. Controller File Interception
Modify [imports.controller.ts](file:///Users/safwat/Coding/Projects/side-projects/tijaratk-market/backend/src/imports/imports.controller.ts) to accept both the CSV file and the array of product images.

- **Current**: Uses `FileInterceptor('file', ...)` to intercept a single file.
- **Proposed**: Use `FileFieldsInterceptor` to parse the `file` field (limit 1) and the `images` field (limit 1000).
- **Session-based Staging**:
  To avoid conflict and make cleanup trivial, stage all files in a session directory:
  `uploads/imports/session-{timestamp}-{randomId}/`
  - CSV file is saved directly to the session folder.
  - Image files are saved into an `images/` sub-directory within the session folder using their original names (available via Multer's `file.originalname`).

```typescript
@UseInterceptors(
  FileFieldsInterceptor(
    [
      { name: 'file', maxCount: 1 },
      { name: 'images', maxCount: 1000 },
    ],
    {
      storage: diskStorage({
        destination: (req, file, callback) => {
          // Generate a session ID if not already attached to the request object
          const sessionId = req['importSessionId'] || `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          req['importSessionId'] = sessionId;

          const sessionDir = file.fieldname === 'file'
            ? join(process.cwd(), 'uploads', 'imports', sessionId)
            : join(process.cwd(), 'uploads', 'imports', sessionId, 'images');

          mkdirSync(sessionDir, { recursive: true });
          callback(null, sessionDir);
        },
        filename: (_req, file, callback) => {
          // Keep the original filename for images to allow matching
          // Sanitize special characters except alphanumeric, dots, and hyphens
          const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
          callback(null, safeName);
        },
      }),
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max size per file
    }
  )
)
```

### B. Service Upload Indexing & Matching
Update [imports.service.ts](file:///Users/safwat/Coding/Projects/side-projects/tijaratk-market/backend/src/imports/imports.service.ts) to index the staged images and match them.

- **Retrieve Staged Images**: 
  When starting `processCatalogImport(importRunId)`, read the contents of the `images` folder located in the parent directory of `importRun.file_path` (e.g., `uploads/imports/{sessionId}/images`).
  Create an in-memory dictionary of original filenames mapping to their temporary absolute paths.
- **Update Image Resolution**:
  Refactor `processCatalogItemImage(incomingImageUrl, existingItem)`:
  - Check if `incomingImageUrl` matches an uploaded filename in the indexed dictionary.
  - If matched:
    1. Call the existing `ImageProcessorService.processProductThumbnail(tempFilePath)` to generate the 256x256 WebP image.
    2. Store the returned public URL (e.g., `/uploads/products/product-xxx.webp`) in the database.
  - If it does not match but starts with `http://` or `https://`:
    - Fall back to downloading via `ImageDownloaderService.downloadImage(incomingImageUrl)`.
  - If no match and not an external URL, flag it as a validation error in `ImportRowError`.

### C. Resource Cleanup
Upon finishing, canceling, or failing the import, recursively delete the temporary session directory (`uploads/imports/{sessionId}`) to release server disk space.

---

## 3. Frontend Implementation (Next.js)

### A. Admin Upload Form
Modify the upload form in [page.tsx](file:///Users/safwat/Coding/Projects/side-projects/tijaratk-market/frontend/app/%28dashboard%29/admin/imports/page.tsx) to support multiple image selection:

- Add an `<input type="file" name="images" multiple accept="image/*" />` input field (styled as a drag-and-drop zone or a file picker).
- Add a client-side validation hint showing the maximum body size constraints (Next.js server action limit is `15MB` as defined in `next.config.ts`).

### B. Server Actions & API Integration
Update the server action [admin-server.ts](file:///Users/safwat/Coding/Projects/side-projects/tijaratk-market/frontend/actions/admin-server.ts):

- Extract the CSV file and the array of image files:
  ```typescript
  const file = formData.get("file");
  const images = formData.getAll("images");
  ```
- Append both to the outgoing multipart `cleanFormData` payload sent to the backend.
- In `frontend/services/api/admin.service.ts`, adjust the `createImport` request timeout `timeoutMs` (increase from `30000` to `180000` or higher) to accommodate the upload time of larger payloads.

---

## 4. Codebase Policies & Constraints

1. **Centralized Category Policy**:
   All catalog source policies must strictly adhere to the centralized rules in [catalog-source-policy.ts](file:///Users/safwat/Coding/Projects/side-projects/tijaratk-market/backend/src/products/catalog-source-policy.ts).
   - Grocery categories (from `talabat_csv`) are restricted to grocery tenants.
   - Pharmacy categories (from `chefaa_csv`) are restricted to pharmacy tenants.
   - Invalid categories or sources mapped during row validation must result in a stored row error in `ImportRowError`.
2. **Deterministic Output Filenames**:
   The existing `ImageProcessorService` handles deterministic unique name generation:
   `product-${Date.now()}-${randomBytes}.webp`
   We should continue utilizing this helper to prevent file name collisions in `uploads/products/`.
3. **Execution Restrictions**:
   Do not run prisma migrations or dependency installs during implementation. The developer must run verification steps manually.
