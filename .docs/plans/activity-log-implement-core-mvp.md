# Activity Log Core MVP Implementation Plan

## Summary

- Add a tenant-isolated activity log for merchant operations.
- Implement database schema, backend read API, service-layer logging for existing order/product flows, and merchant UI.
- Align with Prisma 7, existing PostgreSQL RLS, NestJS modules/controllers/services, and Next.js 16 App Router patterns.

## Backend

- Add `ActivityLog`, `ActivityEntityType`, and `ActivitySource` to Prisma schema with `Tenant`, `User`, and `AdminUser` relations.
- Add a migration that creates the table, enum types, JSONB fields, indexes, foreign keys, and tenant RLS policy.
- Add `ActivityLogModule`, controller, service, DTOs, action constants, Arabic labels, and diff/sanitization helpers.
- Expose `GET /activity-logs` for authenticated merchant users with `entity_type`, `entity_id`, `action`, `cursor`, and `limit`.
- Log current order flows: created, status changed, cancelled, completed, customer rejected, total changed, item price changed, item out of stock, replacement proposed/approved/rejected.
- Log current product flows: created, updated, price changed, availability changed, archived, bulk created, bulk updated, CSV import completed.

## Frontend

- Add activity log model types and API service.
- Add reusable server-renderable activity timeline components.
- Add `/merchant/activity` page with link-based filters and cursor pagination.
- Add an order detail timeline.
- Add a sidebar navigation item for activity logs.

## Verification

AI agents must not run verification commands in this repo. After implementation, the user should run:

- `cd backend && pnpm run prisma:migrate:dev`
- `cd backend && pnpm run prisma:generate`
- `cd backend && pnpm run lint:ci`
- `cd frontend && pnpm run lint`

