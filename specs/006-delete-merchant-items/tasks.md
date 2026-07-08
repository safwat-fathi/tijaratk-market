# Tasks: Delete Merchant Items From Admin

**Input**: Design documents from `/specs/006-delete-merchant-items/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Verify backend and frontend development environments are running

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Add `deleted_by_id` (Int?) to `Product` model in `backend/prisma/schema.prisma`
- [ ] T003 Generate and apply database migration using `pnpm run prisma:migrate:dev` in backend
- [ ] T004 [P] Update Prisma Client by running `pnpm run prisma:generate` if not automatically done

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Admin Deletes A Merchant Item (Priority: P1) 🎯 MVP

**Goal**: Admins can safely remove a merchant-owned item so it no longer appears in active views.

**Independent Test**: Sign in as admin, navigate to product list, delete a product, verify it disappears from the list and database shows `deleted_at` and `deleted_by_id`.

### Implementation for User Story 1

- [x] T005 [P] [US1] Create soft-delete logic in `backend/src/products/products.service.ts` (update `deleted_at` and `deleted_by_id`)
- [x] T006 [P] [US1] Create `DELETE /admin/products/:id` endpoint in `backend/src/products/products.controller.ts`
- [x] T007 [P] [US1] Add frontend API call `deleteProduct` in `frontend/services/api/products.service.ts`
- [x] T008 [US1] Add Delete button to admin product list UI in `frontend/app/(dashboard)/admin/products/page.tsx`
- [x] T009 [US1] Ensure deleted products are excluded from frontend admin list queries (handled automatically if backend filters them, verify backend filters `deleted_at: null`)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Admin Understands Deletion Impact Before Confirming (Priority: P1)

**Goal**: Admins receive clear confirmation details (product name, merchant identity) before deletion.

**Independent Test**: Initiate deletion, verify modal shows correct item details, verify canceling does not delete the item, verify confirming deletes it.

### Implementation for User Story 2

- [x] T010 [P] [US2] Create or update a confirmation modal component for product deletion in frontend
- [x] T011 [US2] Integrate the confirmation modal into the Delete action flow in `frontend/app/(dashboard)/admin/products/page.tsx` showing the item's name and tenant info

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Admin Is Prevented From Invalid Deletions (Priority: P2)

**Goal**: Admin cannot delete items tied to active operational records or shared catalog items.

**Independent Test**: Attempt to delete an item in an active order (e.g. status PENDING), verify it is blocked with a 400 error. Attempt to delete a catalog source item, verify it is blocked.

### Implementation for User Story 3

- [x] T012 [P] [US3] Add validation to block deletion if product is tied to active orders (PENDING, PREPARING, ON_THE_WAY) in `backend/src/products/products.service.ts`
- [x] T013 [P] [US3] Add validation to block deletion if product is not merchant-owned (e.g. shared catalog item) in `backend/src/products/products.service.ts`
- [x] T014 [US3] Handle 400/404 error responses and show toast notifications in `frontend/app/(dashboard)/admin/products/page.tsx`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T015 Verify error message clarity for all edge cases
- [ ] T016 Code cleanup and refactoring in backend service
- [ ] T017 Run quickstart.md validation to ensure end-to-end functionality

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1**: Depends on Foundational Phase.
- **User Story 2**: Enhances User Story 1 (adds confirmation).
- **User Story 3**: Enhances backend validation for User Story 1.

### Parallel Opportunities

- T005, T006, and T007 can be executed in parallel.
- T010 can be built in parallel with backend tasks.
- T012 and T013 backend validations can be built in parallel.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and 2.
2. Complete Phase 3 (US1) - allows basic deletion.
3. Test MVP.

### Incremental Delivery

1. Deliver MVP (US1).
2. Add Confirmation (US2) to prevent accidental deletions.
3. Add Backend Validations (US3) to prevent invalid deletions.
