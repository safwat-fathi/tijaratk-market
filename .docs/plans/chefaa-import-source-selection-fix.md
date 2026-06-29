# Chefaa Import Source Selection Fix

## Summary

Fix Chefaa CSV imports being processed as `talabat_csv` when headers overlap.
Explicit admin-selected import formats take precedence, and auto-detection now
recognizes Chefaa category hints before falling back to Talabat.

## Changes

- Keep using the centralized catalog source policy for Chefaa category hints.
- Resolve effective import format per row in the import service.
- Allow Chefaa CSV rows to use either `category_path` or `category`.
- Show import format in the admin import details UI.
- Clarify admin import form labels for Chefaa and replace-source imports.

## Verification

The repository instructions prohibit agents from running package-manager,
Prisma, lint, test, build, and dev-server commands. The user should run:

```bash
cd backend
pnpm prisma generate
pnpm run lint
```

