# Feature Specification: Bulk Catalog Item Imports with Local Images

**Feature Branch**: `005-bulk-catalog-imports`  
**Created**: 2026-07-06  
**Status**: Draft  
**Input**: User description: "@[bulk-catalog-items.md]"

## Clarifications
### Session 2026-07-06
- Q: How should the catalog format/source be selected? → A: It should be identified by the current opened tab (Grocery, Pharmacy). The backend will align it with the handled catalog items without the admin selecting specific sources like talabat or carrefour.
- Q: How should we determine if a catalog item is essential? → A: The CSV file should include a column indicating whether the item is essential, and this should be processed and saved accordingly during import.
- Q: How should the downloadable CSV template be structured? → A: The downloadable CSV template for catalog items must strictly align with the expected columns for the upload format (e.g., matching the required columns for Grocery or Pharmacy).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bulk Image Upload with CSV Import (Priority: P1)

Administrators need the ability to upload a catalog CSV and multiple product images simultaneously, so that product records are created with proper thumbnails without relying on external image URLs.

**Why this priority**: It is the core requirement. Without it, administrators cannot upload local product images during catalog import.

**Independent Test**: Can be fully tested by submitting a valid catalog CSV referencing local filenames alongside the matching image files, and verifying that the images are processed and associated correctly in the catalog.

**Acceptance Scenarios**:

1. **Given** an admin on the imports page, **When** they upload a CSV with filenames in the `image_url` column along with matching image files and submit, **Then** the system creates the products, generates WebP thumbnails, maps them correctly, and displays a success summary.
2. **Given** an admin uploading a CSV with a filename in `image_url`, **When** the corresponding image file is omitted from the upload, **Then** the system logs a validation error for that row and continues processing others.
3. **Given** a CSV containing external URLs in `image_url`, **When** no local files match the URL, **Then** the system falls back to downloading the image from the external URL and processes it successfully.

---

### Edge Cases

- What happens when an uploaded image exceeds size limits or is an unsupported format?
  - System logs an error for the specific row, skips updating the image, but continues processing the catalog data (or fails the row depending on the mode).
- How does system handle filenames with special characters?
  - Special characters should be sanitized when staging the files, ensuring they match safely with the CSV entries.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow administrators to select and upload multiple image files simultaneously with the catalog CSV file.
- **FR-002**: System MUST stage the CSV file and the uploaded images in an isolated session-based directory during processing.
- **FR-003**: System MUST match filenames defined in the CSV's `image_url` column against the uploaded local images.
- **FR-004**: System MUST process matched local images into optimized WebP thumbnails and store them permanently, discarding the temporary ones.
- **FR-005**: System MUST fall back to downloading from external URLs if the `image_url` is a valid external URL and no local file matches.
- **FR-006**: System MUST record row-level errors for entries where a local filename is specified but the corresponding file was not uploaded.
- **FR-007**: System MUST completely clean up and remove the temporary session directory upon completion, cancellation, or failure of the import.
- **FR-008**: System MUST infer the specific catalog source (e.g., talabat, carrefour) automatically based on the selected catalog type (Grocery, Pharmacy) and enforce existing isolation rules, rather than requiring the admin to explicitly select the source.
- **FR-009**: System MUST read an "is_essential" (or similar) column from the CSV to set whether the imported catalog item is part of the essential assortment.
- **FR-010**: System MUST provide a downloadable CSV template on the catalog items page that exactly matches the expected column format for uploads (aligned by catalog type).

### Key Entities

- **ImportRun**: Tracks the overarching import task, mode, format, and overall success metrics.
- **ImportRowError**: Records validation or processing errors for specific rows, including missing images.
- **CatalogItem**: The target product record updated or created with the resolved `image_url` and essential flag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Administrators can upload a CSV with up to 500 images in a single submission without application timeouts.
- **SC-002**: 100% of temporary session files are deleted from the disk upon import task completion.
- **SC-003**: Row errors related to missing image uploads are accurately reported on the import details dashboard.

## Assumptions

- Administrators have a stable internet connection capable of uploading payloads up to 15MB.
- Uploaded images are in standard formats (JPG, PNG, WEBP, HEIC) compatible with the existing image processor.
- Catalog items with local images adhere to the same validation and categorizations as those with external images.
