# API Contracts: CSV Product Import and Export

## 1. Download Template
**Endpoint**: `GET /admin/products/import-template` (and `/merchant/products/import-template`)
**Description**: Returns an empty CSV file with the required headers.
**Response**: 
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="product-import-template.csv"`

## 2. Upload CSV for Import
**Endpoint**: `POST /admin/products/import` (and `/merchant/products/import`)
**Description**: Accepts a CSV file upload and processes it. Admins might need to provide a `storeId` in the body/query, while merchants import to their own store.
**Content-Type**: `multipart/form-data`
**Body**:
- `file`: (File) The CSV file.
- `storeId`: (String) [Admin only] The target store ID.

**Response (Success/Partial Success)**:
```json
{
  "success": true,
  "importedCount": 45,
  "skippedCount": 5,
  "errors": [
    { "row": 12, "message": "Invalid price format" }
  ]
}
```

**Response (Failure - e.g., bad format)**:
```json
{
  "statusCode": 400,
  "message": "Invalid file format. Please upload a CSV file.",
  "error": "Bad Request"
}
```
