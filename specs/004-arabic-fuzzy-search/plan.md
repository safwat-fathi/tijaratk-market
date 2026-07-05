# Implementation Plan: Arabic Fuzzy Product Search

**Branch**: `004-arabic-fuzzy-search` | **Date**: 2026-07-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/004-arabic-fuzzy-search/spec.md`

## Summary

Improve existing merchant and public product search so Arabic spelling variants match consistently and efficiently. The implementation will keep the current `ProductsController` search surfaces, add database-managed Arabic-normalized product-name search data, use indexed trigram ranking against that normalized value, and preserve tenant/catalog isolation rules.

## Technical Context

**Language/Version**: TypeScript on NestJS backend; Prisma ORM; PostgreSQL database  
**Primary Dependencies**: NestJS modules/controllers/services, Prisma Client, PostgreSQL `pg_trgm`, class-validator/class-transformer DTO validation, existing cache-manager usage  
**Storage**: PostgreSQL tables managed through Prisma migrations; `products` table is the primary target  
**Testing**: Jest-style backend unit/integration tests are expected by project convention, but no existing backend spec files were present during planning  
**Target Platform**: Node.js backend service deployed with the existing application stack  
**Project Type**: Web service backend in a full-stack app  
**Performance Goals**: First search result page visible to users in under 1 second for merchant catalogs containing a few thousand products  
**Constraints**: No new search infrastructure; preserve tenant isolation through `tenant_id`; avoid frontend-only filtering; do not mix catalog sources; AI agents must not run package-manager, migration, lint, typecheck, test, build, or dev-server commands in this repository  
**Scale/Scope**: Product-name search for one merchant catalog at a time; public storefront and authenticated merchant product search paths; cross-language, semantic, and global multi-merchant ranking are out of scope

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution file is still a placeholder and defines no enforceable gates. Project-specific constraints from `AGENTS.md` apply:

- Catalog isolation must remain centralized and source-aware; this feature must not mix ready-made catalog sources or rely on frontend filtering.
- Verification, migration, package-manager, lint, typecheck, test, build, and dev-server commands must be listed for the user to run manually, not executed by the agent.

Gate status: PASS. No constitution violations identified.

## Project Structure

### Documentation (this feature)

```text
specs/004-arabic-fuzzy-search/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── product-search.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   ├── migrations/
│   │   └── <timestamp>_add_arabic_product_search/
│   │       └── migration.sql
│   └── schema.prisma
└── src/
    ├── app.module.ts
    ├── common/
    │   └── seeders/
    │       ├── supermarket-products.data.ts
    │       └── pharmacy-products.data.ts
    └── products/
        ├── dto/
        │   ├── get-public-products.dto.ts
        │   └── get-tenant-products.dto.ts
        ├── products.controller.ts
        ├── products.module.ts
        ├── products.service.ts
        └── utils/
            └── arabic-normalize.util.ts
```

**Structure Decision**: Enhance the existing `products` module instead of adding a new `search` module. The existing authenticated `GET /products?search=...` and public `GET /products/public/:slug?search=...` flows already implement tenant-scoped product search, caching, pagination, and category filtering. Keeping the feature there avoids duplicate search contracts and preserves current frontend integration points.

## Phase 0: Research

Research output: [research.md](./research.md)

Key decisions:

- Use a PostgreSQL immutable SQL normalization function as the source of truth for persisted/indexed search values.
- Add a generated stored normalized product-name column to `products`.
- Query `products.name_normalized` for product search ranking/filtering while keeping request-side TypeScript normalization only for validation, cache-key stability, and test fixtures.
- Keep existing product endpoints and response envelopes.
- Do not alter catalog source policy or broaden ready-made catalog search as part of this feature.

## Phase 1: Design & Contracts

Design outputs:

- [data-model.md](./data-model.md)
- [contracts/product-search.md](./contracts/product-search.md)
- [quickstart.md](./quickstart.md)

Agent context update: skipped because this Spec Kit installation has no agent-context update script under `.specify/scripts/`.

## Post-Design Constitution Check

Gate status: PASS.

- The design keeps merchant/product isolation in backend queries through tenant constraints.
- Ready-made catalog source policy remains untouched and centralized in `backend/src/products/catalog-source-policy.ts`.
- Manual verification commands are documented in quickstart instead of being executed by the agent.

## Complexity Tracking

No constitution violations or complexity exceptions.
