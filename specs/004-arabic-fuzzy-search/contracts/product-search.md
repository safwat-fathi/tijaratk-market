# Contract: Product Search

This feature preserves existing product search surfaces and improves their matching behavior.

## Authenticated Merchant Product Search

`GET /products`

### Authentication

Requires the existing merchant JWT guard. Tenant identity comes from the authenticated request context.

### Query Parameters

| Name | Type | Required | Rules |
|------|------|----------|-------|
| `search` | string | Yes for search behavior | Trimmed text, max 120 characters, must not be empty after trimming |
| `category` | string | No | Max 64 characters |
| `page` | number | No | Integer, minimum 1, defaults to 1 |
| `limit` | number | No | Integer, minimum 1, maximum 50, defaults to 20 |
| `rank_all` | boolean | No | Existing merchant ranking mode |
| `exclude_product_ids` | string | No | Comma-separated positive product IDs |
| `status` | enum | No | Existing product lifecycle filter |

### Response

```json
{
  "data": [
    {
      "id": 123,
      "tenant_id": 45,
      "name": "آيه",
      "category": "أخرى",
      "status": "active",
      "current_price": "10.00",
      "is_available": true,
      "search_rank": 0.95,
      "word_sim": 0.9,
      "name_similarity": 0.85,
      "contains_score": 1
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "limit": 20,
    "last_page": 1,
    "has_next": false
  }
}
```

### Required Behavior

- Results include only products with the authenticated tenant ID.
- Products from other tenants are never returned, even if they are stronger text matches.
- Arabic spelling variants match through normalized comparison.
- Exact or near-exact normalized matches rank before weaker matches.
- Relevance fields may be returned with search results and are used for ordering.
- Empty or whitespace-only `search` values return the existing validation error behavior rather than product data.

## Public Storefront Product Search

`GET /products/public/{slug}`

### Authentication

Public endpoint. Tenant identity is resolved from `{slug}`.

### Path Parameters

| Name | Type | Required | Rules |
|------|------|----------|-------|
| `slug` | string | Yes | Existing public tenant slug |

### Query Parameters

| Name | Type | Required | Rules |
|------|------|----------|-------|
| `search` | string | Yes for search behavior | Trimmed text, max 120 characters, must not be empty after trimming |
| `category` | string | No | Max 64 characters |
| `page` | number | No | Integer, minimum 1, defaults to 1 |
| `limit` | number | No | Integer, minimum 1, maximum 50, defaults to 20 |

### Response

Same envelope shape as authenticated merchant product search.

### Required Behavior

- Results include only active, non-deleted products for the tenant resolved by slug.
- Arabic spelling variants match through normalized comparison.
- Category filtering continues to narrow results when provided.
- Relevance fields may be returned with search results and are used for ordering.
- Pagination metadata remains stable across pages for the same query.

## Non-Goals

- No new public `/search/products` endpoint in this pass.
- No cross-language matching.
- No semantic/vector search.
- No changes to ready-made catalog source mapping.
