# Product Import and Checkout Hardening

## Summary

Harden the completed product-import feature and the storefront checkout flow around tenant-scoped database access.

The review identified three integration gaps:

1. Storefront draft checkout commits an order inside a tenant transaction, then tries to hydrate it through an unscoped Prisma client. PostgreSQL row-level security hides the committed order and produces `Order with ID ... not found`.
2. Product-import readiness recalculation queries tenant products without a tenant-scoped transaction, which can incorrectly calculate zero products.
3. Same-name product updates can match catalog-backed products without validating their catalog source and category against the tenant's centralized catalog policy.

## Implementation

### Checkout transaction continuity

- Keep customer-address persistence on the explicit order transaction.
- Bind `DbTenantContext` when `OrdersService` creates its fallback tenant transaction.
- Hydrate a newly committed order inside a tenant-scoped transaction when no request-scoped tenant manager exists.
- Preserve storefront draft idempotency and the existing completed-order link.

### Store readiness

- Recalculate a single tenant's directory readiness using the current tenant transaction when one exists.
- Otherwise, create a tenant-scoped transaction and bind it to `DbTenantContext`.
- Allow product statistics helpers to use the supplied transaction manager.

### Product import catalog safety

- Continue updating a same-name existing product when the administrator explicitly imports it.
- Preserve its `source` and `catalog_item_id`.
- Validate catalog-backed matches through `catalog-source-policy.ts`.
- Reject rows whose linked catalog source is not allowed for the tenant, whose catalog item is inactive or missing, or whose effective category is incompatible with the source.
- Keep newly created imported products manual.

### Wizard feedback

- Show success styling only when every valid row succeeds.
- Show warning styling for partial imports.
- Show error styling when no rows are imported.
- Present known import and mapping failures in Arabic while preserving row-level details.

## Interfaces and persistence

- Existing preview and import routes remain unchanged.
- Existing summary fields remain unchanged.
- Only internal transaction-manager parameters are added.
- No database migration is required.

## Verification

- Add E2E coverage for CSV import, validation, archive/reactivation, price history, tenant permissions and isolation, catalog lineage and mismatch rejection, readiness recalculation, and storefront draft checkout idempotency.
- Cover XLSX parsing with the same endpoint contract where a reliable fixture is available.
- Repository restrictions require the user to run lint, typecheck, tests, builds, migrations, and development servers.
