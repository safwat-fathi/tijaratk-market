# Tasks: Bulk Product Actions

**Input**: Design documents from `specs/003-bulk-product-actions/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/product-bulk-actions.md](./contracts/product-bulk-actions.md), [quickstart.md](./quickstart.md)

**Tests**: The feature spec does not request TDD. Verification tasks are included as manual/user-run validation because repository `AGENTS.md` forbids AI agents from running lint, typecheck, test, build, package-manager, or dev-server commands.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Identify existing extension points and establish shared types for bulk product actions.

- [X] T001 Review the current product list selection and bulk action UI in `frontend/app/(dashboard)/merchant/(features)/products/new/_components/MyProductsSection.tsx`
- [X] T002 Review the current shared product orchestration and admin-only bulk action gating in `frontend/app/(dashboard)/merchant/(features)/products/new/_components/ProductOnboardingClient.tsx`
- [X] T003 Review existing product API/service lifecycle behavior in `backend/src/products/products.controller.ts` and `backend/src/products/products.service.ts`
- [X] T004 [P] Add shared frontend bulk product payload/response types in `frontend/types/models/product.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add reusable backend validation/status support and dashboard listing support required by all user stories.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Create `BulkUpdateProductsDto` in `backend/src/products/dto/bulk-update-products.dto.ts` for `ids`, `category`, `is_available`, and `status`
- [X] T006 Update `GetTenantProductsDto` in `backend/src/products/dto/get-tenant-products.dto.ts` to accept optional `status=active|archived` for dashboard management queries
- [X] T007 Add a shared bulk payload normalization helper in `backend/src/products/products.service.ts` to validate unique IDs, at least one action, trimmed category, allowed status, and non-deleted products
- [X] T008 Update tenant product listing/search methods in `backend/src/products/products.service.ts` to respect the requested dashboard product status while defaulting to active products
- [X] T009 Update `frontend/services/api/products.service.ts` to support `status` when fetching/searching merchant dashboard products
- [X] T010 Update product search/list state handling in `frontend/app/(dashboard)/merchant/(features)/products/new/_components/ProductOnboardingClient.tsx` to track active versus archived product status

**Checkpoint**: Backend DTO/status support and frontend status state are ready for story implementation.

---

## Phase 3: User Story 1 - Merchant updates selected products in bulk (Priority: P1) MVP

**Goal**: A merchant can select visible products and bulk update availability or category without affecting unselected or outside-tenant products.

**Independent Test**: Sign in as a merchant, select visible products, bulk mark unavailable/available, bulk change category, and confirm only selected visible products change.

### Implementation for User Story 1

- [X] T011 [US1] Add merchant `PATCH /products/bulk` endpoint in `backend/src/products/products.controller.ts`
- [X] T012 [US1] Implement tenant-scoped `bulkUpdate` behavior in `backend/src/products/products.service.ts`
- [X] T013 [US1] Ensure merchant bulk update rejects missing IDs, no action, invalid category, invalid status, and any product outside the authenticated tenant in `backend/src/products/products.service.ts`
- [X] T014 [US1] Add `bulkUpdateProducts` method to `frontend/services/api/products.service.ts`
- [X] T015 [US1] Add `bulkUpdateProductsAction` server action in `frontend/actions/product-actions.ts`
- [X] T016 [US1] Wire `bulkUpdateProductsAction` into `merchantProductOnboardingActions` in `frontend/app/(dashboard)/merchant/(features)/products/new/_components/ProductOnboardingClient.tsx`
- [X] T017 [US1] Remove the merchant-mode bulk action gate in `frontend/app/(dashboard)/merchant/(features)/products/new/_components/ProductOnboardingClient.tsx` so merchant mode receives `handleBulkUpdateProducts`
- [X] T018 [US1] Limit the merchant bulk action bar to availability and category actions for active products in `frontend/app/(dashboard)/merchant/(features)/products/new/_components/MyProductsSection.tsx`
- [X] T019 [US1] Clear selected products after successful merchant bulk updates and preserve current search/category/availability filters in `frontend/app/(dashboard)/merchant/(features)/products/new/_components/MyProductsSection.tsx`
- [X] T020 [US1] Add merchant-facing success and error copy for bulk availability/category updates in `frontend/app/(dashboard)/merchant/(features)/products/new/_components/MyProductsSection.tsx`

**Checkpoint**: Merchant bulk availability and category updates are functional and independently testable.

---

## Phase 4: User Story 2 - Merchant archives and restores products (Priority: P1)

**Goal**: A merchant can archive selected active products after confirmation, view archived products, and activate selected archived products.

**Independent Test**: Sign in as a merchant, archive selected products after confirmation, switch to archived view, and activate them back into the active view.

### Implementation for User Story 2

- [X] T021 [US2] Add active/archived product status filter controls in `frontend/app/(dashboard)/merchant/(features)/products/new/_components/MyProductsSection.tsx`
- [X] T022 [US2] Load archived merchant products through the existing product list/search flow in `frontend/app/(dashboard)/merchant/(features)/products/new/_components/ProductOnboardingClient.tsx`
- [X] T023 [US2] Add bulk archive confirmation state and cancel/confirm handling in `frontend/app/(dashboard)/merchant/(features)/products/new/_components/MyProductsSection.tsx`
- [X] T024 [US2] Show archive action only for active product view and activate action only for archived product view in `frontend/app/(dashboard)/merchant/(features)/products/new/_components/MyProductsSection.tsx`
- [X] T025 [US2] Update local product and search result state after archive/activate so products move between active and archived views in `frontend/app/(dashboard)/merchant/(features)/products/new/_components/ProductOnboardingClient.tsx`
- [X] T026 [US2] Ensure selection is cleared when switching active/archived views or when selected products are no longer visible in `frontend/app/(dashboard)/merchant/(features)/products/new/_components/MyProductsSection.tsx`
- [X] T027 [US2] Recalculate or refresh product category and availability counts for the active/archived view in `frontend/app/(dashboard)/merchant/(features)/products/new/_components/ProductOnboardingClient.tsx`
- [X] T028 [US2] Add merchant-facing success and error copy for bulk archive and activate actions in `frontend/app/(dashboard)/merchant/(features)/products/new/_components/MyProductsSection.tsx`

**Checkpoint**: Merchant archive and restore workflows are functional and independently testable.

---

## Phase 5: User Story 3 - Admin manages selected products in bulk (Priority: P2)

**Goal**: Admin can perform the same visible-row bulk actions from the admin products dashboard while preserving admin authorization.

**Independent Test**: Sign in as admin, select a merchant in `/admin/products`, apply availability/category/archive/activate actions, and confirm archived products can be reviewed and activated.

### Implementation for User Story 3

- [X] T029 [US3] Align `BulkUpdateAdminProductsDto` in `backend/src/admin/dto/catalog-item.dto.ts` with the shared bulk update validation rules
- [X] T030 [US3] Refactor `bulkUpdateForTenantAsAdmin` in `backend/src/products/products.service.ts` to reuse the shared bulk payload validation from merchant bulk updates
- [X] T031 [US3] Update admin product onboarding loading in `frontend/actions/admin-server.ts` to support active versus archived product status
- [X] T032 [US3] Update `frontend/services/api/admin.service.ts` admin product loading/search methods to pass the requested active or archived status
- [X] T033 [US3] Ensure `frontend/app/(dashboard)/admin/products/_components/AdminProductsOnboardingClient.tsx` passes admin bulk actions and status-aware loading into the shared product UI
- [X] T034 [US3] Verify the shared UI labels and actions remain correct when `ProductOnboardingClient` runs in admin layout mode in `frontend/app/(dashboard)/merchant/(features)/products/new/_components/ProductOnboardingClient.tsx`
- [X] T035 [US3] Ensure admin bulk archive uses the same confirmation behavior as merchant bulk archive in `frontend/app/(dashboard)/merchant/(features)/products/new/_components/MyProductsSection.tsx`

**Checkpoint**: Admin bulk product actions match merchant capabilities and are independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, documentation, and user-run validation.

- [X] T036 [P] Update `specs/003-bulk-product-actions/quickstart.md` if implementation changes validation steps or labels
- [X] T037 Review catalog isolation touchpoints and confirm no changes duplicate source policy outside `backend/src/products/catalog-source-policy.ts`
- [X] T038 Review Arabic UI copy and responsive layout for the bulk action bar and archived filter in `frontend/app/(dashboard)/merchant/(features)/products/new/_components/MyProductsSection.tsx`
- [ ] T039 Ask the user to run `cd backend && pnpm run lint:ci` and `cd backend && pnpm run test:e2e`, then collect output; do not run them as the agent
- [ ] T040 Ask the user to run `cd frontend && pnpm run lint` and `cd frontend && pnpm run type-check`, then collect output; do not run them as the agent
- [ ] T041 Ask the user to run the manual scenarios from `specs/003-bulk-product-actions/quickstart.md` and collect results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1 and blocks all user stories.
- **Phase 3 US1**: Depends on Phase 2. This is the MVP.
- **Phase 4 US2**: Depends on Phase 2 and can build on US1 bulk update behavior.
- **Phase 5 US3**: Depends on Phase 2 and can proceed after shared UI status/archive behavior is established.
- **Phase 6 Polish**: Depends on the desired user stories being complete.

### User Story Dependencies

- **US1 Merchant bulk availability/category**: No dependency on other user stories after foundation.
- **US2 Merchant archive/restore**: Uses the same merchant bulk update path as US1 but remains independently testable through archive/activate.
- **US3 Admin parity**: Reuses shared UI and existing admin bulk endpoint; depends on foundational shared validation/status support.

### Parallel Opportunities

- T001, T002, T003, and T004 can be split across engineers after feature docs are understood.
- T005 and T006 can run in parallel with T009 after contract shape is agreed.
- Within US1, T014 and T015 can follow backend contract decisions while T018-T020 refine UI feedback.
- Within US2, T021 and T023 can run in parallel before integration in T024-T028.
- Within US3, T031 and T032 can run in parallel with T029 after shared validation rules are stable.

## Parallel Example: User Story 1

```text
Task: "Add bulkUpdateProducts method to frontend/services/api/products.service.ts"
Task: "Add merchant-facing success and error copy for bulk availability/category updates in frontend/app/(dashboard)/merchant/(features)/products/new/_components/MyProductsSection.tsx"
```

## Parallel Example: User Story 2

```text
Task: "Add active/archived product status filter controls in frontend/app/(dashboard)/merchant/(features)/products/new/_components/MyProductsSection.tsx"
Task: "Add bulk archive confirmation state and cancel/confirm handling in frontend/app/(dashboard)/merchant/(features)/products/new/_components/MyProductsSection.tsx"
```

## Parallel Example: User Story 3

```text
Task: "Align BulkUpdateAdminProductsDto in backend/src/admin/dto/catalog-item.dto.ts with the shared bulk update validation rules"
Task: "Update frontend/services/api/admin.service.ts admin product loading/search methods to pass the requested active or archived status"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 foundational DTO, validation, and status support.
3. Complete Phase 3 merchant bulk availability/category actions.
4. Stop and have the user run validation for US1.

### Incremental Delivery

1. Deliver US1 for merchant daily bulk updates.
2. Add US2 archive/restore and archived view.
3. Add US3 admin parity using the same shared UI patterns.
4. Complete polish and user-run verification.

### Agent Verification Constraint

The agent must not run lint, typecheck, test, build, dev-server, package-manager, migration, or dependency commands in this repository. Verification tasks must ask the user to run the relevant commands and share output.
