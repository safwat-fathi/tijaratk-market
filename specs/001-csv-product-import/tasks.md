# Tasks: CSV Product Import and Export

**Input**: Design documents from `/specs/001-csv-product-import/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/api.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Install `csv-parser` in backend package.json (`backend/package.json`)
- [ ] T002 Install `@types/csv-parser` and `@types/multer` in backend as dev dependencies

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

*(No major foundational tasks required, Prisma schema already contains `Product` and `Store`)*

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Download Empty CSV Template (Priority: P1) 🎯 MVP

**Goal**: Merchants and admins need to download a pre-formatted empty CSV file so they know the exact columns and data format required.

**Independent Test**: Can be fully tested by clicking the download template button and verifying the downloaded CSV contains the correct headers and no data rows.

### Implementation for User Story 1

- [ ] T003 [P] [US1] Create API endpoint `GET /import-template` in `backend/src/admin/admin.controller.ts` (and corresponding merchant controller if separate)
- [ ] T004 [US1] Implement template generation logic returning CSV string in `backend/src/admin/admin.service.ts`
- [ ] T005 [P] [US1] Implement frontend route handler to fetch template in `frontend/app/api/admin/products/import-template/route.ts`
- [ ] T006 [P] [US1] Create "Download CSV Template" button UI component in `frontend/app/(dashboard)/admin/products/page.tsx`
- [ ] T007 [P] [US1] Create "Download CSV Template" button UI component in `frontend/app/(dashboard)/merchant/products/page.tsx`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Import Populated CSV File (Priority: P1)

**Goal**: Merchants and admins need to upload a populated CSV file so they can bulk create products in a specific store.

**Independent Test**: Can be fully tested by uploading a valid CSV file and verifying the products appear in the store's catalog.

### Implementation for User Story 2

- [ ] T008 [P] [US2] Create API endpoint `POST /import` with `FileInterceptor` in `backend/src/admin/admin.controller.ts` (and merchant controller)
- [ ] T009 [US2] Implement streaming CSV parsing logic using `csv-parser` in `backend/src/admin/admin.service.ts`
- [ ] T009.5 [US2] Implement validation and Arabic/English numeral normalization for parsed rows, and resolve `category` name to a valid database ID (finding existing or creating a new category if it doesn't exist).
- [ ] T010 [US2] Implement database upsert logic (Update/Insert matching by `name` and `storeId`) and create price history on price change in `backend/src/admin/admin.service.ts`
- [ ] T011 [P] [US2] Implement frontend route handler to forward CSV upload in `frontend/app/api/admin/products/import/route.ts`
- [ ] T012 [P] [US2] Create CSV Upload UI component (file input + submit button) in `frontend/app/(dashboard)/admin/products/page.tsx`
- [ ] T013 [P] [US2] Create CSV Upload UI component in `frontend/app/(dashboard)/merchant/products/page.tsx`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Error Handling During Import (Priority: P2)

**Goal**: Users need clear feedback when their uploaded CSV contains errors so they can correct the data and try again.

**Independent Test**: Can be fully tested by uploading a CSV with known errors and verifying the error report clearly identifies the issues.

### Implementation for User Story 3

- [ ] T014 [US3] Enhance backend validation to accumulate row-specific errors and return a report detailing updated, added, and failed rows.
- [ ] T015 [P] [US3] Enhance frontend UI in `frontend/app/(dashboard)/admin/products/page.tsx` to display validation errors clearly to the user
- [ ] T016 [P] [US3] Enhance frontend UI in `frontend/app/(dashboard)/merchant/products/page.tsx` to display validation errors clearly to the user

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T017 Ensure file size limit (5MB) and type validation is enforced by Multer in `backend/src/admin/admin.controller.ts`
- [ ] T018 Run quickstart.md validation scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed sequentially in priority order (US1 → US2 → US3) or in parallel if developers are available.
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2)
- **User Story 2 (P1)**: Can start after Foundational (Phase 2). Independent from US1.
- **User Story 3 (P2)**: Depends on User Story 2 being complete (enhances its functionality).

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- Frontend UI components (`[P]`) can be implemented in parallel with the backend endpoints and services
- Download (US1) and Upload (US2) can be worked on in parallel by different team members

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: Setup
2. Complete Phase 3: User Story 1
3. **STOP and VALIDATE**: Test User Story 1 independently

### Incremental Delivery

1. Complete Setup
2. Add User Story 1 (Download Template) → Test independently
3. Add User Story 2 (Upload CSV) → Test independently
4. Add User Story 3 (Error Handling) → Test independently
