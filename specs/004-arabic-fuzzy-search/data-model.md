# Data Model: Arabic Fuzzy Product Search

## Product

Represents a merchant-owned sellable item returned by product search.

### Existing Fields Used

- `id`: product identity.
- `tenant_id`: owning merchant tenant; required for isolation.
- `name`: display name entered by merchant or copied from catalog.
- `category`: optional user-facing grouping.
- `status`: active/archived lifecycle value; search defaults to active products.
- `deleted_at`: soft-delete marker; deleted products are excluded.
- `created_at`: stable fallback ordering.

### New Derived Field

- `name_normalized`: database-generated, stored normalized form of `name` for Arabic fuzzy comparison.
- Prisma schema note: this generated column is represented as `Unsupported("text")?` so Prisma Migrate can account for the database column without exposing it to Prisma Client or treating it as a normal writable field.

### Validation Rules

- `name_normalized` is derived by the database and must not be written by application create/update calls.
- Searchable products must still satisfy existing visibility rules: matching `tenant_id`, requested `status`, and `deleted_at IS NULL`.
- Search results must not include products from a different tenant.

### Relationships

- Many products belong to one `Tenant`.
- Products may originate from manual entry or copied catalog data, but search isolation is based on `tenant_id`.

## Tenant

Represents a merchant store whose catalog is searched.

### Existing Fields Used

- `id`: internal tenant identity used by authenticated merchant/admin search.
- `slug`: public storefront identity used by public product search.
- `category`: merchant category that controls ready-made catalog source policy elsewhere.

### Validation Rules

- Public product search resolves a tenant by slug before returning products.
- Authenticated product search uses the tenant from the authenticated request context.

## Search Query

Represents a user request to find products.

### Fields

- `search`: required when invoking search behavior; trimmed and normalized for cache-key stability and validation.
- `category`: optional category filter or ranking boost depending on the existing product search mode.
- `page`: optional page number; defaults to the existing product search default.
- `limit`: optional page size; capped by existing DTO limits.
- `rank_all`: authenticated merchant option that ranks all matched-scope products without similarity cutoff filtering.
- `exclude_product_ids`: authenticated merchant option to omit selected products.
- `status`: authenticated merchant option for product lifecycle filtering.

### Validation Rules

- Empty or whitespace-only search text is rejected.
- Search text is bounded by existing DTO length limits.
- Page and limit use existing numeric bounds.
- Excluded product IDs must be positive integers.

## Search Result

Represents the paginated response returned to the consuming experience.

### Fields

- `data`: list of products in relevance order.
- `meta.total`: count of matching products.
- `meta.page`: current page.
- `meta.limit`: page size.
- `meta.last_page`: final page number.
- `meta.has_next`: whether another page is available.

### Ordering Rules

- Higher normalized word/name similarity ranks first.
- Prefix and contains matches boost relevance.
- Existing stable fallback ordering by recency and product ID remains in place.

## Arabic Normalization Rule

Shared normalization behavior for matching product names and search text.

### Character Handling

- Alef variants normalize to bare alef.
- Alef maksura normalizes to ya.
- Ta marbuta normalizes to ha.
- Tashkeel and tatweel are removed.
- Existing product-search cleanup for package-size fragments, punctuation, whitespace, and leading Arabic definite article should remain aligned between database and TypeScript normalization.

### Source Of Truth

- Database normalization is authoritative for indexed matching.
- TypeScript normalization exists for request preprocessing, cache keys, fixtures, and tests.
