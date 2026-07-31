# Backend Review — Findings and Remediation Plan

Reviewed: 2026-07-30 · Scope: `backend/` (NestJS 11, Prisma 7, PostgreSQL, PM2 cluster)

Review criteria: request-path performance, N+1 and query fan-out, transaction
scope and connection-pool safety, caching correctness, clustering safety,
cognitive complexity / god classes, duplication, dead code, index coverage,
raw-SQL robustness, and API-contract consistency.

Nothing here is a security finding; the tenant RLS design itself is sound
(Postgres RLS + `set_config('app.tenant_id')` + `AsyncLocalStorage`-bound
transaction client). The issues are about how that design behaves under load.

| # | Severity | Finding | Primary file |
|---|---|---|---|
| 1 | P0 | Every tenant-scoped request runs inside one Prisma interactive transaction, with outbound Twilio calls inside it | `common/interceptors/tenant-rls.interceptor.ts` |
| 2 | P0 | Cache TTLs are passed in seconds to a millisecond API — caching is effectively disabled | `products/products.service.ts`, `merchant-dashboard/merchant-dashboard.service.ts`, `app.module.ts` |
| 3 | P0 | Admin list endpoints open one transaction per tenant, concurrently | `admin/admin.service.ts` |
| 23 | ✅ Done | **Zone storefront retired from the backend** (Option B). Module, seeders, dead deep links and WhatsApp templates removed; Prisma models and enums retained | `zone-storefronts/` (deleted) |
| 4 | ~~P1~~ Void | Zone listings recompute readiness per zone — **dissolved by finding 23**; the code no longer exists | ~~`zone-storefronts.service.ts`~~ |
| 5 | P1 | Public directory category page fetches unbounded rows and paginates in memory | `stores-directory/stores-directory.service.ts` |
| 6 | P1 | Merchant dashboard loads every order + order item for the period into memory | `merchant-dashboard/merchant-dashboard.service.ts` |
| 7 | P1 | In-memory cache and rate limiter are per-process under a 3-instance PM2 cluster | `app.module.ts`, `ecosystem.config.js` |
| 8 | P1 | Legacy CSV import does per-row queries and duplicates `ProductImportService` | `products/products.service.ts` |
| 9 | P2 | Missing composite indexes for the hottest order queries | `prisma/schema.prisma` |
| 10 | P2 | Raw-SQL count queries reuse parameters via fragile positional slicing | `products/products.service.ts` |
| 11 | P2 | Ten near-identical "get the tenant-bound Prisma client" helpers, none validating tenant identity | across services |
| 12 | P2 | God classes and very high cognitive complexity in the three largest services | `products/`, `orders/`, `admin/` |
| 13 | P2 | Order creation makes four avoidable DB round-trips | `orders/orders.service.ts` |
| 14 | P2 | `CacheService` (154 lines) is entirely unused dead code | `common/cache.service.ts` |
| 15 | P2 | Duplicate-name check runs a non-sargable full scan on every product write | `products/products.service.ts` |
| 16 | P2 | Catalog taxonomy lookup re-queried 23 call sites deep, uncached | `products/catalog-source-policy.ts` |
| 17 | P3 | Three different pagination field names across the public API | across services |
| 18 | P3 | Any object with a `code` property is reported as a database error | `common/filters/all-exception.filter.ts` |
| 19 | P3 | Three near-duplicate raw-SQL search builders | `products/products.service.ts` |
| 20 | P3 | Inconsistent `deleted_at` filtering on order reads | `orders/orders.service.ts` |
| 21 | P3 | Lint rules that would catch classes of these bugs are disabled or downgraded | `eslint.config.mjs` |
| 22 | P3 | Verify the port env var matches the deployment | `main.ts`, `ecosystem.config.js` |

---

## P0 — Fix before the next traffic increase

### 1. The entire request runs inside one Prisma interactive transaction, and external HTTP calls happen inside it

**Where:** [`tenant-rls.interceptor.ts:52`](../src/common/interceptors/tenant-rls.interceptor.ts) —
`runWithTenantContext` wraps `firstValueFrom(next.handle())` in
`this.prisma.$transaction(...)`. Because it is registered first in
`app.useGlobalInterceptors` ([`main.ts:148`](../src/main.ts)), that transaction
encloses the whole controller method for every path matching `requiresTenantRls`:
`/products`, `/orders`, `/customers`, `/availability-requests`, `/dashboard`,
`/activity-logs`.

**Why it must be addressed:**

- `PrismaService` sets no `transactionOptions`, so Prisma's defaults apply:
  `timeout: 5000ms`, `maxWait: 2000ms`. Any request slower than 5 seconds fails
  at commit with `P2028 Transaction already closed` — and **rolls back work the
  user believes succeeded**.
- Order creation calls Twilio *inside* that transaction.
  [`orders.service.ts:574`](../src/orders/orders.service.ts) runs
  `notifyOrderCreated` → `OrderWhatsappService.notifySellerNewOrder` →
  `WhatsappService.sendTemplatedMessage` → `client.messages.create(...)`. The
  Twilio Node client's default timeout is 30s. The comment at
  `orders.service.ts:586` ("after an external transaction commits") describes an
  intent the code does not implement: `withTenantManager`
  ([`orders.service.ts:2844`](../src/orders/orders.service.ts)) reuses the
  ambient request transaction, so nothing has committed yet at line 574.
  A slow or hanging Twilio call therefore loses the order.
- A Postgres connection is pinned for the full request duration, including
  Twilio latency, `sharp` image processing, and CSV parsing. `PrismaPg` is
  constructed with only a `connectionString`, so `pg`'s default pool max of 10
  applies. Ten concurrent slow requests per process exhaust the pool, and the
  eleventh fails `maxWait` after 2s.
- Long-lived transactions hold `xmin` back, blocking autovacuum and bloating
  `orders`/`products`.

**Resolution steps:**

1. Set explicit global transaction options in `PrismaService`'s `super({...})`
   call — `transactionOptions: { timeout: 15_000, maxWait: 5_000 }` — as an
   immediate stopgap, and configure the pool explicitly (`new PrismaPg({
   connectionString, max: Number(process.env.DB_POOL_MAX ?? 20) })`), sized
   against Postgres `max_connections` divided by 3 PM2 instances.
2. Move every outbound side effect out of the request transaction. The codebase
   already has the right pattern in three places — the transactional outbox
   (`meta_conversion_outbox`, `ga4_event_outbox`, `push_notification_outbox`)
   with `FOR UPDATE SKIP LOCKED` claim workers. Add a WhatsApp/Twilio outbox
   table and enqueue from `notifyOrderCreated` / `notifyCustomerStatusChange`
   instead of calling Twilio inline. Reuse
   [`push-notifications.worker.ts`](../src/push-notifications/push-notifications.worker.ts)
   as the template — it already handles lock recovery, bounded batches,
   non-overlapping ticks, and terminal cleanup.
3. Narrow the interceptor's transaction to cover only the DB work. The cleanest
   version: have `TenantRlsInterceptor` resolve and store `tenantId` in
   `DbTenantContext` **without** opening a transaction, and let each service
   helper open a short transaction around its own unit of work (the
   `withTenantManager` fallback path at `orders.service.ts:2853` already does
   exactly this). This is the structural fix; steps 1–2 are what buy time for it.
4. Audit remaining in-transaction I/O: `common/services/image-processor.service.ts`
   (`sharp().toFile`), `imports/services/image-downloader.service.ts` (10s fetch),
   and `products.service.ts:3114` (CSV read of the whole file).

**Verification:** with `SLOW_QUERY_MS` set, place an order against a Twilio
account configured with an unreachable endpoint. Before the fix the order
rolls back with `P2028`; after, the order commits and the notification lands in
the outbox for the worker to retry.

---

### 2. Cache TTLs are passed in seconds to a millisecond API — the caching layer never actually caches

**Where:**

- [`app.module.ts:38`](../src/app.module.ts) — `CacheModule.register({ isGlobal: true, ttl: 3600 })`, commented "Default TTL is 1 hour".
- [`products.service.ts:51`](../src/products/products.service.ts) — `const PRODUCT_SEARCH_CACHE_TTL_SECONDS = 60;` passed as the third argument to `cacheManager.set` at lines 1172, 1241, 1322, 1624.
- [`merchant-dashboard.service.ts:46`](../src/merchant-dashboard/merchant-dashboard.service.ts) — `const DASHBOARD_CACHE_TTL_SECONDS = 30;` passed at line 327.

**Why it must be addressed:** `@nestjs/cache-manager@3.1.0` requires
`cache-manager >= 6`; the installed version is `cache-manager@7.2.8`, where
**`ttl` is milliseconds**. The real TTLs are therefore:

| Intended | Actual |
|---|---|
| Global default 1 hour | 3.6 seconds |
| Product/catalog search 60s | **60 milliseconds** |
| Merchant dashboard 30s | **30 milliseconds** |

Every cache described as a performance optimisation is a no-op, so the expensive
paths behind them — the pg_trgm similarity search in
`searchWithinTenantProducts`, `searchWithinPublicProducts`, and the 10-query
dashboard aggregate — run on *every* request. The cache-version keys
(`bumpTenantSearchCacheVersion`, `bumpPublicProductCacheVersion`,
`bumpCatalogSearchCacheVersion`, `bumpDashboardCacheVersion`) are written with no
TTL, so they inherit the 3.6s default: the version rotates every few seconds and
invalidates all derived keys regardless.

Note that `src/common/cache.service.ts` already documents the correct unit
("TTL values in milliseconds") — that file is just never imported (see finding 14).

**Resolution steps:**

1. Rename the constants to `_MS` and convert:
   `PRODUCT_SEARCH_CACHE_TTL_MS = 60_000`, `DASHBOARD_CACHE_TTL_MS = 30_000`,
   and `CacheModule.register({ ttl: 3_600_000 })`.
2. Give the version keys an explicit TTL longer than any data key that depends
   on them (e.g. 24h), so a version never expires before the entries it guards.
3. Grep for every `cacheManager.set(` call and confirm the third argument is in
   milliseconds. There are 12.
4. Add one comment at the `CacheModule.register` site stating the unit, so the
   next reader does not reintroduce this.

**Verification:** hit `GET /dashboard/measurements` twice within a second with
query logging on. Today both requests emit the full 10-query batch; after the
fix the second is served from cache with zero queries.

---

### 3. Admin list endpoints open one interactive transaction per tenant, all concurrently

**Where:** [`admin.service.ts`](../src/admin/admin.service.ts) —
`runWithTenantRls` (line 240) opens `prisma.$transaction` per call, and it is
invoked inside `Promise.all(tenants.map(...))` at:

- line 486 — `getTenants()`: 3 counts + a cancellation-policy summary per tenant
- line 2382 — `getProducts()`: `tenant.findMany()` **unpaginated**, then `product.findMany` + `product.count` per tenant
- line 2506 — `getOrders()`: same shape over orders, with a ~30-field `select`
- line 381 — dashboard stats

**Why it must be addressed:** with *T* tenants this is *T* concurrent
interactive transactions and 2–4*T* queries per admin page view. Against a `pg`
pool of 10 (finding 1), any admin listing with more than ~10 tenants
self-inflicts `maxWait` timeouts, and it degrades linearly with tenant growth —
the one metric this platform is trying to grow. `getProducts` and `getOrders`
also fetch `pagination.prefetch = page * limit` rows *per tenant* before merging
and slicing in memory, so page 5 at limit 100 pulls 500 rows × *T* tenants
across the wire. `getProducts` compounds it with `include: { tenant: true }`,
hydrating the full tenant row onto every product.

The merge-then-slice arithmetic is correct; the cost model is the problem.

**Resolution steps:**

1. These are admin-only, cross-tenant reads. Give them a single query that
   bypasses per-tenant RLS instead of looping. Two viable routes:
   - **Preferred:** run one transaction, `set_config('app.tenant_id', ...)` once
     to a bypass value (or use a dedicated admin DB role whose RLS policy allows
     cross-tenant reads), and issue one `product.findMany({ where: { tenant_id: { in: tenantIds } }, skip, take, orderBy })`.
     Confirm the RLS policy in `prisma/migrations` supports an admin role before
     choosing this.
   - **Otherwise:** keep RLS but replace *T* transactions with one — open a
     single `$transaction`, then iterate tenants sequentially inside it,
     re-issuing `set_config` per tenant. Slower per request but bounded to one
     connection.
2. Paginate `tenant.findMany` at `admin.service.ts:2372` and `:2437` — currently
   unbounded.
3. Replace `include: { tenant: true }` at line 2394 with
   `select: { id: true, name: true, slug: true }`, matching what `getOrders`
   already does correctly at line 2519.
4. For `getTenants`, replace the four per-tenant queries with three `groupBy`
   calls over `{ tenant_id: { in: tenantIds } }` plus one batched cancellation
   policy read, then join in memory.

**Verification:** seed ~50 tenants, call `GET /admin/products?page=1&limit=20`,
and count queries in the Prisma query log. Expect a drop from ~100 to ~3.

---

## P1 — Fix in the next cycle

### 23. Zone storefront is deleted from the frontend but still live in the backend

> **Status: RESOLVED via Option B (2026-07-31).** Option A was applied and
> verified in production first; the module has now been retired. See
> "What was done" at the end of this section. Finding 4 is void as a result.

**Origin.** Handed over from the frontend removal in commit
[`07b429e`](https://github.com/) *"feat(frontend)!: remove the zone storefront feature"*,
whose message closes with:

> Backend follow-up, unchanged from before: `ZONE_STOREFRONTS_ENABLED=true` in
> `backend/.env.production`, and the notification services still generate
> merchant deep links to `/merchant/assigned-orders/{id}`. Those already 404'd,
> so it's not a regression — but the flag should go to `false` or the backend
> module be retired. I noted it in commit 2's message so it's findable from the
> history.

**Verified in the current tree:**

- [`.env.production:25`](../.env.production) — `ZONE_STOREFRONTS_ENABLED=true`.
  Every `isZoneStorefrontEnabled()` gate is therefore open in production.
- [`zone-storefront-notifications.service.ts:65`](../src/zone-storefronts/zone-storefront-notifications.service.ts) —
  `assignmentUrl: \`${clientUrl}/merchant/assigned-orders/${payload.dispatchId}\``
- [`push-notifications.service.ts:567`](../src/push-notifications/push-notifications.service.ts) —
  `url = \`/merchant/assigned-orders/${event.dispatch_id}\``
- The frontend route those two point at is gone — `frontend/app/(public)/` now
  holds only `[slug]`, `guide`, `install`, `track-order`, `track-orders`, and no
  file in `frontend/` references `assigned-orders` or `zone-storefront` any more.
- [`zone-storefronts.controller.ts:367`](../src/zone-storefronts/zone-storefronts.controller.ts) —
  `@Controller('assigned-orders')` is still mounted and serving.
- `src/zone-storefronts/` is **4,558 lines** across 11 files, including a
  polling worker (`zone-catalog-reconciliation.worker.ts`).
- 6 Prisma models: `ZoneStorefront`, `ZoneStorefrontMerchant`, `OrderDispatch`,
  `OrderDispatchAssignment`, `OrderDispatchQuoteLine`, `ZoneCatalogReconciliation`.
- 14 files outside the module reference it, including `orders.service.ts`,
  `customers.service.ts`, `admin.service.ts`, `stores-directory.service.ts`,
  `imports.service.ts`, and `admin-managed-access.service.ts`.

**Why it must be addressed:** the frontend author is right that the dead links
are not a regression — they 404'd before the removal too, because the frontend
flag was never set in production. But leaving it as-is has active costs:

- **Push notifications are being sent to merchants that cannot land anywhere.**
  Every dispatch assignment enqueues a `push_notification_outbox` row, the
  worker delivers it, the merchant taps it, and gets a 404. That is a live,
  user-facing dead end, and it burns web-push quota and worker cycles.
- **It is the single largest block of possibly-dead code in the backend** — 4,558
  lines, plus a background worker polling on an interval in each of the 3 PM2
  instances. Two of this review's other findings (4, and part of 12's
  `createPublicOrder`) are optimisation work on that code. Optimising a module
  you are about to delete is wasted effort; deleting it resolves finding 4
  outright and shrinks findings 11 and 12.
- **The flag is load-bearing in unrelated modules.** `admin-managed-access.service.ts`
  branches on `isZoneStorefrontEnabled()` in four places (lines 195, 618, 958),
  and `orders.service.ts:638` uses it to decide whether to query assigned-order
  counts for the merchant inbox. Flipping the flag to `false` changes behaviour
  in the admin-managed permission path too — it is not an isolated toggle.

**Resolution steps — pick one, they are genuinely different commitments:**

**Option A — turn the flag off (minutes, reversible).** Set
`ZONE_STOREFRONTS_ENABLED=false` in `.env.production`. Stops the dead deep links
and idles the reconciliation worker. Before doing it, trace the four
`admin-managed-access.service.ts` branches and `orders.service.ts:638` to confirm
the `false` path is the intended behaviour rather than an untested branch — that
is the whole risk of this option. Leaves 4,558 lines of unreachable code and 6
tables in place. **This is the right immediate move regardless of which option
you ultimately take**, because it stops the merchant-facing 404s today.

**Option B — retire the module (the real fix).** After A is verified in
production for a release or two:

1. Delete `src/zone-storefronts/`, unregister `ZoneStorefrontsModule` from
   `app.module.ts`, and remove the two seeders plus
   `common/scripts/seed-zone-storefront-fixture.ts` and the `seed:zone:dev`
   script in `package.json`.
2. Unwind the 14 cross-module references. Follow the frontend commit's stated
   approach — unwind call sites rather than stub them. The known ones:
   `orders.service.ts:638` (`getInboxSummary` assigned counts),
   `order-whatsapp.service.ts`, `customers.service.ts`, `admin.service.ts`,
   `stores-directory.service.ts` (`operated_zone_storefront: { is: null }`
   filters, which become unnecessary once no tenant operates a zone),
   `imports.service.ts`, and the four `admin-managed-access.service.ts` branches.
3. Remove the two deep-link builders and the `dispatch_id` branch in
   `push-notifications.service.ts:567`.
4. **Keep the enum members.** The frontend commit deliberately retained
   `OrderSource.ZONE_STOREFRONT` and the `zone_storefront` / `order_dispatch`
   members of `ActivityEntityType` because they describe rows that already exist
   in the database. The same reasoning applies here — keep
   `OrderSource.zone_storefront` in the Prisma enum and the corresponding
   `activity-log/constants/` entries, or historical orders and activity rows
   stop deserialising.
5. Drop the 6 tables **last and separately**, only once you have confirmed no
   historical order needs them. `OrderDispatchQuoteLine` has an FK to
   `OrderItem`, and `StorefrontCartDraft`/`Order` relations touch dispatch — a
   migration that drops these needs its own review. Retaining the tables
   indefinitely is a perfectly acceptable outcome; the code is the expensive part.

**Option C — keep the feature.** Then the frontend surface has to be rebuilt,
and findings 4 and 12 become real work rather than deletion candidates. Nothing
in the current tree suggests this is the intent, but it is the choice that makes
finding 4 worth doing.

---

### What was done (Option B, 2026-07-31)

**Deleted:** `src/zone-storefronts/` (11 files), both zone seeders,
`common/scripts/seed-zone-storefront-fixture.ts`, the `seed:zone:dev` script,
and `test/zone-storefront.security.e2e-spec.js`.

**Unwound:** `ZoneStorefrontsModule` registration; `assigned_counts` and the
dispatch `groupBy` in `getInboxSummary`; both dispatch cancellation cascades in
`orders.service.ts`; the `zone_storefront` / `reorder_url` / `fulfilled_by`
fields and their query `include`s in order tracking and customer order history;
the accepted-assignment lookup in `order-whatsapp.service.ts`; both merchant
deep-link builders and the two zone enqueue methods in
`push-notifications.service.ts`; all 12 `enqueueZoneCatalogReconciliation` call
sites in `admin.service.ts` and `imports.service.ts`; the four
`isZoneStorefrontEnabled()` branches in `admin-managed-access.service.ts`; the
three `dispatches.*` managed permissions; the five zone WhatsApp templates; and
the zone env vars in `env.d.ts` and all three `.env*` files.

**Deliberately retained:**

- **Prisma models and tables.** All 6 remain. Dropping them is a separate,
  separately-reviewed migration — `OrderDispatchQuoteLine` has an FK to
  `OrderItem`, and historical orders still reference dispatch rows.
- **Enum members.** `OrderSource.zone_storefront`,
  `PushNotificationEventType.zone_*`, and the `zone_storefront` /
  `order_dispatch` `ActivityEntityTypes` and `ActivityActions` entries all
  describe rows that already exist, exactly as the frontend commit reasoned.
- **The `operated_zone_storefront: { is: null }` filters** in
  `stores-directory`, `products`, `admin`, `admin-managed`, and `tenants`, plus
  the three `zoneStorefront.findUnique` guards in `orders` / `products` /
  `storefront-cart-drafts`. **Do not remove these yet.** Operator tenant rows
  still exist; without the filters those tenants become publicly listable and
  directly orderable. They come out with the table-drop migration, not before.
- **Residual outbox rows.** `resolveDeliveryTargets` returns `[]` for the two
  zone event types, so the worker drains any pending rows instead of delivering
  links to removed routes.

**Behaviour changes to be aware of:**

- Legacy zone orders on the tracking page now show the fulfilling merchant's
  name instead of the zone's, and no longer expose `fulfilled_by`. The frontend
  types both fields as optional and already suppressed the zone reorder link.
- Cancelling a legacy zone order now records a merchant cancellation-policy
  event. Previously the dispatch branch skipped that call.
- `dispatches.*` values persisted in `admin_tenant_access.permissions` JSONB are
  now silently dropped by `normalizeAdminManagedPermissions`, which is the
  intended cleanup.

**`AGENTS.md` was updated.** It named
`zone-storefront.security.e2e-spec.js` as a deliberately-maintained suite that
must not be deleted. That suite covered only the retired module, so it was
removed and the policy text now names `security.e2e-spec.js` alone. The two zone
assertions inside the *surviving* suite were rewritten rather than deleted: they
now assert that zone events resolve to zero delivery targets, and the worker
retry/backoff test was rebuilt on `enqueueMerchantOrder`.

**Still open:** dropping the 6 tables, and removing the retained
`operated_zone_storefront` filters, once the operator tenant rows are dealt with.

---

### 4. ~~Zone listings recompute readiness per zone~~ (VOID)

> **Dissolved by finding 23.** The module was retired on 2026-07-31 and this
> code no longer exists. Retained below only as a record of what was removed.


**Where:** [`zone-storefronts.service.ts:380`](../src/zone-storefronts/zone-storefronts.service.ts)
(admin listing) and `:853` (**public** listing) both call
`calculateReadiness(zone)` inside `Promise.all(zones.map(...))`.
`calculateReadiness` (line 1116) issues `findActiveCatalogCategoryNamesForSource`,
`catalogItem.count`, `zoneStorefrontMerchant.count`, **and** a
`runInOperatorTenant` transaction for `product.count`. The admin path adds
`getMerchantEligibilityMap` per zone.

**Why it must be addressed:** ~4 queries + 1 transaction per zone, on a public
uncached endpoint, with no pagination on the zone query (line 812). Same
pool-exhaustion mechanism as finding 3, but exposed to anonymous traffic.

**Resolution steps:**

1. Hoist `findActiveCatalogCategoryNamesForSource` out of the per-zone loop —
   it is keyed only by `catalogSource`, and all zones in a listing share at most
   two sources. Resolve once per source, pass the array in.
2. Batch the three counts across zones: one `catalogItem.groupBy` by source, one
   `product.groupBy` by `tenant_id` over all operator tenant ids, one
   `zoneStorefrontMerchant.groupBy` by `zone_storefront_id`. Change
   `calculateReadiness` to take precomputed maps so the single-zone callers
   (lines 434, 510) keep working with a one-entry map.
3. Cache the public zone list — the readiness inputs change on merchant/catalog
   writes, not per request. TTL of 60s (in **milliseconds**, per finding 2) is
   ample.

---

### 5. Public directory category page fetches unbounded rows and paginates in memory

**Where:** [`stores-directory.service.ts:223`](../src/stores-directory/stores-directory.service.ts)
`getCategoryPage` (206 lines). Line 305 `tenantDeliveryArea.findMany` has no
`take`/`skip`; the result is deduped, scored, sorted, and only then sliced at
line 371 (`rankedRows.slice(...)`).

**Why it must be addressed:** this is the highest-traffic public endpoint. Cost
grows with total listed stores in an area, not with page size, and the ranking
(`calculateReadinessScore`, `getBucketPriority`, `getDailyRotationScore`) runs
for every store on every request — with no caching anywhere in the file.

**Resolution steps:**

1. Add a short-TTL cache keyed on
   `(areaSlug, categorySlug, deliveryAreaSlug, search, openNow, page, limit, rankingDate)`.
   `rankingDate` already exists (line 313) and rotates daily, so it is a natural
   cache-version component. 30–60s is enough to absorb burst traffic.
2. Precompute the ranking rather than deriving it per request. `readinessScore`,
   `bucketPriority`, and the store's open-now window are functions of tenant
   state that changes on writes; persist them on `tenant_directory_profiles`
   (there is already a `recalculateTenantReadiness` at line 821 to hook into)
   and let Postgres do `ORDER BY ... LIMIT/OFFSET`.
3. Until step 2 lands, cap the `findMany` with a defensive `take` (e.g. 500) and
   log when the cap is hit, so the unbounded case becomes visible.

---

### 6. Merchant dashboard loads every order and order item for the period into memory

**Where:** [`merchant-dashboard.service.ts:137`](../src/merchant-dashboard/merchant-dashboard.service.ts)
`getMeasurements` (197 lines). Three of the ten parallel queries overlap:

- `ordersForSource` — every order in range
- `completedOrdersWithItems` — the completed subset, **plus all `order_items`**
- `activeCustomerIds` — `distinct customer_id` over the completed subset

**Why it must be addressed:** `completedOrdersWithItems` ⊂ `ordersForSource`, and
`activeCustomerIds` is derivable from it — so two of the three round-trips are
redundant. More importantly, none is bounded: a busy merchant on the `month`
period pulls every order plus every line item into Node just to compute
`buildTopSellingProducts` and `buildOrdersBySource`, which are group-by
aggregates. Memory scales with merchant success, and `max_memory_restart: "500M"`
in `ecosystem.config.js` turns that into restarts.

**Resolution steps:**

1. Replace `buildOrdersBySource` with `order.groupBy({ by: ['order_source', 'status'], _count, _sum: { total } })`.
2. Replace `buildTopSellingProducts` with an aggregate over `order_items` joined
   to orders in range — a `$queryRaw` with `GROUP BY name_snapshot ORDER BY SUM(...) DESC LIMIT 10`
   is the direct translation, since `quantity` is a string column needing a cast.
3. Derive `activeCustomers` from the grouped result and delete the
   `activeCustomerIds` query.
4. Keep the shape of the returned `measurements` object identical so the
   frontend needs no change.

Expected: 10 queries → ~6, and constant memory regardless of order volume.
This also finally becomes cacheable once finding 2 is fixed.

---

### 7. In-memory cache and rate limiter are per-process under a 3-instance cluster

**Where:** [`ecosystem.config.js`](../../ecosystem.config.js) runs
`tijaratk-backend` with `exec_mode: "cluster", instances: 3`.
[`app.module.ts:38`](../src/app.module.ts) registers `CacheModule` with no store
(default in-process LRU) and `ThrottlerModule.forRoot` with no storage
(in-process counters).

**Why it must be addressed:**

- **Stale reads.** `bumpTenantSearchCacheVersion` / `bumpDashboardCacheVersion`
  only bump the version in the instance that handled the write. The other two
  instances keep serving pre-write results until their own copies expire. A
  merchant edits a price, reloads, and — depending on which worker answers —
  sees the old price. (Masked today by finding 2's accidental sub-second TTLs;
  fixing finding 2 without this one turns a hidden bug into a visible one.
  **Fix these two together.**)
- **Rate limits multiplied by 3.** The `@Throttle({ limit: 3 })` on OTP send in
  [`auth.controller.ts:79`](../src/auth/auth.controller.ts) is effectively 9/min
  once requests distribute across workers, weakening the intended abuse control.

**Resolution steps:**

1. Add a shared store. Redis via `@keyv/redis` for `CacheModule`
   (`cache-manager` v7 uses Keyv stores) and
   `@nest-lab/throttler-storage-redis` (or the community Redis storage) for
   `ThrottlerModule`.
2. If adding Redis is not acceptable right now, the honest interim options are
   (a) drop `instances` to 1, accepting reduced throughput, or (b) keep the
   cluster and explicitly scope caching to data where a 3-way split-brain is
   tolerable — never to merchant-visible writes. Document whichever is chosen.
3. Once a shared store exists, revisit the version-key indirection: with Redis
   you can delete by pattern and drop the version-key scheme entirely.

---

### 8. Legacy CSV import does per-row queries and duplicates a bulk implementation that already exists

**Where:** [`products.service.ts:3114`](../src/products/products.service.ts)
`importProductsFromCsv` (239 lines), still wired to
[`products.controller.ts:153`](../src/products/products.controller.ts).

Problems in one method:

- Reads the whole file into `const results: any[] = []` before processing.
- Loops rows with `await client.product.findFirst(...)` per row (line 3203) plus
  a create/update per row — classic N+1, inside the request transaction from
  finding 1, so a large file guarantees `P2028`.
- Uses runtime `require('csv-parser')` and `require('fs')` with two
  `eslint-disable` comments (lines 3148, 3150) instead of imports.

Meanwhile [`product-import.service.ts`](../src/products/product-import.service.ts)
already implements the correct version: chunked `createManyAndReturn`, chunked
`productPriceHistory.createMany`, a set-based `$executeRaw` upsert, and explicit
`maxWait: 10_000 / timeout: PRODUCT_IMPORT_TRANSACTION_TIMEOUT_MS` (line 332).

**Resolution steps:**

1. Map the legacy endpoint's CSV shape (`name|Name`, `price|Price`,
   `category|Category`, `imageUrl|ImageUrl|image_url`, Arabic-numeral
   normalisation) onto `ProductImportService`'s row model.
2. Repoint `products.controller.ts:153` at `ProductImportService`, preserving the
   existing `summary` response shape (`total_rows`, `created_rows`,
   `updated_rows`, `skipped_rows`, `failed_rows`, `errors[]`) so the merchant UI
   is unaffected.
3. Delete `importProductsFromCsv` and its two `require` calls — that removes 239
   lines from a 3351-line file.
4. Keep the catalog-source validation the legacy path performs
   (`resolveCatalogSourceForTenantCategory` + `findActiveCatalogCategoryNamesForSource`);
   `AGENTS.md` makes it a hard rule that imports must not create rows whose
   normalized category is invalid for the source.

---

## P2 — Worth scheduling

### 9. Missing composite indexes for the hottest order queries

**Where:** [`prisma/schema.prisma`](../prisma/schema.prisma). The schema is
well-indexed overall (107 `@@index`/`@@unique` across 44 models), which makes
these gaps stand out:

| Query | Current index | Needed |
|---|---|---|
| `orders.findAll` — `where tenant_id` + `orderBy created_at desc` + `take` (`orders.service.ts:606`) | `IDX_527dd...` on `tenant_id` only | `@@index([tenant_id, created_at(sort: Desc)])` |
| Dashboard/admin order filters by status and range | none | `@@index([tenant_id, status, created_at(sort: Desc)])` |
| Every `order_items` read by order (`orders.service.ts:441`, `:1863`, `order-dispatch.service.ts:943`) | only `pending_replacement_product_id` | `@@index([order_id])` |
| `order_items` joins to products | none | `@@index([product_id])` |

**Why it must be addressed:** with only `tenant_id` indexed, `ORDER BY created_at
DESC LIMIT n` makes Postgres read every row for the tenant and sort — the cost
grows with a merchant's lifetime order count, on the merchant's most-used
screen. `order_items.order_id` has no index at all despite being the most
frequent join in the codebase; Postgres does **not** create indexes for foreign
keys automatically.

**Resolution steps:** add the four `@@index` entries, generate a migration, and
confirm with `EXPLAIN ANALYZE` on `orders.findAll`'s query that the plan changes
from `Seq Scan`/`Sort` to an index scan. Note the existing partial-index style in
this schema (`where: raw("(status = 'active'...)")`, line 423) if a partial index
fits better for the status variant.

### 10. Raw-SQL count queries reuse parameters via fragile positional slicing

**Where:** [`products.service.ts:2388`](../src/products/products.service.ts)
`getReferencedRawQueryParams(query, params)` — scans the count query for the
highest `$n` and returns `params.slice(0, highest)`. Used at lines 2277, 2364,
2930.

**Why it must be addressed:** it works only because `limit`/`offset` happen to be
appended last, so the count query's highest placeholder happens to equal the
length of the prefix it needs. Add one parameter after limit/offset that the
count query references and it silently passes the wrong values — a wrong
`total`, not an exception. The `data` and `count` queries also run sequentially
(`await`, then `await`) where `Promise.all` would halve latency.

**Resolution steps:** build the count query from the same condition list but with
its own parameter array, so the two queries are independently parameterised;
delete `getReferencedRawQueryParams`. Then run both with `Promise.all`.
(Consider `Prisma.sql`/`Prisma.join` from `@prisma/client` to compose these
fragments type-safely instead of string concatenation with `$queryRawUnsafe`.)

### 11. Ten near-identical tenant-client helpers, none validating tenant identity

**Where:** the same 5–15 line helper is reimplemented as
`getPrismaClient` (`products.service.ts:169`, `availability-requests.service.ts:606`),
`getDb` (`merchant-dashboard.service.ts:389`, `tenant-cancellation-policy.service.ts:468`),
`getCustomersDb`/`getOrdersDb` (`customers.service.ts:718`, `:723`),
`activityClient` (`activity-log.service.ts:143`),
`orderClient`/`productClient` (`orders.service.ts:2873`, `:2883`),
`withTenantManager` (`orders.service.ts:2844`),
`runInTenantContext` (`orders.service.ts:2794`),
`runWithTenantRls` (`admin.service.ts:240`),
plus 23 direct `DbTenantContext.getManager()` call sites across 14 files.

**Why it must be addressed:** beyond the duplication, `withTenantManager(tenantId, cb)`
**ignores its `tenantId` argument** whenever an ambient manager exists — it
returns `callback(manager)` without checking that the ambient context is bound to
the same tenant. Today that is safe because callers happen to match, but
cross-tenant flows already exist (`order-dispatch.service.ts` creates orders for
a merchant tenant while the request context belongs to the zone operator). A
future caller that passes a different `tenantId` gets silently wrong RLS scoping
rather than an error. Consolidating is how you get one place to enforce the
invariant.

**Resolution steps:**

1. Add `src/common/database/tenant-db.ts` exporting
   `getTenantClient(prisma, tenantId?)` and
   `runWithTenant(prisma, tenantId, cb)`, built from the existing
   `withTenantManager` body.
2. Make `runWithTenant` throw when `DbTenantContext.getTenantId()` is set and
   differs from the requested `tenantId`, with an explicit opt-out parameter for
   the deliberate cross-tenant dispatch flows.
3. Replace the ten helpers with calls to it, one service per commit.

### 12. God classes and very high cognitive complexity

**Where:** `products/products.service.ts` (3351 lines),
`orders/orders.service.ts` (2906), `admin/admin.service.ts` (2626) with
`admin/admin.controller.ts` at 1193 lines and **47 route handlers**.
Longest runtime methods: `orders.service.ts:281 createForTenantId` (306 lines),
`products.service.ts:3114 importProductsFromCsv` (239),
`zone-storefronts/order-dispatch.service.ts:67 createPublicOrder` (219),
`admin.service.ts:2421 getOrders` (207),
`stores-directory.service.ts:223 getCategoryPage` (206).

**Why it must be addressed:** `eslint-plugin-sonarjs` recommended rules are
already enabled in [`eslint.config.mjs`](../eslint.config.mjs), which includes
`sonarjs/cognitive-complexity` — these methods are far past its threshold, so
the signal is being ignored rather than acted on. `createForTenantId` alone
interleaves delivery resolution, customer upsert, payload validation, pricing,
persistence, activity logging, push enqueue, Meta enqueue, and post-commit
notification, which is why the transaction-scope bug in finding 1 was able to
hide inside it.

**Resolution steps (incremental, no big-bang rewrite):**

1. Split by seam, not by line count. For `createForTenantId`: extract
   `resolveOrderContext` (delivery + customer + tenant),
   `buildOrderPayload` (the `Prisma.OrderUncheckedCreateInput` literal),
   `computeOrderTotals` (the pricing-mode ladder), and
   `recordOrderSideEffects` (activity log + push + Meta). Each is independently
   readable and the pricing ladder becomes unit-reviewable by inspection.
2. Split `admin.controller.ts` along its existing groupings — tenants, products,
   orders, catalog, subscriptions — into separate controllers sharing the
   `/admin` prefix. Same for `admin.service.ts`.
3. Carve `products.service.ts` into `ProductsService` (CRUD),
   `ProductSearchService` (the raw-SQL trgm search), and `CatalogService`
   (catalog-item reads). Finding 8 removes 239 lines from it for free.
4. Run `pnpm run lint:ci` and treat `sonarjs/cognitive-complexity` as the
   completion signal rather than a line target.

### 13. Order creation makes four avoidable round-trips

**Where:** [`orders.service.ts:281`](../src/orders/orders.service.ts) `createForTenantId`:

- line 424 `orderItem.createMany` immediately followed by line 428
  `orderItem.findMany` to read back what was just written — Prisma 7 has
  `createManyAndReturn`, already used at `product-import.service.ts:809`.
- line 466 `order.create` then line 476 `order.update` purely to set
  `pricing_mode`/`subtotal`/`total`, followed by three lines manually patching
  the in-memory object to match. Items and prices are already in memory before
  the insert, so totals can be computed first and written in the single insert.
- line 570 re-reads the order via `findOne(savedOrder.id)` after building most
  of it in memory.

**Why it must be addressed:** four extra round-trips on the platform's most
important write path, each extending the transaction from finding 1. The
`order.create`-then-`update` pattern also writes two row versions per order,
doubling WAL and bloat on the hottest table. And the manual patching (lines
478–482) is a correctness hazard: it duplicates the update's field list, so the
two can drift.

**Resolution steps:** compute `subtotal`/`total`/`pricing_mode` before
`order.create` and pass them in the initial payload; use
`createManyAndReturn` for the items; keep `findOne` only for the fields the
response genuinely needs that were not built in memory (or `select` just those).

### 14. `CacheService` is dead code

**Where:** [`common/cache.service.ts`](../src/common/cache.service.ts) — 154
lines exporting `CACHE_KEYS`, `CACHE_TTL`, and a `CacheService` class with
`get`/`set`/`del`/`invalidateStore`/`invalidateProduct`/`getOrSet`. Grep confirms
zero imports anywhere in `src/`.

**Why it must be addressed:** it is a plausible-looking, correctly-documented
caching abstraction that nothing uses, sitting next to four ad-hoc caching
implementations that each get the TTL unit wrong (finding 2). A reader
reasonably assumes it is the caching layer. Either it is the abstraction or it
is noise.

**Resolution steps:** decide once. Since its `CACHE_TTL` values are the only
correct millisecond TTLs in the codebase, the better call is to **adopt** it:
make it the single entry point for finding 2's fixes, register it in a shared
module, and migrate `products.service.ts` / `merchant-dashboard.service.ts` onto
`getOrSet`. If you would rather not, delete the file.

### 15. Duplicate-name check runs a non-sargable scan on every product write

**Where:** [`products.service.ts:2419`](../src/products/products.service.ts)
`ensureUniqueActiveProductName` runs
`WHERE ... LOWER(REGEXP_REPLACE(TRIM(name), '\s+', ' ', 'g')) = $3`.

**Why it must be addressed:** wrapping `name` in function calls prevents any
b-tree index from being used, so every product create/update triggers a
sequential scan over the tenant's products — inside the request transaction,
and once per row during imports.

**Resolution steps:** the schema comment on `Product` already notes "This model
contains an expression index", so the mechanism is established. Add an
expression index matching this predicate exactly —
`(tenant_id, LOWER(REGEXP_REPLACE(TRIM(name),'\s+',' ','g')))`, partial on
`status = 'active' AND deleted_at IS NULL` — or, better, persist the normalized
value (there is already a `name_normalized` column used by the search queries at
line 2225) and make it a plain unique partial index. The second option removes
the query entirely in favour of a constraint violation, which the exception
filter already maps to 409 via `P2002`.

### 16. Catalog taxonomy lookup re-queried at 23 call sites, uncached

**Where:** [`catalog-source-policy.ts:389`](../src/products/catalog-source-policy.ts)
`findActiveCatalogCategoryNamesForSource` — a `catalogCategory.findMany` over a
small, near-static lookup table, called from 23 places including inside per-zone
and per-request loops (findings 4 and 8).

**Why it must be addressed:** it is administrator-configured taxonomy that
changes rarely, re-read many times within a single request. It is also the
correct centralisation point per `AGENTS.md`, so making it cheap is what keeps
callers from inlining their own category constants — which that document
explicitly forbids.

**Resolution steps:** memoise per `source` inside the module with a short TTL
(or via `CacheService` from finding 14), and invalidate from the admin catalog
category mutations in `admin.service.ts`. Keep the signature so the 23 call
sites are untouched.

---

## P3 — Consistency and hygiene

### 17. Three different pagination field names across the public API

`last_page` + `has_next` (`products.service.ts:1096`, `customers.service.ts:467`),
`lastPage` (`stores-directory.service.ts:416`, `zone-storefronts.service.ts:929`),
and `totalPages` (`admin.service.ts:276`, `:528`, `stores-directory.service.ts:685`)
— the `Math.ceil(total / limit)` expression is reimplemented at 13+ sites, three
of them with different guards (`|| 1`, `> 0 ? ... : 1`, `Math.max(1, ...)`).

**Why:** every frontend consumer needs per-endpoint knowledge of which spelling
to expect, and the divergent zero-total guards mean `lastPage` is `0` on some
endpoints and `1` on others for an empty result.

**Steps:** add `buildPaginationMeta(total, page, limit)` in `src/common/utils/`,
returning one shape; migrate endpoints. If the response shape is already relied
on by the frontend, emit both keys for one release, then drop the aliases.

### 18. Any object with a `code` property is reported as a database error

[`all-exception.filter.ts:88`](../src/common/filters/all-exception.filter.ts)
`isDatabaseException` returns true for any non-null object with a `code` key.
Node system errors (`ENOENT`, `ECONNREFUSED`), Twilio errors, and `web-push`
errors all match, so unrelated failures surface as
`"Database operation failed"` — misleading in Sentry and in support triage.

**Steps:** narrow to `exception instanceof Prisma.PrismaClientKnownRequestError`
plus an explicit allowlist of Postgres SQLSTATE strings (the `22P02`/`23505`/
`23503` cases already handled), and let anything else fall through to the
generic 500 path.

### 19. Three near-duplicate raw-SQL search builders

`searchWithinTenantProducts` (line 2175), `searchWithinPublicProducts` (2285),
and `searchWithinCatalogItems` (2826) each rebuild the same
`addParam` closure, the same `word_similarity * 0.55 + similarity * 0.30 + prefix * 0.15`
ranking expression, and the same data+count pair. The weights are duplicated as
string literals, so a relevance tweak must be made in three places or the
variants silently diverge.

**Steps:** extract the ranking expression and the condition builder into one
helper parameterised by table/alias and column, then have the three callers
supply only their own filters. The in-code note at line 2225 ("move this ranking
behind a dedicated search engine such as Meilisearch") stays valid as the longer-
term direction; consolidating first is what makes that swap a single change.

### 20. Inconsistent `deleted_at` filtering on order reads

`orders.findAll` (line 599) filters only `tenant_id`, while
`merchant-dashboard.service.ts` consistently adds `deleted_at: null`, and
`Order` does have a `deleted_at` column. Benign today — nothing in
`orders.service.ts` writes `deleted_at` — but the day a soft delete is
introduced, the merchant order list will show deleted orders while the dashboard
counts exclude them.

**Steps:** decide whether orders are soft-deletable. If yes, add
`deleted_at: null` to the order reads in `orders.service.ts`. If no, drop the
column, or add a one-line comment stating orders are never soft-deleted so the
asymmetry is intentional.

### 21. Lint rules that would catch these classes of bugs are disabled

[`eslint.config.mjs`](../eslint.config.mjs) sets
`@typescript-eslint/no-explicit-any: 'off'`,
`no-floating-promises: 'warn'`, and `no-unsafe-argument: 'warn'`. There are 34
`any`/`as any` sites in `src/`, including `Map<number, any>` for the product
lookup in `createForTenantId` (line 366) and `data: orderItemsPayload as any`
(line 425) — a cast on the write path of the platform's most important table,
where a payload/schema mismatch would otherwise be a compile error.

**Steps:** promote `no-floating-promises` to `error` (an unawaited DB call inside
a transaction is exactly the failure mode in finding 1). Leave `no-explicit-any`
off if that is a deliberate choice, but remove the two `as any` casts on the
order write path and type `productsById` as `Map<number, Product>`.

### 22. Verify the port env var matches the deployment

`main.ts:157` listens on `process.env.HTTP_SERVER_PORT`, while
`ecosystem.config.js` sets `PORT: 8000` for the backend app. If
`.env.production` does not define `HTTP_SERVER_PORT`, `app.listen(undefined)`
binds a random port. Worth confirming — a one-line check, not a code change if
the env file already covers it.

---

## Suggested sequencing

0. ~~**Finding 23**~~ — ✅ done. Option A verified in production, then Option B
   retired the module. Finding 4 is void; findings 11 and 12 shrank by 4,558
   lines. Remaining zone work is the table-drop migration, tracked in finding 23.
1. **Findings 2 + 7 together** — the TTL fix and the shared cache store. Fixing
   the TTL alone converts a hidden staleness bug into a user-visible one.
2. **Finding 1, steps 1–2** — transaction options, pool sizing, and moving
   Twilio behind an outbox. Highest risk-reduction per unit of work; the outbox
   pattern is already proven three times in this codebase.
3. **Finding 3, then 4** — the two per-tenant/per-zone transaction fan-outs,
   which are the two paths that will break first as tenant count grows.
   *Skip finding 4 entirely if finding 23 goes to Option B.*
4. **Findings 9 + 15** — index and migration work, cheap and independently
   shippable.
5. **Findings 6, 5, 8** — bounded memory on dashboard, directory, and imports.
6. **Findings 11, 12, 13** — structural cleanup, one service per commit.
   Do finding 23 Option B before this if it is happening: retiring the module
   removes 4,558 lines these findings would otherwise ask you to refactor.
7. **P3s** as they are touched.

Findings 1 (step 3), 11, and 12 are the same refactor viewed from three angles;
doing 11 first gives 1 and 12 a single place to change.

## Verification approach

Per repository policy (`AGENTS.md`) there are no unit tests, and agents do not
run build, lint, migration, or dev-server commands. Verification is therefore
manual, and these are the commands **you** would run:

```bash
cd backend && SLOW_QUERY_MS=100 pnpm run start:dev
```

- **Finding 2:** call `GET /dashboard/measurements` twice within a second — the
  second should emit no queries.
- **Finding 1:** point Twilio at an unreachable endpoint and place an order —
  the order should commit and the notification should be queued, not lost.
- **Findings 3, 4:** seed ~50 tenants/zones and count queries per admin page
  view in the Prisma query log.
- **Finding 9:** `EXPLAIN ANALYZE` the `orders.findAll` query before and after
  the migration.
- **Finding 23:** with the flag off, confirm no new `push_notification_outbox`
  rows carry a `dispatch_id`, and that the merchant inbox and admin-managed
  permission flows still behave.
- **Regression:** `pnpm run test:e2e` (the two maintained security e2e suites)
  after the RLS-related changes in findings 1, 3, and 11.
