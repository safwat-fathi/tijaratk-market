---
description: "Task list template for feature implementation"
---

# Tasks: Bulk Catalog Item Imports with Local Images

**Input**: Design documents from `/specs/005-bulk-catalog-imports/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

*(Project is already initialized. No setup tasks required.)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

*(Existing infrastructure handles basic imports. No foundational blocking tasks needed.)*

---

## Phase 3: User Story 1 - Bulk Image Upload with CSV Import (Priority: P1) 🎯 MVP

**Goal**: Administrators need the ability to upload a catalog CSV and multiple product images simultaneously, so that product records are created with proper thumbnails without relying on external image URLs.

**Independent Test**: Can be fully tested by submitting a valid catalog CSV referencing local filenames alongside the matching image files, and verifying that the images are processed and associated correctly in the catalog.

### Implementation for User Story 1

- [ ] T001 [P] [US1] Update ImportsController to use FileFieldsInterceptor for `file` and `images` arrays in `backend/src/imports/imports.controller.ts`
- [ ] T002 [US1] Update ImportsService to manage session-based staging directories and infer the catalog format from the provided type in `backend/src/imports/imports.service.ts`
- [ ] T003 [US1] Update ImportWorker to map local image files, process thumbnails via ImageProcessorService, and assign WebP paths to products in `backend/src/imports/import-worker.service.ts`
- [ ] T004 [P] [US1] Update Next.js Server Action to proxy the multipart payload with images in `frontend/actions/admin-server.ts`
- [ ] T005 [P] [US1] Update frontend UI form to allow multiple image selection for the import in `frontend/app/(dashboard)/admin/imports/page.tsx`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T006 [P] Code cleanup and verify strict typing
- [ ] T007 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **User Stories (Phase 3+)**: Can start immediately.
- **Polish (Final Phase)**: Depends on US1 completion.

### User Story Dependencies

- **User Story 1 (P1)**: Independent.

### Parallel Opportunities

- T001, T004, and T005 can all be implemented in parallel as they touch decoupled frontend, controller, and server-action layers.
