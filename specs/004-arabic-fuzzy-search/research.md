# Research: Arabic Fuzzy Product Search

## Decision: Enhance Existing Products Search Instead Of Adding A New Search Module

**Rationale**: `ProductsController` already exposes authenticated merchant search through `GET /products?search=...` and public storefront search through `GET /products/public/:slug?search=...`. `ProductsService` already handles tenant scoping, pagination, category filtering, cache keys, and trigram-style ranking. Enhancing these paths delivers the feature with less duplication and lower frontend churn.

**Alternatives considered**:

- Add a new `SearchModule` and `/search/products` endpoint: rejected for this pass because it would duplicate existing product search behavior and require extra frontend migration.
- Add search logic in the frontend only: rejected because catalog isolation and fuzzy matching must be enforced in backend/database behavior.

## Decision: Use Database-Managed Arabic Normalization For Indexed Product Search

**Rationale**: The current service normalizes incoming search text in TypeScript and builds a comparable SQL expression over raw product names. That can match some variants but makes indexed search harder because the comparison expression is computed at query time. A database-managed normalized product-name value keeps stored names and query terms comparable in the same normalization domain and gives PostgreSQL an indexable target.

**Alternatives considered**:

- Keep only the existing SQL expression around `LOWER(name)`: rejected because it is verbose, duplicated across queries, and does not create a stable stored value for indexing.
- Store normalized names from application code: rejected because it risks drift between writers and requires all write paths to remember to update the derived value.

## Decision: Use A Generated Stored Product Name Column

**Rationale**: Product names are already stored in PostgreSQL, and the normalized value is deterministic from `products.name`. A generated stored column avoids application write bugs and lets the database keep the value current on create/update. Prisma should represent it as `Unsupported("text")?` rather than a regular scalar field because Prisma cannot safely own the generated column shape; migrations own the actual generated-column definition, and search queries read it through raw SQL.

**Alternatives considered**:

- Expression index only: viable, but less transparent for query contracts.
- Plain nullable column maintained by service code: rejected due to higher drift risk.

## Decision: Keep `pg_trgm` As The Search Engine

**Rationale**: The repository already enables `pg_trgm` in the initial migration and uses trigram ranking in product/catalog search. The feature explicitly forbids new infrastructure for this pass. Trigram search with normalized Arabic text is sufficient for common spelling variants and short product names.

**Alternatives considered**:

- Meilisearch or Elasticsearch: rejected for this pass because they introduce new infrastructure. Add a short code comment noting that a dedicated search engine is the natural next step if search volume or relevance needs grow.
- Semantic/vector search: rejected as out of scope and not needed for spelling-variant matching.

## Decision: Preserve Existing Threshold Strategy, Then Tune With Arabic Fixtures

**Rationale**: `ProductsService` already varies strict similarity thresholds by query length and includes word-similarity and prefix/contains scoring. The first implementation should route those existing calculations through normalized stored product names, then adjust thresholds only after testing realistic Arabic fixtures.

**Alternatives considered**:

- Lower the global trigram threshold: rejected because global database settings can affect unrelated queries.
- Remove strict thresholds entirely: rejected because short Arabic queries can otherwise return noisy result sets.

## Decision: Scope Primary Persistence Changes To `products`

**Rationale**: The feature specification targets product-name search within one merchant catalog. Existing ready-made catalog search has separate source-isolation requirements and should not be broadened accidentally. Shared normalization utilities may be reused later, but the primary stored generated column and index should be on `products.name`.

**Alternatives considered**:

- Add normalized columns to `catalog_items` in the same pass: deferred because catalog source policy and import cleanup rules make catalog changes higher risk and outside the primary product-search outcome.

## Decision: Manual Verification Commands Only

**Rationale**: `AGENTS.md` forbids AI agents from running package-manager, migration, lint, typecheck, test, build, and dev-server commands in this repository. The plan and quickstart therefore document exact commands for the user to run, but the agent must not execute them.

**Alternatives considered**:

- Run local verification directly: rejected by repository instructions.
