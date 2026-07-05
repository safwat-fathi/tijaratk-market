# Tasks: Arabic Fuzzy Product Search

**Input**: Design documents from `specs/004-arabic-fuzzy-search/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/product-search.md](./contracts/product-search.md), [quickstart.md](./quickstart.md)

**Tests**: Automated coverage is explicitly required by FR-010, so test tasks are included. Write test tasks first and expect them to fail before implementation.

**Agent constraint**: AI agents must not run package-manager, migration, lint, typecheck, test, build, or dev-server commands in this repository. Manual verification commands remain documented in [quickstart.md](./quickstart.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other marked tasks in the same phase because it touches different files or depends only on completed prerequisite phases.
- **[Story]**: Maps the task to a specific user story from [spec.md](./spec.md).
- Every task includes an exact file path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the files needed by the migration, normalization, and test work.

- [X] T001 Create migration file for Arabic product search in `backend/prisma/migrations/20260705000000_add_arabic_product_search/migration.sql`
- [X] T002 [P] Create shared Arabic normalization utility file in `backend/src/products/utils/arabic-normalize.util.ts`
- [X] T003 [P] Create normalization unit test file in `backend/src/products/utils/arabic-normalize.util.spec.ts`
- [X] T004 [P] Create product search service test file in `backend/src/products/products.service.spec.ts`
- [X] T005 [P] Create product search e2e test file in `backend/test/product-search.e2e-spec.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema and shared normalization behavior that all user stories depend on.

**Critical**: No user story implementation should start until this phase is complete.

- [X] T006 Add immutable `arabic_normalize(input text)` SQL function preserving alef/ya/ta-marbuta normalization, tashkeel/tatweel stripping, package-size cleanup, punctuation cleanup, whitespace cleanup, and leading `ال` cleanup in `backend/prisma/migrations/20260705000000_add_arabic_product_search/migration.sql`
- [X] T007 Add generated stored `name_normalized` column and GIN trigram index for `products.name_normalized` in `backend/prisma/migrations/20260705000000_add_arabic_product_search/migration.sql`
- [X] T008 Represent DB-managed `products.name_normalized` as ignored unsupported Prisma schema metadata and read it through raw SQL in `backend/prisma/schema.prisma`
- [X] T009 Implement `arabicNormalize` TypeScript utility matching the SQL normalization behavior in `backend/src/products/utils/arabic-normalize.util.ts`
- [X] T010 Replace the private product-search normalization implementation with the shared utility import in `backend/src/products/products.service.ts`
- [X] T011 Add representative non-production Arabic spelling-variant seed products for one grocery merchant in `backend/src/common/seeders/supermarket-products.data.ts`
- [X] T012 Add representative non-production Arabic spelling-variant seed products for one pharmacy merchant in `backend/src/common/seeders/pharmacy-products.data.ts`

**Checkpoint**: Database-managed normalization, Prisma-safe generated-column ownership, shared utility behavior, and seed fixtures are ready for story work.

---

## Phase 3: User Story 1 - Find Arabic Products Despite Spelling Variants (Priority: P1) MVP

**Goal**: Searching a merchant catalog finds product names despite Arabic spelling variants, diacritics, tatweel, package-size fragments, punctuation, whitespace noise, and leading `ال`.

**Independent Test**: Add equivalent Arabic product names to one tenant, search each variant through merchant and public product search, and confirm all intended products are returned within the first 5 results.

### Tests for User Story 1

- [X] T013 [P] [US1] Add unit tests for alef variants, alef maksura, ta marbuta, tashkeel, tatweel, package-size cleanup, punctuation cleanup, whitespace cleanup, and leading `ال` in `backend/src/products/utils/arabic-normalize.util.spec.ts`
- [X] T014 [P] [US1] Add merchant product search variant-matching tests for `آيه`, `ايه`, and `اية` in `backend/src/products/products.service.spec.ts`
- [X] T015 [P] [US1] Add public storefront product search variant-matching e2e coverage for `GET /products/public/:slug?search=...` in `backend/test/product-search.e2e-spec.ts`

### Implementation for User Story 1

- [X] T016 [US1] Update authenticated product search SQL to compare and rank against `products.name_normalized` and `arabic_normalize($query)` in `backend/src/products/products.service.ts`
- [X] T017 [US1] Update public storefront product search SQL to compare and rank against `product.name_normalized` and `arabic_normalize($query)` in `backend/src/products/products.service.ts`
- [X] T018 [US1] Remove duplicated inline comparable-name SQL expression usage for product search while keeping catalog item search unchanged in `backend/src/products/products.service.ts`
- [X] T019 [US1] Add a short code comment about a dedicated search engine being the next step if search volume or relevance needs grow in `backend/src/products/products.service.ts`

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Keep Search Results Within One Merchant Catalog (Priority: P2)

**Goal**: Search results remain isolated to the requested merchant catalog for authenticated merchant and public storefront searches.

**Independent Test**: Seed two tenants with similar Arabic product names, search within one tenant, and confirm no product from the other tenant appears.

### Tests for User Story 2

- [X] T020 [P] [US2] Add authenticated tenant isolation search tests with matching products in two tenants in `backend/src/products/products.service.spec.ts`
- [X] T021 [P] [US2] Add public storefront slug isolation e2e tests with matching products in two tenants in `backend/test/product-search.e2e-spec.ts`
- [X] T022 [P] [US2] Add empty and whitespace-only search rejection coverage for merchant and public paths in `backend/test/product-search.e2e-spec.ts`

### Implementation for User Story 2

- [X] T023 [US2] Verify authenticated search keeps `tenant_id`, `status`, and `deleted_at` filters in every normalized search data and count query in `backend/src/products/products.service.ts`
- [X] T024 [US2] Verify public search keeps slug-resolved tenant, active status, deleted exclusion, and optional category filtering in every normalized search data and count query in `backend/src/products/products.service.ts`
- [X] T025 [US2] Ensure existing DTO validation and service validation reject empty or whitespace-only searches without returning product data in `backend/src/products/dto/get-tenant-products.dto.ts`
- [X] T026 [US2] Ensure existing DTO validation and service validation reject empty or whitespace-only searches without returning product data in `backend/src/products/dto/get-public-products.dto.ts`

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Rank Useful Matches First (Priority: P3)

**Goal**: Search results are ordered by useful relevance, exact or near-exact normalized matches rank above weaker matches, and pagination remains stable.

**Independent Test**: Seed exact, near-exact, contains, and weak Arabic matches, search the exact term, and confirm ranking and pagination metadata remain stable.

### Tests for User Story 3

- [X] T027 [P] [US3] Add ranking tests for exact, near-exact, contains, and weak Arabic product matches in `backend/src/products/products.service.spec.ts`
- [X] T028 [P] [US3] Add pagination stability tests for page 1 and page 2 of the same normalized search in `backend/src/products/products.service.spec.ts`
- [X] T029 [P] [US3] Add public storefront pagination metadata e2e coverage for normalized product search in `backend/test/product-search.e2e-spec.ts`

### Implementation for User Story 3

- [X] T030 [US3] Preserve existing word-similarity, similarity, prefix, contains, recency, and ID fallback ordering against normalized product names in `backend/src/products/products.service.ts`
- [X] T031 [US3] Preserve count-query parameter handling and pagination metadata after normalized product search changes in `backend/src/products/products.service.ts`
- [X] T032 [US3] Tune or confirm existing strict similarity thresholds against the Arabic seed fixtures without changing global trigram settings in `backend/src/products/products.service.ts`

**Checkpoint**: All user stories are independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, manual verification support, and implementation cleanup across the feature.

- [X] T033 [P] Update validation notes with final implemented command names and expected outputs in `specs/004-arabic-fuzzy-search/quickstart.md`
- [X] T034 [P] Update product search contract notes if response fields or validation behavior changed during implementation in `specs/004-arabic-fuzzy-search/contracts/product-search.md`
- [X] T035 Add manual EXPLAIN ANALYZE instructions for confirming the normalized trigram index is used in `specs/004-arabic-fuzzy-search/quickstart.md`
- [X] T036 Review generated column write safety and remove any application write attempts to `name_normalized` in `backend/src/products/products.service.ts`
- [X] T037 Record the manual verification command list for the user without executing it in `specs/004-arabic-fuzzy-search/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** has no dependencies.
- **Phase 2: Foundational** depends on Phase 1 and blocks all user story implementation.
- **Phase 3: User Story 1** depends on Phase 2 and is the MVP.
- **Phase 4: User Story 2** depends on Phase 2 and can run after or alongside US1 once shared search SQL shape is understood.
- **Phase 5: User Story 3** depends on Phase 2 and benefits from US1 normalized ranking implementation.
- **Phase 6: Polish** depends on all selected user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories after foundational work.
- **US2 (P2)**: No functional dependency on US3; should validate isolation on the same normalized search implementation introduced for US1.
- **US3 (P3)**: Depends on normalized product search behavior from US1 for meaningful ranking tests.

### Within Each User Story

- Write tests first and confirm they fail before implementation.
- Complete service/query implementation before updating docs for changed behavior.
- Re-run user-managed verification after each story is implemented.

## Parallel Opportunities

- Setup tasks T002, T003, T004, and T005 can run in parallel after T001.
- Seed fixture tasks T011 and T012 can run in parallel after T009 defines expected normalization behavior.
- US1 test tasks T013, T014, and T015 can run in parallel after Phase 2.
- US2 test tasks T020, T021, and T022 can run in parallel after Phase 2.
- US3 test tasks T027, T028, and T029 can run in parallel after Phase 2.
- Polish documentation tasks T033 and T034 can run in parallel after implementation behavior is stable.

## Parallel Example: User Story 1

```text
Task: "T013 [P] [US1] Add unit tests for alef variants, alef maksura, ta marbuta, tashkeel, tatweel, package-size cleanup, punctuation cleanup, whitespace cleanup, and leading `ال` in backend/src/products/utils/arabic-normalize.util.spec.ts"
Task: "T014 [P] [US1] Add merchant product search variant-matching tests for `آيه`, `ايه`, and `اية` in backend/src/products/products.service.spec.ts"
Task: "T015 [P] [US1] Add public storefront product search variant-matching e2e coverage for `GET /products/public/:slug?search=...` in backend/test/product-search.e2e-spec.ts"
```

## Parallel Example: User Story 2

```text
Task: "T020 [P] [US2] Add authenticated tenant isolation search tests with matching products in two tenants in backend/src/products/products.service.spec.ts"
Task: "T021 [P] [US2] Add public storefront slug isolation e2e tests with matching products in two tenants in backend/test/product-search.e2e-spec.ts"
Task: "T022 [P] [US2] Add empty and whitespace-only search rejection coverage for merchant and public paths in backend/test/product-search.e2e-spec.ts"
```

## Parallel Example: User Story 3

```text
Task: "T027 [P] [US3] Add ranking tests for exact, near-exact, contains, and weak Arabic product matches in backend/src/products/products.service.spec.ts"
Task: "T028 [P] [US3] Add pagination stability tests for page 1 and page 2 of the same normalized search in backend/src/products/products.service.spec.ts"
Task: "T029 [P] [US3] Add public storefront pagination metadata e2e coverage for normalized product search in backend/test/product-search.e2e-spec.ts"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1.
2. Complete Phase 2.
3. Complete Phase 3.
4. Stop and have the user run the manual migration, generation, test, and lint commands from [quickstart.md](./quickstart.md).
5. Review output before proceeding to tenant isolation and ranking refinements.

### Incremental Delivery

1. Setup and foundation make normalized search data available.
2. US1 proves Arabic variant matching.
3. US2 proves tenant isolation and invalid-query handling.
4. US3 proves ranking and pagination quality.
5. Polish records manual verification and final contract notes.

### Manual Verification Reminder

The user, not the AI agent, should run the commands listed in [quickstart.md](./quickstart.md), including migration, Prisma generation, tests, and lint.
