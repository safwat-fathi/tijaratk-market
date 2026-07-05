# Data Model: Bulk Product Actions

## Product

Represents a merchant-owned product managed from merchant/admin dashboards.

Relevant fields:

- `id`: Product identifier.
- `tenant_id`: Owning merchant tenant.
- `name`: Display name.
- `category`: Merchant-facing category.
- `is_available`: Whether customers can order the product when active.
- `status`: Lifecycle state, either `active` or `archived`.
- `deleted_at`: Soft-delete marker; bulk actions operate only on non-deleted products.

Validation rules:

- Merchant bulk updates may only affect products where `tenant_id` matches the authenticated merchant tenant.
- Admin bulk updates require admin authorization.
- Bulk actions must not update products with `deleted_at` set.
- Category updates require a non-empty trimmed category.

State transitions:

```text
active --archive--> archived
archived --activate--> active
```

Availability changes do not change lifecycle status. Category changes do not change lifecycle status.

## Bulk Product Selection

Represents the currently selected visible product rows in the dashboard UI.

Fields:

- `ids`: Unique positive product IDs selected from the currently visible list.

Validation rules:

- Empty selections cannot submit.
- Duplicate IDs are normalized away before submission.
- Selection is cleared when products are no longer visible after filter/search/status changes.

## Bulk Product Action

Represents one submitted bulk update.

Fields:

- `ids`: Selected product IDs.
- `category`: Optional replacement category.
- `is_available`: Optional availability value.
- `status`: Optional lifecycle target, `active` or `archived`.

Validation rules:

- At least one action field is required.
- `status: archived` requires user confirmation before submission from the UI.
- Merchant requests fail if any selected product is missing or outside the authenticated tenant.
- Successful actions return an updated count.

## Archived Product View

Represents the dashboard screen state for reviewing archived products.

Fields:

- `status_filter`: Active/default or archived.
- existing search/category/availability filters where applicable.

Rules:

- Archived products are excluded from the default active product view.
- Archived products can be selected and activated in bulk.
