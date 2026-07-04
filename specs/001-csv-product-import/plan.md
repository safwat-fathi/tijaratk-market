# Implementation Plan: CSV Product Import and Export

**Branch**: `001-csv-product-import` | **Date**: 2026-07-04 | **Spec**: [spec.md](file:///Users/safwat/Coding/Projects/side-projects/tijaratk-market/specs/001-csv-product-import/spec.md)
**Input**: Feature specification from `/specs/001-csv-product-import/spec.md`

## Summary

This feature allows admins and merchants to download an empty CSV template, fill it with product data, and upload it to bulk import products into a store. The backend will parse the file using stream processing via `csv-parser`, validate rows, normalize Arabic/English numbers, and upsert products while recording price history if prices change.

## Technical Context

**Language/Version**: TypeScript  
**Primary Dependencies**: Next.js (frontend), NestJS (backend), Prisma (database), `csv-parser` (for backend streaming), `multer` (for file upload)  
**Storage**: PostgreSQL (via Prisma)  
**Testing**: Jest (backend unit tests)  
**Target Platform**: Web  
**Project Type**: web-application (Next.js + NestJS monorepo)  
**Performance Goals**: Parse and insert 1000 items in <30s  
**Constraints**: File size limit (e.g., 5MB), synchronous processing  
**Scale/Scope**: Bulk upload per store  

## Constitution Check

*GATE: Passed*

No constitution violations. Will follow existing project structure.

## Project Structure

### Documentation (this feature)

```text
specs/001-csv-product-import/
├── plan.md              
├── research.md          
├── data-model.md        
├── quickstart.md        
└── contracts/api.md           
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── admin/      (Admin-specific import logic)
│   ├── products/   (Shared product logic)
│   └── stores/     (Store-specific logic)
└── tests/

frontend/
├── app/
│   ├── (dashboard)/admin/products/
│   └── (dashboard)/merchant/products/
```

**Structure Decision**: Option 2 (Web application). We will add the import/export endpoints to the existing backend controllers and add the UI components to the frontend dashboard.
