# Phase 0: Research & Findings

## 1. CSV Template Alignment
- **Decision**: Redefine `CATALOG_EXPORT_COLUMNS` in `admin.service.ts` into format-specific arrays (`TALABAT_EXPORT_COLUMNS`, `CHEFAA_EXPORT_COLUMNS`) matching exactly the Zod schema keys used in `catalog-import-row.schema.ts`.
- **Rationale**: The downloadable CSV template for catalog items must strictly align with the expected columns for the upload format to prevent admin confusion and friction during updates.
- **Alternatives considered**: Keeping a generic export list and dynamically rewriting headers in the frontend (rejected because it adds unnecessary complexity and divergence from the backend schema).

## 2. Essential Item Processing
- **Decision**: Add `is_essential` as an optional boolean-parsable field (`optionalText`) to `TalabatCatalogImportRowSchema` and `ChefaaCatalogImportRowSchema`. During import processing (`import-worker.service.ts`), parse this string value ("true", "1", "yes") into the `CatalogItem.is_essential` Boolean field in Prisma.
- **Rationale**: Meets the new FR-009 requirement directly from the CSV input, enabling bulk tagging of essential products alongside standard catalog details.
- **Alternatives considered**: Adding a separate bulk-essential endpoint (rejected because the user explicitly requested handling this from the CSV file).
