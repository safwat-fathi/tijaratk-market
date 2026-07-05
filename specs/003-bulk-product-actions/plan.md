# Implementation Plan: Bulk Product Actions

**Branch**: `main` | **Date**: 2026-07-05 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/003-bulk-product-actions/spec.md`

## Summary

Add visible-row bulk actions to the shared product management experience used by merchant and admin dashboards. The implementation will reuse the existing shared product onboarding/list UI, add a merchant-owned bulk update API/action path, keep the existing admin bulk update path, and extend dashboard product listing/search to include an archived view so archived products can be activated again.

## Technical Context

**Language/Version**: TypeScript with Next.js App Router frontend and NestJS backend  
**Primary Dependencies**: Next.js server actions/API routes, React client components, NestJS controllers/services/DTO validation, Prisma-backed product persistence  
**Storage**: Existing relational database product records with `status`, `is_available`, `category`, tenant ownership, and soft-delete fields  
**Testing**: Repository test/lint/build commands are user-run only per `AGENTS.md`; implementation should add focused backend/service and frontend behavior coverage where existing test patterns support it  
**Target Platform**: Web application with merchant dashboard, admin dashboard, and backend API  
**Project Type**: Full-stack web application  
**Performance Goals**: Bulk update at least 10 selected visible products in under 30 seconds; avoid selecting or updating hidden/all-filtered products implicitly  
**Constraints**: Respect merchant tenant isolation; preserve admin authorization; require confirmation before bulk archive; do not run prohibited verification/package/build/dev commands as the agent  
**Scale/Scope**: Product management screens and product API/service paths only; catalog source isolation remains unchanged

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution file contains placeholder principles only, so no project-specific constitutional gates are enforceable. Repository `AGENTS.md` constraints are binding for this feature:

- Catalog source policy must remain centralized and unaffected; this feature updates tenant products, not ready-made catalog imports or source mapping.
- Agent must not run verification, migration, package-manager, lint, typecheck, test, build, or dev-server commands.

Gate status: PASS. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/003-bulk-product-actions/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── product-bulk-actions.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
backend/
└── src/
    ├── products/
    │   ├── dto/
    │   ├── products.controller.ts
    │   └── products.service.ts
    └── admin/
        ├── admin.controller.ts
        └── dto/

frontend/
├── actions/
│   ├── product-actions.ts
│   └── admin-server.ts
├── app/
│   ├── api/merchant/products/
│   └── (dashboard)/
│       ├── merchant/(features)/products/new/
│       └── admin/products/
├── services/api/
│   ├── products.service.ts
│   └── admin.service.ts
└── types/models/
```

**Structure Decision**: Use the existing full-stack web application structure. Backend product ownership and validation belong in `backend/src/products`; admin-only orchestration remains in `backend/src/admin`; shared product dashboard behavior stays in the existing `ProductOnboardingClient` and `MyProductsSection` components.

## Complexity Tracking

No constitution violations or extra architectural complexity are introduced.
