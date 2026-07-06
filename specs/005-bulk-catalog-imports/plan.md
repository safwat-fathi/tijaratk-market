# Implementation Plan: Bulk Catalog Item Imports with Local Images

**Branch**: `005-bulk-catalog-imports` | **Date**: 2026-07-06 | **Spec**: [spec.md](file:///Users/safwat/Coding/Projects/side-projects/tijaratk-market/specs/005-bulk-catalog-imports/spec.md)
**Input**: Feature specification from `/specs/005-bulk-catalog-imports/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

This plan extends the bulk catalog items import feature to include support for marking items as essential directly via the CSV upload and aligns the downloadable CSV template's columns with the expected upload schema for each catalog type (Grocery vs Pharmacy).

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript / Node.js
**Primary Dependencies**: NestJS, NextJS 14, Prisma
**Storage**: PostgreSQL
**Testing**: Jest
**Target Platform**: Web Admin Dashboard
**Project Type**: web-service (Backend API) / web-app (Frontend NextJS)
**Performance Goals**: N/A
**Constraints**: Align export CSV structure strictly with Zod schemas used for upload.
**Scale/Scope**: Bulk catalog updates affecting up to 500 rows per import.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

No violations. The changes are straightforward extensions of existing domains (Products/Admin/Imports).

## Project Structure

### Documentation (this feature)

```text
specs/005-bulk-catalog-imports/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── imports/
│   │   ├── schemas/catalog-import-row.schema.ts
│   │   └── import-worker.service.ts
│   └── admin/
│       └── admin.service.ts
```

**Structure Decision**: The project uses an existing NestJS backend structure. We are just updating schemas, services, and the import worker.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
