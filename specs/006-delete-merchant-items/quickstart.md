# Quickstart: Delete Merchant Items From Admin

## Prerequisites

- Backend and frontend are configured with a development database that has at least one admin user and one merchant with products.
- The user running validation has permission to run this repository's normal local commands.
- AI agents must not run package-manager, lint, typecheck, test, build, migration, or dev-server commands in this repository.

## Implementation Checklist

1. Backend: update `backend/src/admin/admin.controller.ts` so `DELETE /admin/products/:id` passes the authenticated admin user ID into the product service.
2. Backend: update `backend/src/products/products.service.ts` so admin deletion soft-deletes products, records accountability, invalidates product/search/readiness state, and blocks active order dependencies.
3. Backend: update `backend/prisma/schema.prisma` to persist deletion accountability if product-level fields or an audit model are selected.
4. Frontend: update `frontend/actions/admin-server.ts` and `frontend/services/api/admin.service.ts` only as needed for the response shape and error messages.
5. Frontend: update `frontend/app/(dashboard)/admin/products/_components/AdminProductsBulkTable.tsx` with an Arabic row-level delete control and confirmation that names the product and merchant.
6. Keep shared catalog rows untouched; do not modify `backend/src/products/catalog-source-policy.ts` unless implementation uncovers a direct policy bug.

## Manual Validation Scenarios

### Scenario 1: Eligible Product Delete

1. Sign in as admin.
2. Open `/admin/products?view=all-products`.
3. Choose a merchant product with no active order references.
4. Select the row-level delete action.
5. Confirm when the product name and merchant are shown.
6. Refresh the admin products page.

Expected outcome:

- The product is no longer visible in active admin product results.
- The product is no longer visible in the merchant product list.
- The product is no longer visible on the public storefront.
- Deletion accountability is present in storage.

### Scenario 2: Cancel Confirmation

1. Start deleting a merchant product.
2. Cancel the confirmation.
3. Refresh the admin products page.

Expected outcome:

- The product remains visible and unchanged.
- No deletion accountability record is created.

### Scenario 3: Active Order Dependency

1. Identify a product referenced by an order in `draft`, `confirmed`, or `out_for_delivery`.
2. Attempt to delete that product from admin products.

Expected outcome:

- The deletion is blocked.
- The admin sees a clear Arabic failure message.
- The product remains visible and unchanged.

### Scenario 4: Catalog Isolation

1. Delete a merchant product that was copied from a ready-made catalog item.
2. Open the admin catalog items screen for the relevant catalog source.
3. Open another merchant of the same category and search catalog candidates.

Expected outcome:

- The shared catalog item remains active.
- Other merchants' products or catalog candidates are not deleted or hidden.

## Commands For The User To Run

After implementation, the user should run the relevant project checks and share output if anything fails:

```bash
cd backend && pnpm run lint:ci
cd frontend && pnpm run lint
```

If implementation includes Prisma schema changes, the user should also run the appropriate migration workflow for the target environment. The AI agent must not run those commands.
