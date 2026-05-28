# New Product Optional Picture Upload

## Summary

Add optional product picture upload to the quick add product form.

## Scope

- Add optional image picker, validation, preview, and reset behavior to the quick add UI.
- Send new product creates as multipart form data when a picture is selected.
- Extend the backend create endpoint to accept an optional uploaded file and process it through the existing product thumbnail pipeline.
- Keep existing image URL support intact for non-upload creates.

## Verification

- Run targeted frontend lint/type-check.
- Run targeted backend lint/type-check where practical.
