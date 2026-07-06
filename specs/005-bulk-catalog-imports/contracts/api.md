# API Contracts: Bulk Catalog Imports

## 1. Import Endpoint (NestJS)

**Endpoint**: `POST /imports`

**Content-Type**: `multipart/form-data`

### Request Payload (Form Data)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | The single CSV file containing the catalog items to import. |
| `images` | File[] | No | An array of image files (up to 1000) that match the filenames specified in the `image_url` column of the CSV. |
| `mode` | String | Yes | The import strategy: `upsert`, `replace_source`, `create_only`, `update_only`. |
| `catalogType` | String | Yes | The type of catalog: `grocery` or `pharmacy`. Used by the backend to automatically infer the target catalog format/source. |

### Response

**Status Code**: `201 Created`

**Content-Type**: `application/json`

**Body**:
```json
{
  "message": "Import process started",
  "importId": "uuid-string-here"
}
```

### Constraints & Validations
- **File Size**: Subject to NestJS maximum request body size (configured to 25MB).
- **File Limits**: Maximum 1 `file` and maximum 1000 `images`.
- **Image Formats**: Accepted formats based on Multer configuration (typically JPEG, PNG, WEBP, HEIC).
