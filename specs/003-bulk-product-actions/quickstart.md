# Quickstart: Bulk Product Actions Validation

## Prerequisites

- Merchant account with at least three active products.
- At least one product category option.
- Admin account with access to the admin products dashboard.
- User runs verification commands manually; agents must not run lint, typecheck, test, build, dev-server, package-manager, or migration commands in this repository.

## Merchant Scenarios

1. Sign in as a merchant and open `/merchant/products/new`.
2. In "منتجاتك", select two visible active products.
3. Mark them unavailable.
   - Expected: selected products show unavailable state and selection clears.
4. Select visible products again and change their category.
   - Expected: selected products show the new category and the category option remains available.
5. Select visible products and choose archive.
   - Expected: a confirmation is shown.
6. Cancel archive.
   - Expected: no selected products move out of the active list.
7. Repeat archive and confirm.
   - Expected: products leave the active view.
8. Switch to the archived view/filter.
   - Expected: archived products are listed.
9. Select archived products and activate them.
   - Expected: products return to the active view.

## Merchant Security Scenario

1. Submit a merchant bulk update request containing one product ID owned by another tenant.
2. Expected: request fails and no outside-tenant product is updated.

## Admin Scenarios

1. Sign in as admin and open `/admin/products`.
2. Select a merchant and load products.
3. Select visible products and apply availability, category, archive, and activate actions.
4. Expected: admin actions behave the same as merchant actions, with archived products reachable from the admin product management flow.

## Bulk Performance Scenario

1. Sign in as a merchant or admin with at least 10 visible products.
2. Select 10 visible products.
3. Apply one availability bulk action.
4. Expected: the action completes and selected rows reflect the update in under 30 seconds.

## Suggested User-Run Verification

After implementation, the user should run the repository's normal checks manually:

```sh
cd backend && pnpm run lint:ci
cd backend && pnpm run test:e2e
cd frontend && pnpm run lint
cd frontend && pnpm run type-check
```
