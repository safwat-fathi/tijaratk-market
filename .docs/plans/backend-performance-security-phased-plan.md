# Backend Performance & Security Phased Plan

## Summary

Implement a balanced 4-phase backend roadmap for the NestJS/Prisma API. Start with low-risk security hardening, then reinforce tenant/catalog isolation, then optimize known hot paths, and finish with operational performance work.

## Phase 1: Immediate Security Hardening

- Verify Twilio WhatsApp webhook signatures.
- Replace raw webhook payload logging with safe structured logging.
- Add in-process idempotency for repeated webhook events.
- Apply route-specific throttling to public/high-abuse endpoints.
- Tighten CORS with `CORS_ALLOWED_ORIGINS`.
- Gate Swagger/docs with `ENABLE_SWAGGER`.

## Phase 2: Tenant & Catalog Isolation

- Keep source/category policy centralized in `backend/src/products/catalog-source-policy.ts`.
- Ensure catalog browsing and import paths only expose valid source/category rows.
- Ensure hidden catalog item reads are scoped to the tenant's allowed catalog source.
- Run catalog cleanup after code changes where polluted rows may already exist.

## Phase 3: Performance Hot Paths

- Keep product search cache versioning and invalidate catalog cache on hidden item mutations.
- Avoid loading all hidden catalog IDs for catalog browse/search filters.
- Bound merchant order list responses.
- Cache dashboard measurements with tenant/period versioning.
- Preserve streaming CSV imports and batch row-error persistence.

## Phase 4: Reliability, Observability & Background Work

- Add request correlation IDs and structured request completion logs.
- Add Prisma slow-query logging.
- Add DB/env health readiness checks.
- Keep slow side effects isolated and ready for a worker-backed queue later.

## Public Interfaces / Types

- `CORS_ALLOWED_ORIGINS`
- `ENABLE_SWAGGER`
- `TWILIO_AUTH_TOKEN`
- `SLOW_QUERY_MS`

## Test Plan

- Unit tests for webhook signature/idempotency and catalog source policy.
- Existing catalog tests for grocery/pharmacy/unsupported tenant behavior.
- E2E/security tests for tenant isolation, public tracking, and mass assignment.
- Performance checks for catalog search, product list, order list, and dashboard.

## Assumptions

- Use the existing NestJS/Prisma/cache/throttler stack.
- Do not add DB migrations unless a later index/persistence task explicitly requires it.
- Prefer updating existing specs over creating new spec files.
