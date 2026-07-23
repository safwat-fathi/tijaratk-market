# Customer Address Tenant Transaction Fix

## Problem

Checkout can create or update a customer through a tenant-scoped Prisma
transaction, then attempt to persist the customer's address through the global
Prisma client. PostgreSQL row-level security rejects that address write because
the global connection does not carry the transaction-local `app.tenant_id`.

## Implementation

1. Allow `upsertCustomerAddress` to receive the active Prisma transaction.
2. Pass the scoped transaction from the existing-customer flow.
3. Pass the required transaction from the new-customer flow.
4. Prefer the explicitly supplied transaction, then the request tenant context,
   and only then the existing global-client fallback.

## Verification

The user should run the backend TypeScript check and retry public checkout with
a delivery address. No schema or RLS migration is required.
