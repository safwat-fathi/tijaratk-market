# Feature Specification: CSV Product Import and Export

**Feature Branch**: `001-csv-product-import`  
**Created**: 2026-07-04  
**Status**: Draft  
**Input**: User description: "implement a new feature where admin and merchant are able to download an empty product items CSV file where user will be able to fill it with his products then we can import it in his store directly whether by admin or merchant himself."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Download Empty CSV Template (Priority: P1)

Merchants and admins need to download a pre-formatted empty CSV file so they know the exact columns and data format required to successfully import products into a specific store.

**Why this priority**: Without the correct template, users cannot format their data correctly for the import process, making this the foundational step.

**Independent Test**: Can be fully tested by clicking the download template button and verifying the downloaded CSV contains the correct headers and no data rows.

**Acceptance Scenarios**:

1. **Given** a merchant is on their store's product management page, **When** they select "Download CSV Template", **Then** a CSV file with the correct product headers is downloaded to their device.
2. **Given** an admin is on a specific merchant's store management page, **When** they select "Download CSV Template", **Then** a CSV file with the correct product headers is downloaded to their device.

---

### User Story 2 - Import Populated CSV File (Priority: P1)

Merchants and admins need to upload a populated CSV file so they can bulk create products in a specific store, saving time compared to manual entry.

**Why this priority**: Bulk importing products is the core value proposition of this feature.

**Independent Test**: Can be fully tested by uploading a valid CSV file and verifying the products appear in the store's catalog.

**Acceptance Scenarios**:

1. **Given** a merchant has a populated CSV file, **When** they upload it via the product management page, **Then** the system parses the file, creates the products in their store, and displays a success summary.
2. **Given** an admin has a populated CSV file for a specific store, **When** they upload it via the store management page, **Then** the system parses the file, creates the products in that store, and displays a success summary.

---

### User Story 3 - Error Handling During Import (Priority: P2)

Users need clear feedback when their uploaded CSV contains errors (e.g., missing required fields, invalid formats) so they can correct the data and try again.

**Why this priority**: Real-world CSV uploads often contain errors; without clear feedback, users will be blocked and frustrated.

**Independent Test**: Can be fully tested by uploading a CSV with known errors and verifying the error report clearly identifies the issues.

**Acceptance Scenarios**:

1. **Given** a user uploads a CSV with missing required fields, **When** the system processes the file, **Then** the import stops (or skips the invalid rows) and presents an error report detailing which rows and columns failed validation.
2. **Given** a user uploads a file that is not a CSV, **When** they attempt the upload, **Then** the system immediately rejects the file with an "Invalid file type" error message.

### Edge Cases

- What happens if the CSV file exceeds the maximum allowed file size?
- How does the system handle importing products with identical names that already exist in the store?
- What happens if a merchant tries to upload a CSV file with tens of thousands of rows (timeout considerations)?
- How does the system handle special characters or different text encodings (e.g., UTF-8 vs ISO-8859-1) in the CSV?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authenticated Merchants to download an empty CSV template containing all required and optional product fields as headers.
- **FR-002**: System MUST allow authenticated Admins to download the same empty CSV template.
- **FR-003**: System MUST allow authenticated Merchants to upload a CSV file to bulk import products into their own store.
- **FR-004**: System MUST allow authenticated Admins to upload a CSV file to bulk import products into any specific store they manage.
- **FR-005**: System MUST validate the uploaded CSV file format and content before processing.
- **FR-006**: System MUST provide clear error feedback if validation fails, indicating specific rows and reasons for failure.
- **FR-007**: System MUST handle duplicate products by updating them (upsert), inserting new ones, and creating a price history record if the price has changed.
- **FR-008**: System MUST support a maximum file size limit for CSV uploads to prevent abuse.
- **FR-009**: System MUST normalize Arabic and English numerals during the validation step to ensure consistent data processing.
- **FR-010**: System MUST automatically create a new category if the category name provided in the CSV does not exist in the database.

### Key Entities

- **Product**: The main entity being imported, containing attributes like name, price, description, category, etc.
- **ProductPriceHistory**: A record of price changes over time.
- **Store**: The destination where the imported products will be associated.
- **Import Job/Log**: A record of the import process, capturing success, failure, and error details for auditing and user feedback.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Merchants and Admins can successfully download the CSV template in under 2 seconds.
- **SC-002**: System can process a valid CSV file of 1,000 products in under 30 seconds.
- **SC-003**: Users receive clear error validation for invalid files, reducing support tickets related to "failed imports" by at least 50% compared to a generic error message.
- **SC-004**: 90% of valid CSV uploads result in successful product creation on the first attempt.

## Assumptions

- The existing product schema and required fields are already defined and will be used as the basis for the CSV headers.
- Users have basic spreadsheet software (like Excel or Google Sheets) to open and edit the CSV files.
- The import process will happen synchronously for smaller files, but we may need to assume a maximum file size limit (e.g., 5MB or 5000 rows) to prevent timeouts.
- Authentication and authorization rules already exist for Merchants and Admins, and this feature will simply reuse those checks.
