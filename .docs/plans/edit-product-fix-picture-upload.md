# Edit Product Picture Upload Fix

## Summary

Make the edit product image upload control explicit and discoverable so merchants can add a missing product picture or change an existing one from the edit product sheet.

## Scope

- Update the edit product sheet UI only.
- Keep existing validation, preview, and `file` form submission behavior.
- No backend changes are needed because the update endpoint already accepts multipart image uploads.

## Verification

- Run frontend lint/type-check after the UI change.
