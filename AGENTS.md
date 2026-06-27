<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

## Catalog isolation rules

Catalog visibility is isolated by merchant store type. Do not mix catalog
sources or rely on frontend filtering to hide the wrong products.

- Grocery/supermarket tenants (`TenantCategory.grocery`) must read only the
  supermarket catalog source (`talabat_csv`).
- Pharmacy tenants (`TenantCategory.pharmacy`) must read only the pharmacy
  catalog source (`chefaa_csv`).
- Other tenant categories must not receive a ready-made catalog unless a new
  source mapping is added intentionally.
- Keep the source policy centralized in
  `backend/src/products/catalog-source-policy.ts`. Product services, imports,
  seeders, and scripts should reuse that module instead of duplicating
  string constants or category allowlists.
- A catalog import must never create or reactivate rows whose normalized
  category is invalid for that source. In particular, `chefaa_csv` must not
  contain active supermarket categories such as `أرز ومكرونة` or generic
  supermarket spillover like `أخرى`.
- If imported data has already polluted a source, run the cleanup script after
  the code fix: `pnpm run catalog:cleanup:dev` locally, or
  `pnpm run catalog:cleanup:prod` in production with the correct environment.
- Seeders for demo/ranking merchants must select products only from the
  tenant's allowed source and must not fall back to unrelated active catalog
  rows.

