# Data Model: Delete Merchant Items From Admin

## Product

Merchant-owned product entry stored in `products`.

### Relevant Existing Fields

- `id`: Unique product identifier.
- `tenant_id`: Owning merchant tenant.
- `name`: Product name used in admin and merchant lists.
- `source`: Product source, such as manual or catalog-derived tenant product.
- `status`: Existing lifecycle value, currently `active` or `archived`.
- `deleted_at`: Soft-delete timestamp. Active product queries must exclude rows where this is set.
- `category`, `current_price`, `is_available`, `price_needs_review`: Existing product management fields.

### New Accountability Data

### New Accountability Data

Implementation will use product-level fields to track accountability:

- `deleted_by_id`: Admin user (Int) who deleted the product.
- `deleted_reason`: Optional future-proof text field if the UI later captures a reason.

The implementation supports the spec requirement that successful deletions identify who deleted the item and when by returning this data to the admin UI.

### State Transitions

```text
active or archived + deleted_at null
  └── admin confirms eligible delete
      └── deleted_at set, accountability recorded
```

Deleted products do not return to active lists through this feature. Restore is out of scope.

### Validation Rules

- Product must exist with `deleted_at` unset before deletion.
- Product must be merchant-owned; shared `CatalogItem` rows are not valid targets.
- Product deletion must run in the product tenant context to respect tenant/RLS behavior.
- Product must not be referenced by active order dependencies.
- Repeated delete attempts against already-deleted products must be idempotent from a user perspective: no duplicate side effects, clear "already deleted/not found" handling.

## Admin User

Authenticated admin actor from the admin JWT strategy.

### Relevant Fields

- `userId`: Admin identifier returned by admin auth validation.
- `phone`: Admin phone number.
- `role`: Must be `admin`.

### Relationships

- One admin user may delete many merchant products.
- A deletion record or product-level deletion field references the admin user.

## Operational Dependency

An active workflow that prevents deletion.

### Relevant References

- `OrderItem.product_id`
- `OrderItem.replaced_by_product_id`
- `OrderItem.pending_replacement_product_id`
- Related `Order.status`

### Blocking Statuses

- `draft`
- `confirmed`
- `out_for_delivery`

### Non-Blocking Historical Statuses

- `completed`
- `cancelled`
- `rejected_by_customer`

Historical records remain readable through order item snapshots and nullable product relations.

## Deletion Result

Response shown to the admin after attempting deletion.

### Fields

- `success`: Boolean success indicator.
- `productId`: Deleted product identifier on success.
- `tenantId`: Owning merchant identifier on success.
- `deletedAt`: Deletion timestamp on success.
- `message`: User-facing failure or success detail when appropriate.

### Validation Rules

- Success response is returned only after active views will exclude the product.
- Blocked responses must explain whether the item is active in orders, unauthorized, missing, or already deleted.
