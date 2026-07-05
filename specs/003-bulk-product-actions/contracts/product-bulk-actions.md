# Contract: Product Bulk Actions

## Merchant Bulk Update Products

`PATCH /products/bulk`

Authentication: merchant JWT with tenant context.

Request body:

```json
{
  "ids": [12, 15, 22],
  "category": "Dairy",
  "is_available": true,
  "status": "active"
}
```

Rules:

- `ids` is required and must contain at least one positive integer.
- At least one of `category`, `is_available`, or `status` is required.
- `category`, when present, must trim to a non-empty value.
- `status`, when present, must be `active` or `archived`.
- All IDs must refer to non-deleted products owned by the authenticated tenant.

Success response:

```json
{
  "success": true,
  "count": 3
}
```

Failure responses:

- `400` when the payload has no IDs, no action, invalid category, or invalid status.
- `401` when tenant/auth context is missing.
- `404` when one or more products are not found in the authenticated tenant scope.

## Merchant Dashboard Products Listing

`GET /products`

Existing behavior returns active products by default.

New query support:

```text
status=active|archived
```

Rules:

- Missing `status` defaults to `active`.
- `status=archived` returns non-deleted archived products for the authenticated tenant.
- Existing search/category pagination behavior should support status filtering when used by dashboard management flows.

## Admin Bulk Update Products

`PATCH /admin/products/bulk`

Authentication: admin authorization.

Request body:

```json
{
  "ids": [12, 15, 22],
  "category": "Dairy",
  "is_available": false,
  "status": "archived"
}
```

Rules:

- Same action validation as merchant bulk update.
- Admin path may resolve products across tenants, preserving the existing admin capability.
- Non-deleted product requirement still applies.

Success response:

```json
{
  "success": true,
  "count": 3
}
```

## Frontend Action Contract

Merchant action:

```ts
bulkUpdateProductsAction(payload: {
  ids: number[];
  category?: string;
  is_available?: boolean;
  status?: "active" | "archived";
}): Promise<{
  success: boolean;
  data?: { success: boolean; count: number };
  message?: string;
}>;
```

Admin action keeps the existing matching shape.
