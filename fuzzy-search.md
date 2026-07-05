# Tijaratk — Arabic Fuzzy Product Search with pg_trgm

## Context for the agent

Tijaratk is a NestJS + Next.js + PostgreSQL platform (Prisma ORM, pnpm, deployed via PM2) that lets small grocery store owners in Egypt build an online catalog and take orders. Product names are primarily Arabic. Customers/merchants typing search queries often use inconsistent alef/ya/ta-marbuta forms (e.g. `آيه` vs `ايه`), and pg_trgm's raw trigram comparison treats these as different characters, causing false negatives.

Goal: implement typo-tolerant, Arabic-normalized fuzzy search over the `Product` catalog using PostgreSQL's `pg_trgm`, exposed via a NestJS search endpoint, with no new infrastructure (no Elasticsearch/Meilisearch — reuse existing Postgres).

Out of scope for this pass: cross-language (Latin) fuzzy matching, semantic/vector search, multi-tenant ranking beyond a single merchant's catalog. Leave a note in code comments that Meilisearch is the natural next step if search volume or relevance needs grow.

---

## Phase 1 — Database layer

### 1.1 Enable extension

Add a migration that enables `pg_trgm` (idempotent, safe to run in any environment):

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### 1.2 Arabic normalization function

Create a SQL function that normalizes Arabic text for comparison purposes: unify alef variants, alef maksura, ta marbuta, and strip tashkeel/tatweel. Must be `IMMUTABLE` so it can be used in a generated column and in indexes.

```sql
CREATE OR REPLACE FUNCTION arabic_normalize(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    translate(input, 'أإآٱىة', 'اااايه'),
    '[ًٌٍَُِّْـ]', '', 'g'
  );
$$;
```

Notes for the agent:

- `translate()` maps each character 1:1: أ إ آ ٱ → ا, ى → ي, ة → ه.
- The regexp strips fatha/damma/kasra/shadda/sukun/tatweel.
- Keep this function pure SQL (not plpgsql) so the query planner can inline it.
- Write this as its own migration, separate from the extension migration, so it can be revised independently later.

### 1.3 Generated column + index on `Product`

For every column you want fuzzy-searchable (start with `name`; consider `description` and `category.name` later), add a `STORED` generated column holding the normalized value, then index that column — not the raw one.

```sql
ALTER TABLE "Product"
  ADD COLUMN "nameNormalized" text
  GENERATED ALWAYS AS (arabic_normalize(name)) STORED;

CREATE INDEX product_name_trgm_idx
  ON "Product" USING gin ("nameNormalized" gin_trgm_ops);
```

If the catalog is scoped per-merchant (likely, given multi-tenant), also index the merchant/store FK so filtered fuzzy search stays fast:

```sql
CREATE INDEX product_store_id_idx ON "Product" ("storeId");
```

(Skip this if it already exists.)

### 1.4 Prisma considerations

Prisma's schema language doesn't support `GENERATED ALWAYS AS ... STORED` columns natively. Steps:

1. Run `pnpm prisma migrate dev --create-only --name add_arabic_fuzzy_search` to scaffold an empty migration file.
2. Manually write the SQL from 1.1–1.3 into that migration file (don't let Prisma try to generate it).
3. After running the migration, add the column to `schema.prisma` as a plain read-only field so Prisma's client/types know about it, but never write to it from application code:

```prisma
model Product {
  // ...existing fields...
  nameNormalized String? @map("nameNormalized")
}
```

4. Run `pnpm prisma generate` to refresh the client. Do **not** run `prisma migrate dev` again in a way that would try to "fix" this column — it's DB-managed, not Prisma-managed. Document this clearly in a code comment above the field.
5. Repeat this same DB-migration-first approach for any future searchable columns.

### 1.5 Seed/test data

Add a few rows to the dev seed script with deliberately inconsistent alef/ta-marbuta forms (e.g. one product named with `آيه`, another with `ايه`, another with `اية`) so the fuzzy match can be verified end-to-end without relying on production data.

---

## Phase 2 — NestJS backend

### 2.1 Module structure

```
src/
  search/
    search.module.ts
    search.service.ts
    search.controller.ts
    dto/
      search-products.dto.ts
    utils/
      arabic-normalize.util.ts
```

### 2.2 TypeScript mirror of the normalization function

Keep a TS equivalent of `arabic_normalize` purely so the service can log/debug/test normalized strings without a DB round trip. The DB function remains the source of truth for actual querying (query the raw `$1` param through `arabic_normalize($1)` in SQL, same as the column).

```typescript
// src/search/utils/arabic-normalize.util.ts
const ALEF_VARIANTS_MAP: Record<string, string> = {
  أ: "ا",
  إ: "ا",
  آ: "ا",
  ٱ: "ا",
  ى: "ي",
  ة: "ه",
};
const TASHKEEL_TATWEEL_REGEX = /[\u064B-\u0652\u0640]/g;

export function arabicNormalize(input: string): string {
  const mapped = input
    .split("")
    .map((ch) => ALEF_VARIANTS_MAP[ch] ?? ch)
    .join("");
  return mapped.replace(TASHKEEL_TATWEEL_REGEX, "");
}
```

Add a unit test asserting `arabicNormalize('آيه') === arabicNormalize('ايه')`.

### 2.3 DTO

```typescript
// src/search/dto/search-products.dto.ts
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";

export class SearchProductsDto {
  @IsString()
  @MinLength(1)
  query: string;

  @IsUUID()
  storeId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
```

### 2.4 Service — raw query via Prisma

Use `Prisma.sql` / `$queryRaw` the same way you handled PostGIS spatial queries — parameterized, never string-concatenated.

```typescript
// src/search/search.service.ts
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SearchProductsDto } from "./dto/search-products.dto";

interface ProductSearchRow {
  id: string;
  name: string;
  storeId: string;
  similarity: number;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchProducts(dto: SearchProductsDto): Promise<ProductSearchRow[]> {
    const { query, storeId, limit, offset } = dto;

    return this.prisma.$queryRaw<ProductSearchRow[]>(Prisma.sql`
      SELECT
        id,
        name,
        "storeId",
        similarity("nameNormalized", arabic_normalize(${query})) AS similarity
      FROM "Product"
      WHERE "storeId" = ${storeId}::uuid
        AND "nameNormalized" % arabic_normalize(${query})
      ORDER BY similarity DESC
      LIMIT ${limit}
      OFFSET ${offset};
    `);
  }
}
```

Notes:

- The `%` operator uses `pg_trgm.similarity_threshold` (session/DB-level GUC). See Phase 3 for tuning — don't hardcode a threshold in this query yet.
- Filtering by `storeId` first keeps the GIN index scan scoped; confirm with `EXPLAIN ANALYZE` that Postgres uses the trigram index and not a sequential scan once there's realistic data volume.

### 2.5 Controller

```typescript
// src/search/search.controller.ts
import { Controller, Get, Query } from "@nestjs/common";
import { SearchService } from "./search.service";
import { SearchProductsDto } from "./dto/search-products.dto";

@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get("products")
  async searchProducts(@Query() dto: SearchProductsDto) {
    const results = await this.searchService.searchProducts(dto);
    return { data: results, count: results.length };
  }
}
```

### 2.6 Module wiring

```typescript
// src/search/search.module.ts
import { Module } from "@nestjs/common";
import { SearchService } from "./search.service";
import { SearchController } from "./search.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
```

Register `SearchModule` in `AppModule`.

---

## Phase 3 — Tuning

### 3.1 Threshold for short words

Arabic product names/tokens are often short (3–6 characters), which produce few trigrams. The default `pg_trgm.similarity_threshold` of 0.3 will reject valid fuzzy matches on short strings. Two options — implement both behind a flag and A/B against real catalog data:

**Option A — lower the threshold per-session:**

```sql
SET pg_trgm.similarity_threshold = 0.15;
```

Set this via a Prisma middleware or raw query at the start of each search request's transaction. Don't set it globally at the DB level — it affects all `%` usage.

**Option B — switch to `word_similarity` / `<%`:**
More forgiving for partial/substring matches (e.g. searching "شاي" should match "كيس شاي أحمر"). Swap the `WHERE` clause:

```sql
WHERE "nameNormalized" <% arabic_normalize(${query})
ORDER BY word_similarity(arabic_normalize(${query}), "nameNormalized") DESC
```

Action item: seed ~20 realistic Arabic product names (including multi-word ones) and manually test both options with a handful of representative typo'd queries before locking in a default.

### 3.2 Multi-field ranking (future-friendly, implement if time allows)

If/when `description` or `category.name` are added as searchable generated columns, combine similarity scores with a weighted sum rather than running separate queries:

```sql
(similarity(p."nameNormalized", arabic_normalize(${query})) * 1.0
  + similarity(c."nameNormalized", arabic_normalize(${query})) * 0.5) AS score
```

---

## Phase 4 — Testing

1. **Unit**: `arabicNormalize()` util — assert all alef variants, ta marbuta, alef maksura, and tashkeel are normalized identically to the SQL function's behavior. Keep a shared fixture list of (input, expected) pairs.
2. **Integration** (against a test DB with migrations applied):
   - Seed products named `آيه`, `ايه`, `اية`. Confirm searching any one variant returns all three.
   - Confirm `storeId` scoping — a matching product in a different store is excluded.
   - Confirm empty/whitespace query is rejected by DTO validation before hitting the DB.
   - Confirm pagination (`limit`/`offset`) behaves correctly.
3. **Manual**: run `EXPLAIN ANALYZE` on the search query against a seeded dataset of a few thousand rows to confirm the GIN index is used (`Bitmap Index Scan` on `product_name_trgm_idx`), not a sequential scan.

---

## Phase 5 — Rollout checklist

- [ ] Migration: enable `pg_trgm`
- [ ] Migration: `arabic_normalize` function
- [ ] Migration: `nameNormalized` generated column + GIN index on `Product`
- [ ] `schema.prisma` updated with read-only `nameNormalized` field + comment explaining it's DB-managed
- [ ] Seed script updated with alef/ta-marbuta variant test data
- [ ] `SearchModule` (service, controller, DTO, util) implemented and registered in `AppModule`
- [ ] Threshold/`word_similarity` decision made based on real catalog test (Phase 3.1)
- [ ] Unit tests for `arabicNormalize`
- [ ] Integration tests for the search endpoint
- [ ] `EXPLAIN ANALYZE` confirms index usage
- [ ] API documented (endpoint, query params, response shape) for frontend consumption

---

## Notes / future work

- If catalog sizes per merchant grow into the tens of thousands, or relevance tuning (typo correction beyond trigram, semantic search, synonyms) becomes a priority, revisit Meilisearch — it has native Arabic segmentation and would replace this module's query logic behind the same controller/DTO interface, minimizing frontend churn.
- Consider extending `arabic_normalize` to also fold hamza-on-carrier forms (ؤ, ئ) if merchant data shows inconsistency there — not included above since it's less common in product names than the alef/ta-marbuta cases.
