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

## Testing policy

This repository does not use unit tests. Do not create, restore, or reintroduce
them.

- Do not add `*.spec.ts`, `*.test.ts`, `*.spec.tsx`, `*.test.tsx`, or
  `__tests__/` files anywhere in `backend/`, `frontend/`, or `mobile/`.
- Do not add test frameworks, runners, or helper packages (jest, vitest,
  playwright, cypress, mocha, testing-library, and similar) to any
  `package.json`.
- Do not add `test`, `test:watch`, or `coverage` scripts, jest/vitest config
  files, or CI test steps.
- The only test in this repository is the security e2e suite in
  `backend/test/security.e2e-spec.js`, run via `pnpm run test:e2e`. It is
  maintained deliberately. Do not delete it, and do not extend it into a
  general-purpose test suite. (`zone-storefront.security.e2e-spec.js` was
  removed together with the zone storefront backend module it covered.)
- Verify changes by reasoning about the code and by asking the user to exercise
  the running application. Report plainly what was verified and what was not.

## Command execution restrictions for AI agents

AI agents must not run verification, migration, package-manager, dependency, lint, typecheck, test, build, or dev-server commands in this repository.

Do not run commands including, but not limited to:

- `pnpm`, `npm`, `yarn`, or `bun`
- `prisma migrate`, `prisma generate`, `prisma db`, or `prisma studio`
- lint, typecheck, test, build, start, or dev commands
- any command that can create, remove, repair, or reinstall `node_modules`

When verification is needed, do not execute it. Tell the user exactly which command they should run themselves and wait for their output.
