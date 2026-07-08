# Phase 0: Research

## Technical Context
- **Language/Version**: TypeScript (Frontend & Backend)
- **Primary Dependencies**: NestJS (Backend), Next.js 16/React 19 (Frontend), Prisma 7.8 (ORM)
- **Storage**: PostgreSQL (via Prisma Adapter)
- **Testing**: Jest (Backend e2e/unit)
- **Project Type**: Fullstack Web Application (Next.js Admin UI + NestJS API)

## Decisions

### Database Strategy for Deletion
- **Decision**: Soft delete by utilizing existing `deleted_at` in the `Product` model and adding `deleted_by_id` for auditability.
- **Rationale**: `deleted_at` already exists. Adding `deleted_by_id` fulfills FR-011 (accountability) without the complexity of a separate audit log table. Prisma queries must exclude `deleted_at: { not: null }` for active items (already a common pattern for soft deletion).
- **Alternatives considered**: Hard delete (rejected due to historical order readability requirements, FR-008). Dedicated audit log table (rejected as over-engineering when a single ID field suffices).

### Active Order Validation
- **Decision**: Validate against active orders before deletion. An "active" order is one that is not in a terminal state (DELIVERED, CANCELLED, REJECTED).
- **Rationale**: Meets FR-007. We will check the `OrderItem` relation of the product to ensure no related `Order` is in `PENDING`, `PREPARING`, `READY`, `ON_THE_WAY`, etc.
- **Alternatives considered**: Time-based locking (rejected because an order could take variable time).

### Admin UI Implementation
- **Decision**: Add a Delete action (e.g. icon/button) to the Admin Product list and detail views. When clicked, show a confirmation dialog (FR-003, FR-004). If deletion succeeds, update the UI optimistically or refetch the list.
- **Rationale**: Standard Next.js server actions / API routes can handle this gracefully. The confirmation modal ensures safety (FR-004). Deleted items are filtered out in the API, so a list refresh hides them (FR-005, FR-012).
- **Alternatives considered**: Trash view (rejected in clarifications).
