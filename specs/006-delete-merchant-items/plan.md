# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

The core requirement is to allow admins to delete a merchant-owned item safely. We will implement soft deletion in the database by utilizing `deleted_at` and adding `deleted_by_id` to the `Product` model, ensuring that the product is filtered out of all active views while maintaining order history readability (FR-008, FR-011). We will validate that the product is not part of any active order (FR-007) before confirming deletion.

## Technical Context

**Language/Version**: TypeScript (Frontend & Backend)
**Primary Dependencies**: NestJS (Backend), Next.js 16/React 19 (Frontend), Prisma 7.8 (ORM)
**Storage**: PostgreSQL (via Prisma Adapter)
**Testing**: Jest (Backend e2e/unit)
**Target Platform**: Web (Admin Panel) & API
**Project Type**: Fullstack Web Application (Next.js + NestJS)
**Performance Goals**: Deletion operation completes under 30 seconds (SC-001)
**Constraints**: Tenant isolation (RLS), Operational dependency checks (orders)
**Scale/Scope**: Single item deletion; bulk deletion out of scope

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

No explicit project constitution constraints violated. Existing patterns for auth, tenant isolation, and REST API controllers will be followed.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   └── products/
│       ├── products.controller.ts (New endpoint for admin deletion)
│       └── products.service.ts (Logic for order check and soft delete)
├── prisma/
│   └── schema.prisma (Add deleted_by_id to Product)

frontend/
├── src/
│   └── components/
│       └── admin/... (Update UI lists/detail views with Delete action)
```

**Structure Decision**: The solution fits cleanly into the existing Next.js frontend and NestJS backend architecture, primarily extending the existing `Products` module and Prisma schema.
