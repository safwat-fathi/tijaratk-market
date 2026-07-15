# Admin-Managed Merchant Operations MVP

## Summary

Implement managed-store operations as a dedicated admin tenant context, never as merchant impersonation. Every operation will require:

- An active administrator account.
- An explicit per-store assignment.
- A valid management session.
- The exact action permission.
- A tenant-scoped database operation.
- An admin-attributed activity record for mutations.

Existing platform-wide administration remains available only to `platform_admin` accounts. Even platform admins require an assignment and management session to modify merchant products or orders.

Persist this approved plan as `.docs/plans/admin-managed-merchant-operations.md` before implementation.

## Data and Authorization Foundation

- Extend `AdminUser` with `role: platform_admin | operations_admin` and `is_active`. Backfill existing admins as platform admins; new accounts default to operations admins. Login and JWT validation must read current database state and reject disabled accounts.
- Add `AdminTenantAccess` using serial IDs, one record per admin/tenant, JSONB permissions validated against centralized constants, optional expiry, grant/revoke timestamps, and granting-admin attribution.
- Add `AdminManagementSession` using a serial ID plus a unique SHA-256 hash of a 256-bit opaque cookie token. Store admin, tenant, assignment, required 10–500 character reason, IP, user agent, activity timestamps, expiry, end timestamp, and end reason.
- Enforce one active management session per administrator using a partial unique PostgreSQL index. Starting or switching stores ends the previous session, including sessions on other devices.
- Configure a 45-minute inactivity timeout and eight-hour absolute lifetime through environment variables. Every accepted managed request refreshes `last_active_at`; logout, revocation, disablement, switching, and timeout terminate the session.
- Extend `ActivityLog` with `management_session_id`, `request_id`, and `ip_address`. Keep it application-level append-only with indefinite MVP retention; admin accounts are disabled and assignments revoked rather than deleted.
- Keep access/session tables outside tenant RLS because they are control-plane records needed before tenant context is established. Existing merchant-owned tables and activity logs continue using PostgreSQL RLS.
- Introduce a trusted `ActorContext` containing actor type/id, tenant, session, permissions, request ID, and IP. A composite managed-tenant guard constructs it from backend-authenticated state; controllers receive it through a decorator rather than frontend fields.
- Use stable responses: `401` for invalid admin authentication, `403` with machine-readable codes for missing/expired sessions or permissions, and `404` for tenant/resource mismatches.

Permission presets store explicit permission strings and remain customizable:

- Catalog Operator: product read/create/details/price/availability/archive plus activity-log read.
- Order Operator: order read/status/pricing/replacements, limited order-specific customer data, product read/availability, and activity-log read.
- Store Manager: union of both presets.
- No assignment grants customer-list access, replacement decisions on behalf of customers, subscription management, merchant ownership changes, or platform administration.

## Backend and API Changes

- Add platform-admin-only APIs for listing existing admin accounts and listing/upserting/revoking tenant assignments. Account provisioning and credential management remain outside this MVP.
- Add management-session APIs:
  - `POST /admin/management-sessions`
  - `GET /admin/management-sessions/current`
  - `DELETE /admin/management-sessions/current`
  - `GET /admin/tenants/:tenantId/management-sessions`
- Add dedicated managed routes under `/admin/managed-tenants/:tenantId` for:
  - Product/category/catalog reads, manual creation, creation from the allowed catalog, detail updates, price updates, availability updates, archive/restore.
  - Order list/detail reads, status transitions, total/line pricing, out-of-stock handling, replacement proposal/reset.
  - Tenant activity-log reads.
- Split sensitive mutations into permission-specific DTOs and endpoints so a general product update cannot smuggle price, availability, or status changes.
- Retire unguarded merchant-targeting admin mutation routes such as product updates by product ID alone. Global admin product/order pages may remain platform-admin read-only views linking into managed sessions.
- Apply a platform-role guard to existing plans, subscriptions, tenant status, platform catalog, import, area, and global reporting routes.
- Refactor shared product and order services to accept `ActorContext`. Merchant controllers construct merchant actors; managed controllers supply admin actors. Do not duplicate domain rules.
- Remove global ID-first admin lookups such as resolving a product’s tenant before entering RLS. Establish tenant context from the validated session first, then query by both tenant and resource identity.
- Commit database mutations and activity records in the same tenant-scoped Prisma transaction. Perform image preparation before the transaction and notifications/cache invalidation after commit.
- Preserve existing order transition rules. Managed admins may confirm, cancel, dispatch, complete, correct pricing, mark items unavailable, and propose/reset replacements. They may not approve or reject a replacement as the customer.
- Admin cancellations count normally toward the tenant cancellation policy, while cancellation-policy events and activity logs identify the administrator actor.
- Restrict customer data to the selected order’s name, phone, address, and delivery information. Do not add customer directories, exports, or marketing access.
- Add admin actor support to all existing product/order activity logging paths. Record session start/end, access grant/revoke, product mutations, order mutations, before/after values, and correlation IDs. Failed mutations must not emit success activity.
- Continue using `catalog-source-policy.ts`: grocery tenants receive only `talabat_csv`, pharmacy tenants only `chefaa_csv`, and other categories receive no ready-made catalog. Never introduce frontend-only filtering or source fallbacks.
- Keep CSV/bulk merchant mutations and internal operations notes outside the MVP. Manual creation and single-item catalog addition satisfy product onboarding.
- Rate-limit session creation and assignment mutations and emit structured security logs for permission denials, cross-tenant attempts, revocations, and session termination.

## Frontend and Rollout

- Add `/admin/merchants/[tenantId]` as the merchant details page with access status, assignments, expiry, recent sessions, and a Manage Store dialog requiring a reason.
- Add managed routes for products, orders, order detail, and activity beneath `/admin/merchants/[tenantId]/manage`.
- Build the admin layout as a server-authenticated shell with role-aware navigation. Operations admins see assigned merchants only; platform admins retain platform administration.
- Render a persistent Arabic banner showing store name, administrator mode, reason, maximum expiry, and Exit action. Key the layout by session ID so switching stores remounts tenant-specific client state.
- Reuse current product onboarding and order presentation components by extracting actor-neutral views and passing capabilities/base paths. Use separate managed Server Actions and API services; do not reuse merchant authentication cookies.
- Keep pages as Server Components with server-side API fetching. The opaque management token remains in a secure, HTTP-only, same-site cookie and is forwarded only server-side.
- On managed-session errors, clear only the management cookie and redirect to merchant details; do not log the administrator out. Logout clears both cookies and terminates the session.
- Use no-store caching for session/access-specific responses. Include tenant identity in any retained backend cache keys and revalidate the managed product/order pages plus the public storefront after mutations.
- Add feature flags, all disabled by default:
  - `ADMIN_MANAGED_STORES_ENABLED`
  - `ADMIN_PRODUCT_WRITE_ENABLED`
  - `ADMIN_ORDER_WRITE_ENABLED`
  - `ADMIN_BULK_PRODUCT_UPDATE_ENABLED` remains disabled and unsupported in this MVP.
- Roll out by deploying schema and guarded code, creating assignments, enabling managed reads, then product writes, then order writes. Merchant notification is limited to admin-attributed entries in the existing activity timeline.

## Test and Acceptance Plan

- Repair the existing backend security E2E bootstrap to use the current Prisma application instead of its stale TypeORM setup. Do not add unit/spec tests, per repository rules.
- Add E2E coverage for:
  - Platform versus operations role boundaries.
  - Assigned, unassigned, expired, and revoked access.
  - Disabled administrators and expired/ended sessions.
  - One-active-session enforcement and store switching.
  - Session-token replay by another administrator.
  - Modified tenant, product, order, and item identifiers returning denial or tenant-safe `404`.
  - Independent enforcement of every permission group.
  - Product/order mutation and audit atomicity; failed mutations produce no success log.
  - Admin actor/session/request attribution in activity records.
  - Merchant workflows remaining functional with merchant attribution.
  - Grocery/pharmacy/other catalog-source isolation.
  - Admin cancellation counters and admin actor metadata.
  - Customer replacement decisions remaining customer-token-only.
  - Feature flags rejecting disabled capabilities.
- QA the Arabic UI for the required reason dialog, persistent banner, role-aware navigation, session expiry, explicit exit, store switching, action hiding, activity history, and absence of stale tenant data.
- Because AI agents may not execute repository verification commands, the user will run and share results from:
  - `cd backend && pnpm run prisma:migrate:dev`
  - `cd backend && pnpm run prisma:generate`
  - `cd backend && pnpm run lint:ci`
  - `cd backend && pnpm run test:e2e`
  - `cd frontend && pnpm run lint`
- Production rollout uses `cd backend && pnpm run prisma:migrate:deploy` before enabling any feature flag.
