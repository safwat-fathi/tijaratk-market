# Research: CSV Product Import and Export

## Decision 1: CSV Parsing Library
- **Decision**: Use `csv-parser` on the backend for streaming.
- **Rationale**: `csv-parser` is designed specifically for Node.js streams and can process up to 90,000 rows/second without memory exhaustion, making it ideal for large files.
- **Alternatives considered**: `papaparse` (excellent for browsers/frontend parsing but we require backend-enforced streaming).

## Decision 2: Duplicate Handling Mechanism
- **Decision**: Upsert products based on `sku` and `storeId`.
- **Rationale**: Products may evolve; updating existing products is necessary to support price updates and other changes. If the price changes, a price history record must be created.
- **Alternatives considered**: Skipping duplicates (rejected as it prevents users from doing bulk updates).

## Decision 3: File Upload Handling
- **Decision**: Use NestJS built-in `FileInterceptor` (based on `multer`) for memory storage.
- **Rationale**: Since the file size is limited (e.g., 5MB), processing the CSV from a memory buffer is fast and doesn't require complex temporary file management.
- **Alternatives considered**: Disk storage (slower, requires cleanup).

## Decision 4: Template Generation
- **Decision**: Generate the CSV template dynamically on the backend.
- **Rationale**: The backend holds the source of truth for required fields. Returning a simple CSV string response is trivial.
- **Alternatives considered**: Static CSV file on the frontend (harder to maintain if fields change).
