# Admin Merchants Filters Fix

## Summary
Improve the admin merchants screen filters so search and pagination behave consistently and the available filter options match the tenant categories/statuses supported by the system.

## Scope
- Keep active filters when navigating pagination.
- Normalize merchant search input consistently between suggestions and submitted searches.
- Expand backend tenant search beyond name/phone to include slug, numeric id, and common Egyptian phone variants.
- Ignore invalid category/status/number filters instead of passing raw query values into Prisma filters.
- Add missing tenant category/status choices to the filter UI.
- Add a reset control to clear all merchant filters.

## Verification
Agents must not run lint/typecheck/test/build commands in this repository. User should run:
- `pnpm lint`
- `pnpm --filter frontend typecheck`
- `pnpm --filter backend test`

Manual check:
- Open `/admin/merchants`.
- Search by merchant name, slug, id, and phone formats like `010...` and `+2010...`.
- Apply category/status/area filters, move to the next page, and confirm filters stay active.
- Clear filters and confirm the default merchants list returns.
