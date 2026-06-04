# Fix Public Order Tracking RLS Lookup

## Problem

Public order tracking fails for non-superuser database roles because `app.resolve_tenant_id_by_order_token()` reads from `orders` before `app.tenant_id` is set. The `tenant_isolation_orders` RLS policy calls `app.current_tenant_id()`, which raises `app.tenant_id is not set` when no tenant context exists.

## Change

Add a Prisma migration that updates `app.current_tenant_id()` to return `NULL` when `app.tenant_id` is missing instead of raising an exception.

## Why This Works

Tenant-scoped RLS policies like `tenant_id = app.current_tenant_id()` remain restrictive because comparisons with `NULL` do not pass. The separate `tracking_token_lookup_orders` policy can then allow the token lookup without being blocked by an exception from another policy.

## Verification

Run the migration locally with a non-superuser/non-`BYPASSRLS` role and verify `GET /orders/tracking/:token` returns the tracked order instead of a 500 error.
