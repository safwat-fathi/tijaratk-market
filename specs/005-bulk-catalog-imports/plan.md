# Implementation Plan: Bulk Catalog Item Imports with Local Images

**Branch**: `005-bulk-catalog-imports` | **Date**: 2026-07-06 | **Spec**: [spec.md](file:///Users/safwat/Coding/Projects/side-projects/tijaratk-market/specs/005-bulk-catalog-imports/spec.md)
**Input**: Feature specification from `specs/005-bulk-catalog-imports/spec.md`

## Summary

This feature allows administrators to upload a catalog CSV alongside multiple local product images in a single form submission. The backend will stage these files in a session directory, asynchronously process the CSV, map the images, generate WebP thumbnails, infer the target catalog source automatically based on the selected catalog type (Grocery/Pharmacy), and finally clean up the session directory.

## Technical Context

**Language/Version**: TypeScript / Node.js
**Primary Dependencies**: NestJS, Next.js, Prisma, Multer, Sharp
**Storage**: PostgreSQL (via Prisma), Local Filesystem (`uploads/`)
**Testing**: Jest
**Target Platform**: Web (Admin Dashboard)
**Project Type**: Web Application
**Performance Goals**: Process up to 500 images per CSV upload without hanging the server.
**Constraints**: 15MB request limit in Next.js Server Actions; 25MB limit in NestJS controller.
**Scale/Scope**: Moderate usage by administrators.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

No violations detected.

## Project Structure

### Documentation (this feature)

```text
specs/005-bulk-catalog-imports/
├── plan.md              # This file
├── research.md          # Technical decisions and rationale
├── data-model.md        # DB and disk state model
├── quickstart.md        # End-to-end validation guide
├── contracts/           # API contracts
│   └── api.md           # NestJS multipart endpoint contract
└── tasks.md             # Implementation tasks (next step)
```

### Source Code (repository root)

```text
# Web application
backend/
├── src/
│   ├── imports/
│   │   ├── imports.controller.ts     # Update to use FileFieldsInterceptor
│   │   ├── imports.service.ts        # Update signature and session staging logic
│   │   └── import-worker.service.ts  # Image matching, Sharp processing, cleanup
│   └── common/
│       └── services/
│           └── image-processor.service.ts

frontend/
├── app/
│   └── (dashboard)/
│       └── admin/
│           └── imports/
│               └── page.tsx          # Form modifications for array of files
└── actions/
    └── admin-server.ts               # Next.js Server Action to proxy multipart data
```

**Structure Decision**: Standard Next.js/NestJS fullstack layout. We modify the imports module to handle staging and proxying the files.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

N/A
