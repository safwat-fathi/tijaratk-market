# Tijaratk MVP Store Ranking Spec

## Purpose

This document defines how Tijaratk should rank stores inside area/category pages during the first MVP year.

Example routes:

- `/stores/6-october`
- `/stores/6-october/supermarkets`
- `/stores/6-october/pharmacies`
- `/stores/category/supermarkets`

The goal is to give customers useful results while keeping store visibility fair, explainable, and simple enough for a bootstrapped SaaS.

---

## Product Principle

For the first year, Tijaratk should **not** behave like a mature marketplace ranking engine.

Do not rank stores mainly by:

- Total order count
- Total revenue
- Paid subscriptions only
- Manual admin preference
- Alphabetical order
- Creation date only

These rules create unfair permanent advantages. The MVP ranking should be based on:

1. Customer usefulness
2. Store readiness
3. Operational availability
4. Fair rotation

---

## MVP Ranking Strategy

The store list should be split into simple ranking buckets.

### Bucket 1: Open Now + Serviceable + Complete

Stores that:

- Are active
- Belong to the selected area/category
- Are open now or delivery is currently available
- Have enough storefront data
- Have at least 25 available products

These stores appear first.

### Bucket 2: Closed Now but Serviceable + Complete

Stores that:

- Are active
- Belong to the selected area/category
- Are currently closed
- Have enough storefront data
- Have at least 25 available products

These stores appear after open stores.

### Bucket 3: New Stores / Incomplete Stores

Stores that:

- Are active
- Belong to the selected area/category
- Are newly added or incomplete
- May have few products or missing images/logo/banner

These stores appear lower, but should still get some visibility.

### Bucket 4: Unavailable / Poor Readiness

Stores that:

- Have no available products
- Have delivery disabled
- Have missing essential data
- Are temporarily inactive

Usually these should not appear in normal customer-facing results unless the page needs to show empty-state alternatives.

---

## Fair Rotation Rule

Inside each bucket, stores should be ordered using deterministic rotation, not random SQL ordering.

### Why deterministic rotation?

Avoid using `ORDER BY RANDOM()` because:

- It is expensive on large tables
- It is hard to cache
- It creates unstable pagination
- It makes debugging ranking issues difficult

Instead, use a daily seed.

Example seed:

```ts
const seed = `${areaSlug}:${category}:${yyyyMMdd}`;
```

Each store receives a stable rotation value for that day:

```ts
rotationScore = hash(`${seed}:${tenantId}`);
```

Then sort by:

```text
bucket ASC, rotationScore ASC
```

This means:

- Ranking is stable during the same day
- Ranking changes naturally day by day
- Every store gets fair exposure over time
- Pagination remains stable

---

## MVP Ranking Formula

Do not over-engineer scoring in year one. Use a simple score only to determine buckets and flags.

```text
readiness_score =
  logo_score +
  products_score +
  delivery_score +
  location_score +
  working_hours_score +
  products_categories_variety_score
```

Recommended values:

| Factor                            |  Points |
| --------------------------------- | ------: |
| Has logo                          |      10 |
| Has at least 25 active products   |      25 |
| Delivery enabled                  |      20 |
| Has area assigned                 |      15 |
| Has working/delivery hours        |      10 |
| Has variety of product categories |      20 |
| **Total**                         | **100** |

### Store readiness levels

| Level    |     Score | Meaning                      |
| -------- | --------: | ---------------------------- |
| Complete |   `>= 70` | Good enough to rank normally |
| Partial  | `40 - 69` | Can appear, but lower        |
| Poor     |    `< 40` | Avoid showing unless needed  |

---

## Ranking Sort Order

Final MVP ordering should be:

```text
1. sponsored_rank ASC NULLS LAST     // optional, only for future paid placements
2. bucket_priority ASC
3. readiness_level DESC
4. daily_rotation_score ASC
5. tenant_id ASC                     // final deterministic tie-breaker
```

For year one, avoid enabling paid placement unless you can clearly label it as sponsored.

---

## Recommended Database Changes

Current `tenants` already has useful fields like `category`, `status`, `slug`, `delivery_available`, `delivery_starts_at`, and `delivery_ends_at`.

For area/category directory ranking, add the following MVP fields.

### `areas` table

```prisma
model Area {
  id        Int      @id @default(autoincrement())
  nameAr    String   @map("name_ar") @db.VarChar(100)
  nameEn    String?  @map("name_en") @db.VarChar(100)
  slug      String   @unique @db.VarChar(120)
  city      String?  @db.VarChar(100)
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tenants Tenant[]

  @@map("areas")
}
```

### Add fields to `tenants`

```prisma
model Tenant {
  // existing fields...

  areaId              Int?      @map("area_id")
  area                Area?     @relation(fields: [areaId], references: [id])

  logoUrl             String?   @map("logo_url")
  shortDescription    String?   @map("short_description") @db.VarChar(180)

  isDirectoryVisible  Boolean   @default(true) @map("is_directory_visible")
  manuallyHiddenAt    DateTime? @map("manually_hidden_at")

  // Optional cached ranking fields
  readinessScore           Int       @default(0) @map("readiness_score")
  activeProductsCount      Int       @default(0) @map("active_products_count")
  availableProductsCount   Int       @default(0) @map("available_products_count")
  // category count should be represents the variety of categories in the store (not the number of products in the store)
  productsCategoriesCount  Int       @default(0) @map("products_categories_count")

  lastCatalogUpdatedAt DateTime? @map("last_catalog_updated_at")

  @@index([areaId, category, status, isDirectoryVisible])
  @@index([category, status])
  @@index([readinessScore])
}
```

### Optional: `store_directory_stats` table

Use this only if calculating counts from orders/products becomes expensive.

```prisma
model StoreDirectoryStats {
  tenantId               Int      @id @map("tenant_id")
  tenant                 Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  activeProductsCount    Int      @default(0) @map("active_products_count")
  availableProductsCount Int      @default(0) @map("available_products_count")
  completedOrders30d     Int      @default(0) @map("completed_orders_30d")
  cancelledOrders30d     Int      @default(0) @map("cancelled_orders_30d")
  profileViews30d        Int      @default(0) @map("profile_views_30d")
  lastOrderAt            DateTime? @map("last_order_at")
  lastUpdatedAt          DateTime @default(now()) @map("last_updated_at")

  @@map("store_directory_stats")
}
```

For MVP, you can skip this table and use cached fields on `tenants`.

---

## Backend API

### Endpoint

```http
GET /public/stores
```

### Query params

| Param      | Required | Example     | Description              |
| ---------- | -------- | ----------- | ------------------------ |
| `areaSlug` | Optional | `6-october` | Area page filter         |
| `category` | Optional | `grocery`   | Store category filter    |
| `page`     | Optional | `1`         | Pagination page          |
| `limit`    | Optional | `20`        | Page size                |
| `openNow`  | Optional | `true`      | Optional customer filter |

### Response

```ts
type StoreDirectoryResponse = {
  items: StoreDirectoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNextPage: boolean;
  };
  meta: {
    area?: {
      nameAr: string;
      slug: string;
    };
    category?: string;
    rankingDate: string; // yyyy-MM-dd
  };
};
```

```ts
type StoreDirectoryItem = {
  id: number;
  name: string;
  slug: string;
  category: string;
  areaName?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  shortDescription?: string;

  isOpenNow: boolean;
  deliveryAvailable: boolean;
  deliveryFee: number;
  deliveryTimeLabel?: string;

  readinessLevel: "complete" | "partial" | "poor";
  badges: StoreBadge[];
};
```

```ts
type StoreBadge =
  | "open_now"
  | "new_store"
  | "complete_profile"
  | "delivery_available"
  | "popular_nearby"; // avoid using this until you have reliable data
```

---

## Backend Ranking Service

Create a backend service:

```text
StoreDirectoryService
```

Main method:

```ts
getStoresForDirectory(params: {
  areaSlug?: string;
  category?: TenantCategory;
  page: number;
  limit: number;
  openNow?: boolean;
}): Promise<StoreDirectoryResponse>
```

### Responsibilities

The service should:

1. Validate area/category filters.
2. Query only active and visible tenants.
3. Compute `isOpenNow`.
4. Compute or read `readinessScore`.
5. Assign `bucketPriority`.
6. Compute deterministic daily rotation score.
7. Sort stores.
8. Return UI-ready cards.

---

## Bucket Assignment Logic

```ts
function getBucketPriority(store: StoreRankingInput): number {
  if (!store.isDirectoryVisible) return 99;
  if (store.status !== "active") return 99;
  if (store.availableProductsCount <= 0) return 40;

  const isComplete = store.readinessScore >= 70;

  if (store.isOpenNow && store.deliveryAvailable && isComplete) return 10;
  if (!store.isOpenNow && store.deliveryAvailable && isComplete) return 20;
  if (store.readinessScore >= 40) return 30;

  return 40;
}
```

---

## Open Now Logic

For MVP, use tenant delivery hours.

```ts
function isOpenNow(
  store: {
    deliveryAvailable: boolean;
    deliveryStartsAt?: string | null;
    deliveryEndsAt?: string | null;
  },
  now: Date,
): boolean {
  if (!store.deliveryAvailable) return false;

  if (!store.deliveryStartsAt || !store.deliveryEndsAt) {
    return true; // MVP fallback: delivery enabled means open
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = parseHHMM(store.deliveryStartsAt);
  const endMinutes = parseHHMM(store.deliveryEndsAt);

  // Normal same-day window: 09:00 - 23:00
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  // Overnight window: 20:00 - 02:00
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}
```

---

## Deterministic Rotation Implementation

Use a simple hash function in the backend.

```ts
import crypto from "node:crypto";

function getDailyRotationScore(input: {
  tenantId: number;
  areaSlug?: string;
  category?: string;
  date: string;
}): number {
  const raw = `${input.areaSlug ?? "all"}:${input.category ?? "all"}:${input.date}:${input.tenantId}`;
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return parseInt(hash.slice(0, 8), 16);
}
```

This score should not be stored permanently. Compute it per request or inside query post-processing.

---

## Query Approach

### Option A: Fetch candidates then sort in memory (use for now)

Recommended for MVP if the area has fewer than 1,000 stores.

Steps:

1. Fetch candidate stores by area/category/status.
2. Include active/available product counts.
3. Map to ranking fields.
4. Sort in memory.
5. Paginate after sorting.

This is easier and safer in year one.

### Option B: SQL ranking

Use later when directories become large.

For MVP, avoid complex SQL unless needed.

---

## Example Backend Pseudocode

```ts
async function getStoresForDirectory(params) {
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 20, 50);
  const today = formatDate(new Date(), "yyyy-MM-dd");

  const candidates = await prisma.tenant.findMany({
    where: {
      status: "active",
      isDirectoryVisible: true,
      deletedAt: null,
      ...(params.category ? { category: params.category } : {}),
      ...(params.areaSlug ? { area: { slug: params.areaSlug } } : {}),
    },
    include: {
      area: true,
    },
  });

  const ranked = candidates
    .map((store) => {
      const isOpen = isOpenNow(store, new Date());
      const readinessLevel = getReadinessLevel(store.readinessScore);
      const bucketPriority = getBucketPriority({
        ...store,
        isOpenNow: isOpen,
      });

      return {
        store,
        isOpenNow: isOpen,
        readinessLevel,
        bucketPriority,
        dailyRotationScore: getDailyRotationScore({
          tenantId: store.id,
          areaSlug: params.areaSlug,
          category: params.category,
          date: today,
        }),
      };
    })
    .filter((item) => item.bucketPriority < 99)
    .sort(
      (a, b) =>
        a.bucketPriority - b.bucketPriority ||
        readinessRank(b.readinessLevel) - readinessRank(a.readinessLevel) ||
        a.dailyRotationScore - b.dailyRotationScore ||
        a.store.id - b.store.id,
    );

  const total = ranked.length;
  const start = (page - 1) * limit;
  const items = ranked.slice(start, start + limit).map(toStoreDirectoryItem);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      hasNextPage: start + limit < total,
    },
    meta: {
      rankingDate: today,
    },
  };
}
```

---

## Readiness Score Update Strategy

Do not calculate readiness score on every public request if it becomes expensive.

For MVP, update cached readiness values when:

- Store updates logo
- Store changes delivery settings
- Store adds/removes products
- Product availability changes
- Store area/category changes

Create a backend method:

```ts
recalculateTenantReadiness(tenantId: number): Promise<void>
```

### Example calculation

```ts
function calculateReadinessScore(input: TenantReadinessInput): number {
  let score = 0;

  if (input.logoUrl) score += 10;
  if (input.activeProductsCount >= 5) score += 25;
  if (input.deliveryAvailable) score += 20;
  if (input.areaId) score += 15;
  if (input.deliveryStartsAt && input.deliveryEndsAt) score += 20;

  return score;
}
```

---

## UI Requirements

### Page: `/stores/[areaSlug]`

Purpose: show all stores in a selected area.

Recommended layout:

1. Page title
2. Area context
3. Category chips
4. Open-now toggle
5. Store cards list
6. Empty state

Example title:

```text
Stores delivering in 6 October
```

Arabic UI copy:

```text
متاجر بتوصل في ٦ أكتوبر
```

### Page: `/stores/[areaSlug]/[categorySlug]`

Purpose: show category-specific stores in an area.

Example title:

```text
Supermarkets in 6 October
```

Arabic UI copy:

```text
سوبر ماركت في ٦ أكتوبر
```

### Page: `/stores/category/[categorySlug]`

Purpose: show category stores before the customer selects an area.

Recommended behavior:

- Do not pretend results are nearby.
- Prioritize stores with complete profiles.
- Show area labels clearly.
- Add area filter/search at the top.

Arabic helper copy:

```text
اختار منطقتك عشان نعرضلك المتاجر الأقرب والأنسب
```

---

## Store Card UI

Each store card should include:

- Store logo
- Store name
- Category label
- Area label
- Open/closed status
- Delivery availability
- Delivery fee if available
- 1–3 badges
- CTA button: `View Store`

### Arabic card copy

| State              | Copy            |
| ------------------ | --------------- |
| Open now           | `مفتوح الآن`    |
| Closed now         | `مغلق حالياً`   |
| Delivery available | `يوجد توصيل`    |
| New store          | `متجر جديد`     |
| Complete profile   | `بيانات مكتملة` |
| View store         | `افتح المتجر`   |

### Avoid showing numeric ranking

Do not show:

```text
#1 Store
#2 Store
Rank: 4
```

This creates unnecessary merchant sensitivity.

---

## UI Sorting Explanation (explain to merchants only in their dashboard)

Add a small helper text near the list in the admin dashboard:

Arabic:

```text
بنرتب المتاجر حسب المتاجر المتاحة حالياً واكتمال بياناتها، مع تدوير عادل للظهور بين المتاجر.
```

English:

```text
Stores are ordered by current availability, profile completeness, and fair daily rotation.
```

This is important because merchants will ask why they are not first.

---

## Admin UI Requirements

In the admin merchant details page, show a `Directory Readiness` panel.

### Fields

- Directory visible: yes/no
- Area
- Category
- Readiness score
- Active products count
- Products categories count
- Available products count
- Missing setup items

### Missing setup examples

```ts
type MissingSetupItem =
  | "missing_logo"
  | "less_than_25_products"
  | "less_than_5_product_categories"
  | "delivery_disabled"
  | "missing_area"
  | "missing_delivery_hours";
```

### Admin actions

- Hide from directory
- Show in directory
- Recalculate readiness
- Edit area/category

---

## Merchant Dashboard UI Requirements

In merchant settings or home page, show a simple visibility checklist.

Arabic example:

```text
جاهزية ظهور متجرك
```

Checklist:

- Add store logo
- Add at least 25 products
- Add at least 5 product categories
- Enable delivery
- Select delivery area
- Add delivery hours

Do not tell merchants:

```text
Your ranking is 12
```

Instead tell them:

```text
كمّل بيانات متجرك عشان يظهر بشكل أفضل للعملاء
```

---

## Sponsored Stores Policy

For the first MVP year, avoid paid ranking unless absolutely necessary.

If sponsored placement is introduced:

- It must be clearly labeled as `Sponsored` / `إعلان`
- It should be limited to a small section at the top
- It should not replace the normal fair ranking list
- It should not be sold before there is enough traffic to make it valuable

Recommended MVP layout if sponsorship is added:

1. Sponsored stores section: max 2 cards
2. Open now stores
3. All stores with fair rotation

---

## Analytics Events

Track enough data to improve ranking later, but do not use it heavily in MVP ranking.

### Events

```ts
type DirectoryAnalyticsEvent =
  | "stores_directory_viewed"
  | "store_card_viewed"
  | "store_card_clicked"
  | "store_filter_changed"
  | "store_open_now_toggled";
```

### Event properties

```ts
type DirectoryEventProps = {
  areaSlug?: string;
  category?: string;
  tenantId?: number;
  position?: number;
  bucketPriority?: number;
  readinessLevel?: string;
  isOpenNow?: boolean;
  rankingDate: string;
};
```

Important: store the displayed `position` so future analysis can separate real store performance from ranking advantage.

---

## Edge Cases

### No stores in area/category

Show empty state:

Arabic:

```text
لسه مفيش متاجر متاحة في المنطقة دي.
```

Then show:

- Nearby areas if available
- Popular categories
- CTA to suggest a store

### Store has no products

Do not show it in the normal list. Show only in admin or merchant dashboard as incomplete.

### Store is closed

Show it after open stores with clear closed status.

### Store has delivery disabled

For area pages, usually hide it unless pickup/in-store ordering becomes supported.

### Pharmacy category

For pharmacies, avoid showing sensitive product assumptions. Ranking should still use the same availability/profile rules.

---

## MVP Implementation Checklist

### Backend

- [ ] Add `areas` table.
- [ ] Add `areaId`, `logoUrl`, `coverImageUrl`, `shortDescription` to tenants if missing.
- [ ] Add cached directory fields to tenants.
- [ ] Add indexes for area/category/status visibility.
- [ ] Implement `StoreDirectoryService`.
- [ ] Implement readiness score calculation.
- [ ] Implement deterministic daily rotation.
- [ ] Implement `/public/stores` endpoint.
- [ ] Add tests for bucket priority.
- [ ] Add tests for daily rotation stability.
- [ ] Add tests for open-now logic.

### Frontend

- [ ] Add `/stores` route group.
- [ ] Add `/stores/[areaSlug]` page.
- [ ] Add `/stores/[areaSlug]/[categorySlug]` page.
- [ ] Add `/stores/category/[categorySlug]` page.
- [ ] Build store card component.
- [ ] Build category chips.
- [ ] Build open-now filter.
- [ ] Build empty state.
- [ ] Add ranking explanation copy.
- [ ] Add merchant visibility checklist.

### Admin

- [ ] Add area/category fields to merchant admin page.
- [ ] Add directory visibility toggle.
- [ ] Add readiness score panel.
- [ ] Add missing setup checklist.
- [ ] Add recalculate readiness action.

### Analytics

- [ ] Track directory page views.
- [ ] Track store card views.
- [ ] Track store clicks.
- [ ] Track list position.
- [ ] Track filters.

---

## Testing Requirements

### Unit tests

Test:

- `calculateReadinessScore`
- `getBucketPriority`
- `isOpenNow`
- `getDailyRotationScore`
- Sorting comparator

### Integration tests

Test:

- Area + category filters
- Pagination stability
- Open stores appear before closed stores
- Poor readiness stores appear lower
- Hidden stores never appear

### Manual QA scenarios

1. 10 supermarkets in 6 October.
2. 3 open, 4 closed, 3 incomplete.
3. Confirm open stores appear first.
4. Refresh page multiple times in same day.
5. Confirm order is stable.
6. Change system date to next day.
7. Confirm order rotates.
8. Hide store from admin.
9. Confirm it disappears.
10. Remove all products from a store.
11. Confirm it appears lower or disappears depending on policy.

---

## What Not To Build In MVP

Do not build these in year one unless there is strong traction:

- Machine-learning ranking
- Personalized ranking per customer
- Complex distance-based routing
- Commission-based ranking
- Aggressive paid placement
- Real-time order-performance ranking
- Multi-factor marketplace auction system

These are not MVP needs and will add operational complexity too early.

---

## Future Ranking Upgrade After Year One

Once Tijaratk has enough data, ranking can include:

- Completed order rate
- Cancellation rate
- Average response time
- Repeat customers
- Profile click-through rate
- Product availability rate
- Distance from customer
- Customer reorder behavior

Future formula example:

```text
final_score =
  35% operational_quality +
  25% customer_engagement +
  20% availability +
  10% profile_completeness +
  10% freshness
```

But this should not be used in MVP until there is enough data to avoid unfair bias.

---

## Final Recommendation

For Tijaratk MVP year one, use this ranking approach:

```text
Open and complete stores first.
Closed but complete stores second.
Incomplete/new stores third.
Unavailable stores hidden or very low.
Inside each group, use fair daily deterministic rotation.
```

This is simple, cheap to implement, explainable to merchants, and fair enough for an early local-store SaaS in Egypt.
