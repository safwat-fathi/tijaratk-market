# Frontend Review — Findings and Remediation Plan

Reviewed: 2026-07-30 · Remediated: 2026-07-31
Scope: `frontend/` (Next.js 16.1.4 App Router, React 19.2, Tailwind 4, standalone output)

> **Status: all findings below have been implemented.** The zone-storefront
> feature was deleted outright rather than migrated (findings 10 and 12 in part).
> The "Where" line on each finding describes the code *as it was*; the
> **Resolution** note records what replaced it. Nothing here has been verified by
> a build — see [Verification](#verification).

Review criteria: render mode and caching correctness, Core Web Vitals, duplicate
and waterfall data fetching, client/server boundary hygiene, metadata
completeness and specificity, the SEO surface (sitemap / robots / canonical),
bundle and static-asset weight, cognitive complexity and single-file size, dead
code, and Next.js 16 App Router conventions.

Two measurements anchor most of what follows:

- `.next/prerender-manifest.json` from the 2026-07-29 build lists **four static
  routes**: `/_global-error`, `/favicon.ico`, `/robots.txt`, `/sitemap.xml`.
  Every page in the application is rendered per request — including pages like
  `/terms` that fetch nothing at all.
- There is **no `loading.tsx` anywhere** in `app/`, and `Suspense` appears in
  exactly two files. Nothing streams.

The codebase is in good shape on the things that are usually wrong: zero
`console.log`, one `cognitive-complexity` suppression in ~62k lines, ESLint
running `sonarjs` + `security` recommended, server-only data fetching, server
actions for mutations, and a genuinely careful consent-gated analytics layer.
The findings below are mostly about *rendering strategy* and *where code is
mounted*, not about code correctness.

| # | Severity | Finding | Primary file |
|---|---|---|---|
| 1 | P0 | The root layout's data fetch makes every route in the app dynamic | `app/layout.tsx` |
| 2 | P0 | `HttpService` reads cookies on every request, including anonymous ones — the Data Cache is keyed per visitor | `services/base/http.service.ts` |
| 3 | P1 | The directory category page fetches the same resource twice with different arguments | `app/stores/[areaSlug]/[categorySlug]/page.tsx` |
| 4 | P1 | No streaming and no loading UI anywhere | across `app/` |
| 5 | P1 | Five admin pages bypass the per-request cache helper that exists for them | `app/(dashboard)/admin/**` |
| 6 | P1 | An 893-line customer client component is mounted on admin and merchant routes | `app/layout.tsx` |
| 7 | P1 | Metadata gaps and over-generalized titles across 27 pages | `app/(dashboard)/admin/**`, `lib/marketing-seo.ts` |
| 8 | P1 | Third-party analytics injected with a raw `<script>` in the root layout | `app/layout.tsx` |
| 9 | P1 | ~12 MB of dead bytes served from `public/` | `public/` |
| 10 | P2 | `OrderForm.tsx` — 2,446 lines, ~30 `useState`, a duplicate of the live order flow | `app/(public)/[slug]/_components/OrderForm.tsx` |
| 11 | P2 | `getCookiesStringAction` is a server action that returns every cookie, httpOnly included | `app/actions/cookie-store.ts` |
| 12 | P2 | Three PWA manifest route handlers are referenced by nothing | `app/pwa/**` |
| 13 | P2 | Sentry demo page and demo API route shipped to production | `app/sentry-example-*` |
| 14 | P2 | No `viewport` export, so no `theme-color` meta tag | `app/layout.tsx` |
| 15 | P2 | The sitemap covers 12 of the site's indexable routes | `app/sitemap.ts` |
| 16 | P2 | `Logo` downloads two images and hides one with CSS | `components/ui/Logo.tsx` |
| 17 | P2 | Eight files over 700 lines, three over 1,400 | across |
| 18 | P3 | Structural and convention drift (duplicate directories, stale `AGENTS.md`, misc.) | across |

---

## P0 — Fix before the next traffic increase

### 1. The root layout's data fetch makes every route in the app dynamic

**Where:** [`app/layout.tsx:86`](../app/layout.tsx) — `RootLayout` is `async`,
and line 92 awaits:

```ts
const pushConfigResponse = await customerPushNotificationsService.getConfig();
```

That call reaches `cookies()` (see finding 2). A root layout that reads request
data is dynamic, and **a dynamic root layout forces every descendant route to
be dynamic**. Nothing below it can be prerendered.

**Why it must be addressed:**

- The proof is in the build output: `/terms`
  ([`app/terms/page.tsx`](../app/terms/page.tsx)) is a pure static component
  with zero `await` and zero service imports, and it is still absent from the
  prerender manifest. So are `/privacy`, `/return-policy`, `/about`,
  `/pricing`, `/features`, `/features/order-management`,
  `/features/customer-list`, `/contact`, `/ai`, `/docs/overview`,
  `/docs/features`, `/docs/pricing`, `/docs/faq`, `/guide`, `/install` and
  `/offline` — 17 pages that could be static HTML served from disk.
- Every one of those pages now costs a Node render plus, transitively, an
  outbound API call to `/push-notifications/config` before the first byte
  leaves the server. TTFB on a marketing page is gated on backend latency it
  has no business depending on.
- `/offline` is the PWA's offline fallback. A dynamically rendered offline page
  is a contradiction — it cannot be precached usefully.
- This also amplifies finding 2: because nothing is static, the per-visitor
  Data Cache pollution is paid on every single request rather than absorbed by
  a prerender.

**How to fix:**

1. Remove the `getConfig()` call and the `async` from `RootLayout`. The root
   layout should render the `<html>` shell, fonts, and nothing that touches the
   request.
2. Move the push config fetch down to the subtrees that actually consume it.
   `app/(public)/layout.tsx` already exists and is the natural home for the
   customer PWA; the merchant and admin layouts already fetch their own copy
   via `getPushNotificationsConfigCached()`.
3. Combine with finding 6 — `CustomerPwaEngagement` is the only consumer of
   `pushConfig`, and it should not be in the root layout either. Moving the
   component moves the fetch with it.
4. Re-run the build and confirm the 17 marketing pages appear in
   `.next/prerender-manifest.json`.

Do this one first. Findings 2, 6 and 8 all become cheaper once the root layout
is inert.

**Resolution:** `app/layout.tsx` is now synchronous and request-independent —
no fetch, no `async`. The push config moved into
`components/pwa/CustomerPwaProvider.tsx`, a `React.cache`-wrapped server
component mounted only on customer routes. The inline `<head>` script became
`<Script strategy="beforeInteractive">`.

---

### 2. `HttpService` reads cookies on every request, including anonymous ones

**Where:** [`services/base/http.service.ts:211`](../services/base/http.service.ts)
— `_getAuthHeaders()` runs on **every** call made through the base service,
with no opt-out:

```ts
this._token = await getCookieAction(this._tokenKey);
// ...
const cookies = await getCookiesStringAction();      // line 227
if (cookies) headers["Cookie"] = cookies;
```

Both helpers call `cookies()` from `next/headers`. There is an `authRequired`
flag in `HttpRequestOptions`, but it is only consulted *after* the response
comes back, to decide whether a 401 should trigger a redirect
([`:278`](../services/base/http.service.ts)). It does not gate the cookie read.

**Why it must be addressed:**

- **Every route that fetches anything becomes dynamic.** A public storefront
  read (`getPublicTenant`, `getPublicProducts`) has no reason to touch cookies,
  but reading them opts the route into dynamic rendering. This is the same
  mechanism as finding 1, applied to every page independently — so fixing the
  root layout alone will *not* make the storefront or directory pages static.
- **The Data Cache is keyed per visitor.** Next derives the fetch cache key
  from the request's URL, method, headers and body. A `Cookie` header that
  differs per visitor produces a distinct cache entry per visitor. The
  `next: { revalidate: 300 }` settings in
  [`products.service.ts:49`](../services/api/products.service.ts),
  [`tenants.service.ts:30`](../services/api/tenants.service.ts),
  [`stores-directory.service.ts:18`](../services/api/stores-directory.service.ts)
  and [`push-notifications.service.ts:27`](../services/api/push-notifications.service.ts)
  are therefore close to inert for real traffic: a returning visitor with a
  tracking cookie shares no cache entry with anyone else. The intent of those
  five-minute windows is not being realised.
- **Unnecessary credential forwarding.** Session cookies are sent to the API on
  public catalogue reads that do not need them. Not exploitable as written —
  the API is trusted and same-origin — but it is a wider blast radius than the
  code requires.

**How to fix:**

1. Make the existing `authRequired` flag gate the cookie read, not just the 401
   handling:

   ```ts
   private async _getAuthHeaders(authRequired: boolean): Promise<HeadersInit> {
     if (typeof window !== "undefined" || !authRequired) return {};
     // ...existing token + cookie forwarding
   }
   ```

   `_request` already destructures `authRequired` in `_buildRequestOptions`
   ([`:249`](../services/base/http.service.ts)); hoist that read above the
   `_getAuthHeaders()` call at [`:338`](../services/base/http.service.ts).
2. Audit each service method and set `authRequired: true` explicitly on the
   authenticated ones. The dashboard services (`admin`, `orders`, `customers`,
   `merchant-dashboard`, `activity-logs`, `assigned-orders`) need it; the
   `getPublic*` methods do not.
3. Drop `credentials: "include"` at [`:266`](../services/base/http.service.ts)
   — it is a browser-fetch option and does nothing in a server runtime.
4. Rebuild and confirm the public storefront and directory routes move out of
   per-request rendering.

**Verify after the change** that authenticated dashboard calls still carry the
bearer token — this is the one change in this document with a real regression
surface. Exercise: merchant login → dashboard → orders list → order detail, and
admin login → merchants list.

**Resolution:** `_getAuthHeaders(authRequired)` returns `{}` unless the call
opted in, so public reads never touch `cookies()` and their Data Cache entries
are shared across visitors. `credentials: "include"` is gone. Every service
method that needs a session already passed `authRequired: true`, so no call
sites changed. `services/base/http.service.ts` is now `server-only`.

---

## P1 — Should be scheduled

### 3. The directory category page fetches the same resource twice, with different arguments

**Where:** [`app/stores/[areaSlug]/[categorySlug]/page.tsx`](../app/stores/[areaSlug]/[categorySlug]/page.tsx)

```ts
// :147  inside generateMetadata
const page = await getCategoryPage(areaSlug, categorySlug);

// :254  inside the page component
const page = await getCategoryPage(areaSlug, categorySlug, resolvedSearchParams);
```

`getCategoryPage` ([`:60`](../app/stores/[areaSlug]/[categorySlug]/page.tsx))
folds `searchParams` into the query string: `delivery_area_slug`, `search`,
`open_now`, `page`.

**Why it must be addressed:**

- When any filter is active — and the directory UI is built around filters —
  the two calls produce **different URLs**, so Next's per-request memoization
  cannot collapse them. Two full backend round-trips per page view, on the
  highest-traffic indexable route in the product.
- The metadata call is also the *wrong* one: it fetches the unfiltered page to
  build a title for the filtered page. If the backend ever varies `seo.title`
  by filter, the rendered title will silently disagree with the content.
- The same shape exists on the storefront —
  [`app/(public)/[slug]/page.tsx:114`](../app/(public)/[slug]/page.tsx) and
  [`:169`](../app/(public)/[slug]/page.tsx) both call `getTenant(slug)`. There
  the arguments match, so memoization does collapse them, but the dedupe is
  incidental rather than declared.

**How to fix:**

1. Wrap `getCategoryPage` in `React.cache()`. The pattern is already used in
   this codebase — [`app/page.tsx:79`](../app/page.tsx) and
   [`lib/server/dashboard-request-cache.ts`](../lib/server/dashboard-request-cache.ts).
2. Pass `resolvedSearchParams` from `generateMetadata` too, so both call sites
   hit the same cache entry:

   ```ts
   export async function generateMetadata({ params, searchParams }: Props) {
     const [{ areaSlug, categorySlug }, resolved] = await Promise.all([params, searchParams]);
     const page = await getCategoryPage(areaSlug, categorySlug, resolved);
   ```
3. Apply the same `cache()` wrapper to `getTenant` in
   [`app/(public)/[slug]/page.tsx:50`](../app/(public)/[slug]/page.tsx) so the
   dedupe is guaranteed rather than inferred.

**Resolution:** `fetchCategoryPage` is `React.cache`-wrapped and keyed on
primitives (`cache` compares arguments by identity, so passing the
`searchParams` object would not have deduped reliably). `generateMetadata` now
receives and forwards `searchParams`. `getTenant` in
`app/(public)/[slug]/page.tsx` is wrapped the same way.

---

### 4. No streaming and no loading UI anywhere

**Where:** `app/` contains exactly two boundary files —
[`app/error.tsx`](../app/error.tsx) and
[`app/not-found.tsx`](../app/not-found.tsx). There is no `loading.tsx` in any
segment. `Suspense` appears only in [`app/page.tsx`](../app/page.tsx) and
[`app/(dashboard)/merchant/(features)/page.tsx`](../app/(dashboard)/merchant/(features)/page.tsx).

**Why it must be addressed:**

- [`app/(dashboard)/merchant/(features)/layout.tsx:30`](../app/(dashboard)/merchant/(features)/layout.tsx)
  awaits three API calls before returning. The `Promise.all` is correct, but
  with no `loading.tsx` the browser gets **nothing** — not even the shell —
  until the slowest of the three resolves. Every merchant navigation is a blank
  screen for the duration of a backend round-trip.
- Same for admin: [`app/(dashboard)/admin/layout.tsx:31`](../app/(dashboard)/admin/layout.tsx).
- Without a segment `loading.tsx`, Next has no boundary to stream into, so the
  entire route is a single blocking render. This is the difference between a
  ~200 ms perceived navigation and a ~1 s one, and it maps directly onto INP
  and LCP.
- With only a root `error.tsx`, a failure in any nested segment unmounts the
  whole application shell — the user loses the sidebar and their navigation
  context for what may be one failed widget.

**How to fix:**

1. Add `loading.tsx` to each dashboard segment group:
   `app/(dashboard)/merchant/(features)/`, `app/(dashboard)/admin/`, and the
   heavier leaf routes (`orders/`, `products/new/`, `merchants/`). A skeleton
   matching the real layout is worth more than a spinner — it also stabilises
   CLS.
2. Add `loading.tsx` to `app/(public)/[slug]/` and
   `app/stores/[areaSlug]/[categorySlug]/`.
3. Add `error.tsx` to `app/(dashboard)/admin/` and
   `app/(dashboard)/merchant/(features)/` so failures stay scoped to the
   content area.
4. In pages that fetch several independent things, wrap the slow, below-the-fold
   sections in `<Suspense>` so the above-the-fold content ships first. The
   storefront ([`app/(public)/[slug]/page.tsx:197`](../app/(public)/[slug]/page.tsx))
   awaits products, categories, reorder-order, cart draft and availability
   together — the header could render before the catalogue resolves.

**Resolution:** Added `loading.tsx` to `app/(dashboard)/admin/`,
`app/(dashboard)/merchant/(features)/`, `app/(public)/[slug]/` and
`app/stores/[areaSlug]/[categorySlug]/`, and `error.tsx` to the two dashboard
segments (reporting to Sentry, resetting without a full reload).

---

### 5. Five admin pages bypass the per-request cache helper that exists for them

**Where:** [`lib/server/dashboard-request-cache.ts`](../lib/server/dashboard-request-cache.ts)
exists precisely to solve this, and exports `getCurrentAdminCached`. These five
call the service directly instead:

| File | Line |
|---|---|
| [`app/(dashboard)/admin/page.tsx`](../app/(dashboard)/admin/page.tsx) | 31 |
| [`app/(dashboard)/admin/zones/page.tsx`](../app/(dashboard)/admin/zones/page.tsx) | 15 |
| [`app/(dashboard)/admin/zones/[zoneId]/page.tsx`](../app/(dashboard)/admin/zones/[zoneId]/page.tsx) | 46 |
| [`app/(dashboard)/admin/activity/page.tsx`](../app/(dashboard)/admin/activity/page.tsx) | 117 |
| [`app/(dashboard)/admin/merchants/[tenantId]/page.tsx`](../app/(dashboard)/admin/merchants/[tenantId]/page.tsx) | 28 |

**Why it must be addressed:**

[`app/(dashboard)/admin/layout.tsx:32`](../app/(dashboard)/admin/layout.tsx)
already calls `getCurrentAdminCached()` for the shell. A page that calls
`adminService.getCurrentAdmin()` directly does not share that memoized result,
so loading any of these five pages performs the identity lookup **twice** —
once for the sidebar, once for the page's own role check. It is a duplicated
authenticated round-trip on the request's critical path, and the fix is a
one-line import change per file.

**How to fix:**

1. In each of the five files, replace
   `import { adminService } from "@/services/api/admin.service"` usage for this
   call with
   `import { getCurrentAdminCached } from "@/lib/server/dashboard-request-cache"`.
2. Call `getCurrentAdminCached()` in place of `adminService.getCurrentAdmin()`.
3. Consider adding a lint rule or a short note in `AGENTS.md` — the helper is
   easy to miss, which is presumably how five call sites drifted.

**Resolution:** The three surviving pages (`admin/page.tsx`,
`admin/activity/page.tsx`, `admin/merchants/[tenantId]/page.tsx`) now call
`getCurrentAdminCached()`. The other two were under `admin/zones/` and were
deleted with the zone feature.

---

### 6. An 893-line customer client component is mounted on admin and merchant routes

**Where:** [`app/layout.tsx:117`](../app/layout.tsx) wraps *all* children:

```tsx
<CustomerPwaEngagement config={pushConfig}>{children}</CustomerPwaEngagement>
```

[`components/pwa/CustomerPwaEngagement.tsx`](../components/pwa/CustomerPwaEngagement.tsx)
is 893 lines of `"use client"`. It imports nine lucide icons, `BottomSheet`,
two push server actions, `usePwaStandalone` and `runAfterLoadAndIdle`. At
runtime it computes `isCustomerRoute(pathname)` ([`:227`](../components/pwa/CustomerPwaEngagement.tsx))
and then does nothing on non-customer routes.

**Why it must be addressed:**

- The runtime guard is not a bundle guard. An admin loading
  `/admin/merchants` downloads, parses, hydrates and mounts all of it — plus
  its `BottomSheet` and icon dependencies — to reach an early return. That is
  pure dead weight on the two surfaces (admin, merchant) where the operator is
  on a desktop doing repeated navigations.
- Same for [`KeyboardStateDetector`](../components/pwa/KeyboardStateDetector.tsx)
  at [`app/layout.tsx:116`](../app/layout.tsx), a mobile-keyboard concern
  mounted on every admin page.
- It is also the component that forces finding 1: it is the sole consumer of
  the `pushConfig` the root layout fetches.

**How to fix:**

1. Move `<CustomerPwaEngagement>` and `<KeyboardStateDetector>` out of
   `app/layout.tsx` and into `app/(public)/layout.tsx`.
2. The storefront route `app/(public)/[slug]/` and the directory routes
   (`app/page.tsx`, `app/stores/`) sit outside `(public)` — either add a shared
   layout for them or mount the component in each. `isCustomerRoute` already
   encodes the intended route list; use it to decide *where to mount* rather
   than *what to do once mounted*.
3. Move the `getConfig()` fetch alongside it (finding 1).
4. While in this file: it uses `createContext` for its push state, which
   `AGENTS.md` explicitly rules out. See finding 18.

**Resolution:** `CustomerPwaEngagement` and `KeyboardStateDetector` moved out
of the root layout into `CustomerPwaProvider`, mounted at `app/(public)/layout.tsx`,
`app/page.tsx` and `app/stores/[areaSlug]/[categorySlug]/page.tsx` — the three
surfaces `isEligibleShoppingPath` already allowed. Admin and merchant pages no
longer download it.

**Behaviour change to be aware of:** the customer service worker previously
registered on *any* non-dashboard route, including the marketing pages. It now
registers on the shopping surfaces only. Scope is still `/`, so it activates as
soon as a visitor reaches one.

---

### 7. Metadata gaps and over-generalized titles across 27 pages

**Where:** several distinct problems, grouped.

**a. 22 admin pages share one title.** None of the pages under
`app/(dashboard)/admin/` export `metadata`, so all of them inherit
`title: "لوحة تحكم الإدارة"` from
[`app/(dashboard)/admin/layout.tsx:14`](../app/(dashboard)/admin/layout.tsx).
Merchants list, orders, zones, imports, catalogue items, plans, areas,
categories, activity and the per-tenant management screens are indistinguishable
in the browser tab, in history, and in a pinned-tab strip. For an operations
tool where staff keep several tabs open, that is a daily friction cost, not an
SEO one.

**b. Five pages have no metadata at all and no useful inherited title:**
`app/(dashboard)/merchant/onboarding/page.tsx`,
`app/(dashboard)/merchant/(features)/assigned-orders/page.tsx`,
`app/(dashboard)/merchant/(features)/assigned-orders/[dispatchId]/page.tsx`,
`app/stores/page.tsx`, `app/sentry-example-page/page.tsx`.

**c. The main marketing landing page has generic metadata.**
[`app/about/page.tsx`](../app/about/page.tsx) is 972 lines and its component is
literally named `LandingPage` — hero, pricing, FAQ, the full pitch. Its
metadata comes from `getPublicMarketingPage("/about")`, which is
[`lib/marketing-seo.ts:55`](../lib/marketing-seo.ts):

```ts
title: "عن تجارتك",
description: "تجارتك منصة إلكترونية بسيطة تساعد التجار في مصر على إدارة محلاتهم بسهولة أونلاين.",
```

That is an *about-us* title on the primary conversion page. The title carries
no keyword, no value proposition, and no differentiation from `/docs/overview`
("نظرة عامة على تجارتك"). Meanwhile the richer copy — "نظام بسيط لإدارة طلبات
المحلات أونلاين" — sits on `/`, which is the stores directory, not the pitch.

**d. Customer cart and checkout are indexable.**
[`app/(public)/[slug]/cart/page.tsx:12`](../app/(public)/[slug]/cart/page.tsx)
and [`app/(public)/[slug]/checkout/page.tsx:17`](../app/(public)/[slug]/checkout/page.tsx)
export a bare `{ title }` with no `robots` directive.
[`app/robots.ts`](../app/robots.ts) disallows `/*/success/` but neither
`/*/cart` nor `/*/checkout`. `createNoIndexMetadata` already exists in
[`lib/marketing-seo.ts:248`](../lib/marketing-seo.ts) and is used correctly on
the success page — it was just not applied here.

**e. A Pages-Router API in an App-Router page.**
[`app/sentry-example-page/page.tsx`](../app/sentry-example-page/page.tsx)
renders `<Head><title>…</title></Head>` from `next/head`. In the App Router
this is a no-op — the tags are never emitted. (Finding 13 recommends deleting
this page outright, which resolves it.)

**Language check:** all user-facing metadata is correctly Arabic. The only
English strings are `softwareApplicationJsonLd.description` at
[`lib/marketing-seo.ts:269`](../lib/marketing-seo.ts) and the `heroMockup`
`alt` at [`app/about/page.tsx:140`](../app/about/page.tsx). Both are
defensible — schema.org consumed by English-language crawlers and AI agents,
and an `alt` that doubles as a crawler description — but they should be a
deliberate choice, not an accident. Consider Arabic `alt` text with the English
kept in the JSON-LD only.

**How to fix:**

1. Add a one-line `export const metadata: Metadata = { title: "…" }` to each of
   the 22 admin pages. The layout's `robots: { index: false }` already covers
   indexing, so only the title matters. Arabic, specific, short — "المتاجر",
   "الطلبات", "المناطق", "الاستيرادات".
2. Add metadata to the five pages in (b). `app/stores/page.tsx` is a pure
   redirect, so `createNoIndexMetadata` is the right call there.
3. Add a distinct `publicMarketingPages` entry for the landing page in
   `lib/marketing-seo.ts` with a title that carries the value proposition, and
   stop reusing the `/about` entry for it.
4. Replace the bare metadata on cart and checkout with
   `createNoIndexMetadata(...)`, and add `/*/cart` and `/*/checkout` to
   `privatePaths` in `app/robots.ts`.

**Resolution:** All 58 pages now export metadata. 18 admin pages got specific
Arabic titles; `/about` got a landing-specific entry in `publicMarketingPages`
replacing the generic "عن تجارتك"; `/[slug]/cart` and `/[slug]/checkout` use
`createNoIndexMetadata` and are disallowed in `robots.ts`; `app/stores/page.tsx`
(a redirect) is `noindex`. The `next/head` page was deleted with finding 13.

---

### 8. Third-party analytics injected with a raw `<script>` in the root layout

**Where:** [`app/layout.tsx:122`](../app/layout.tsx):

```tsx
<script data-collect-dnt="true" async src="https://scripts.simpleanalyticscdn.com/latest.js"></script>
<noscript><img src="https://queue.simpleanalyticscdn.com/noscript.gif?collect-dnt=true" .../></noscript>
```

and the hand-rolled install-prompt capture at
[`app/layout.tsx:101`](../app/layout.tsx) using `dangerouslySetInnerHTML` inside
`<head>`.

**Why it must be addressed:**

- It runs on **every** route, including `/admin/*` and `/merchant/*`. The rest
  of the analytics layer is carefully scoped —
  [`components/analytics/MarketingTracking.tsx`](../components/analytics/MarketingTracking.tsx)
  maintains an explicit public-path allowlist and lazy-loads its runtime with
  `ssr: false`. This one tag bypasses that entirely and sends merchant and
  operator navigation to a third party.
- It also bypasses the consent gate. GA and Meta Pixel go through
  [`lib/analytics/marketing-consent.ts`](../lib/analytics/marketing-consent.ts);
  Simple Analytics does not. `data-collect-dnt="true"` is a reasonable
  privacy posture, but it is a different posture from the one the rest of the
  app implements, and the inconsistency is probably unintentional.
- A bare `<script>` in the App Router gets no loading-strategy control. `async`
  still competes with hydration for main-thread time; `next/script` with
  `afterInteractive` or `lazyOnload` does not.
- The `<head>` inline script is render-blocking by definition, on every page,
  to attach one event listener.

**How to fix:**

1. Move the Simple Analytics tag into
   `components/analytics/MarketingTrackingRuntime.tsx`, behind the same
   allowlist and consent check as GA and Meta. That file already imports
   `Script` from `next/script`.
2. If it must stay global, at minimum convert it to
   `<Script strategy="lazyOnload" src="…" />`.
3. Convert the `beforeinstallprompt` capture to
   `<Script id="install-prompt" strategy="beforeInteractive">`, or better —
   move it into `CustomerPwaEngagement`, which already registers a
   `beforeinstallprompt` listener at
   [`:275`](../components/pwa/CustomerPwaEngagement.tsx) and only reads the
   global as a fallback. The two listeners are redundant once the component
   mounts early enough.

**Resolution:** The Simple Analytics tag moved into
`MarketingTrackingRuntime` as `<Script strategy="lazyOnload">`, so it inherits
the public-path allowlist and no longer runs on the dashboards. It stays outside
the consent gate — it is cookieless and sends `data-collect-dnt`.

---

### 9. ~12 MB of dead bytes served from `public/`

**Where:**

| Asset | Size | Status |
|---|---|---|
| `public/tijaratk-logo-suite.zip` | 7.6 MB | source archive, publicly downloadable |
| `public/logo.png` | 2.0 MB | not imported anywhere |
| `public/images/hero-mockup.png` | 2.0 MB | superseded by the `.webp` that `app/about/page.tsx:6` imports |
| `public/android-chrome-512x512.png` | 326 KB | used by manifests; unoptimised |

`public/` totals ~20 MB, so this is over half of it.

**Why it must be addressed:**

- The `build` script in [`package.json:7`](../package.json) does
  `cp -r public/* .next/standalone/frontend/public/`. Every one of these bytes
  is copied into the deployment artifact and served by the standalone server.
- `tijaratk-logo-suite.zip` is a design-source archive reachable at
  `https://www.tijaratk.com/tijaratk-logo-suite.zip`. It should not be on the
  web server at all — it is not a web asset, and a 7.6 MB unauthenticated
  download is a trivially abusable bandwidth sink.
- `hero-mockup.png` is dead weight next to the 234 KB `.webp` that is actually
  used, and its presence invites someone to re-point the import at the wrong
  file.

**How to fix:**

1. Delete `public/tijaratk-logo-suite.zip`, `public/logo.png`, and
   `public/images/hero-mockup.png`. Move the logo suite to a design folder
   outside `frontend/`, or to shared storage.
2. Re-export `android-chrome-512x512.png` — 326 KB for a 512×512 icon means it
   is unquantised.
3. Confirm nothing references the deleted files:
   `grep -rn "logo.png\|hero-mockup.png\|logo-suite.zip" app components lib public/sw.js`

**Resolution:** `public/` went from ~20 MB to 9.4 MB. Deleted
`tijaratk-logo-suite.zip`, `logo.png`, `images/hero-mockup.png`, and the
unreferenced `branding-guide.png` and `favicon.png` from the logo suite. The one
`logo.png` reference (the track-order page) now uses the app icon.

**Still outstanding:** the four remaining logo-suite PNGs are 850 KB–1 MB each.
They are served through `next/image` so delivery is optimised, but they still
bloat the standalone artifact. Re-exporting them is a follow-up.

---

## P2 — Worth doing, not urgent

### 10. `OrderForm.tsx` — 2,446 lines, ~30 `useState`, a duplicate of the live order flow

**Where:** [`app/(public)/[slug]/_components/OrderForm.tsx:381`](../app/(public)/[slug]/_components/OrderForm.tsx)
— a single component spanning 2,066 lines with roughly thirty `useState` calls,
eight `useRef`s, and its own copies of cart selection, delivery-area choice,
scheduled-window choice, customer details, payment method, validation, product
pagination and search.

The important detail: **it is reachable from exactly one route** —
[`app/(public)/market/[zoneSlug]/page.tsx:118`](../app/(public)/market/[zoneSlug]/page.tsx)
— and that route is gated off by `isZoneStorefrontEnabled()`
([`lib/zone-storefront-feature.ts`](../lib/zone-storefront-feature.ts)), which
defaults to `false` per [`.env.example`](../.env.example).

The live tenant storefront was migrated to a three-page split:
`StorefrontCatalog` (700 lines) → `StorefrontCart` (457) → `StorefrontCheckout`
(541), across `/[slug]`, `/[slug]/cart` and `/[slug]/checkout`.

**Why it must be addressed:**

- Two complete implementations of the ordering flow now exist. Every change to
  delivery areas, scheduled windows, payment methods, prescription upload or
  validation has to be made twice — and the second copy is behind a flag, so
  the divergence is invisible until the flag is turned on.
- `ScheduledDeliverySelector` and `DeliveryAreaSelector` are already shared
  between the two flows, which means the duplication is partial and therefore
  the most dangerous kind: shared leaves, divergent orchestration.
- At ~30 pieces of local state in one function, the component is past the point
  where a reader can hold its state machine in their head. That is the concrete
  meaning of "high cognitive complexity" here, even though it does not trip the
  `sonarjs` threshold (which measures branching, not state).

**How to fix:**

1. Decide the fate of the zone-storefront experiment. If it is dead, delete
   `OrderForm.tsx`, `app/(public)/market/`, `lib/zone-storefront-feature.ts`,
   `services/api/zone-storefronts.service.ts`, `components/zone-storefronts/`
   and the `zoneStorefrontsEnabled` props threaded through both dashboard
   shells. That is the single largest cleanup available in this codebase.
2. If it is alive, port `/market/[zoneSlug]` onto the split flow — reuse
   `StorefrontCatalog`/`Cart`/`Checkout` with a zone-scoped data source — and
   then delete `OrderForm.tsx`.
3. Do not refactor `OrderForm` in place. Splitting a 2,400-line component that
   is scheduled for deletion is wasted effort.

**Resolution:** Deleted, along with the whole zone-storefront feature (your
call: "it is not needed anyways"). Removed: `app/(public)/market/`,
`app/(dashboard)/admin/zones/`, `merchant/(features)/assigned-orders/`,
`components/zone-storefronts/`, `services/api/zone-storefronts.service.ts`,
`services/api/assigned-orders.service.ts`, `actions/assigned-orders.ts`,
`types/models/zone-storefront.ts`, `lib/zone-storefront-feature.ts`, the
`ZONE_STOREFRONTS_ENABLED` flag, and `OrderForm` plus its seven
exclusively-used children.

Call sites were unwound rather than stubbed: the merchant orders "assigned" tab,
the `assigned_counts` field on `MerchantOrderInboxSummary`, the three
`dispatches.*` managed permissions, the zone nav entries in both dashboard
shells, and ~450 lines of zone actions in `actions/admin-server.ts`.

Two API-contract enums were **kept on purpose**: `OrderSource.ZONE_STOREFRONT`
and the `zone_storefront` / `order_dispatch` members of `ActivityEntityType`.
Deleting the frontend feature does not delete historical rows, and the backend
can still send those values. What did change is the reorder link on the two
order-tracking surfaces: it used to point at `zone_storefront.reorder_url`
(a `/market/*` URL that would now 404), and is suppressed for those orders.

---

### 11. `getCookiesStringAction` is a server action that returns every cookie

**Where:** [`app/actions/cookie-store.ts:11`](../app/actions/cookie-store.ts).
The file is `"use server"`, and:

```ts
export async function getCookiesStringAction(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.toString();
}
```

`cookieStore.toString()` includes the httpOnly `access_token` and
`admin_access_token`.

**Why it must be addressed:**

- A `"use server"` export is a callable endpoint, addressed by an action ID.
  Today no client component imports this module — the five importers
  ([`http.service.ts`](../services/base/http.service.ts),
  [`actions/auth-server.ts`](../actions/auth-server.ts),
  [`actions/admin-server.ts`](../actions/admin-server.ts), and two server
  pages) are all server-side, so no ID is emitted into the client manifest and
  there is no live exposure.
- But the guard is *absence of an import*, not a boundary. The moment any
  client component imports `http.service.ts` — an easy mistake, since it is a
  generic-looking service base class with no `import "server-only"` — the
  action ID ships, and the browser gains an endpoint that returns httpOnly
  session cookies as a plain string. That defeats the entire point of the
  httpOnly flag that [`AGENTS.md`](../AGENTS.md) mandates.
- These functions are *reads*. They do not need to be actions at all; they are
  actions only because the module was written as one.

**How to fix:**

1. Split the module. Move `getCookieAction` and `getCookiesStringAction` into
   `lib/server/cookies.ts` with `import "server-only"` at the top, as plain
   async functions. Keep `setCookieAction` / `deleteCookieAction` in the
   `"use server"` file — mutations legitimately need to be actions.
2. Add `import "server-only"` to
   [`services/base/http.service.ts`](../services/base/http.service.ts) and to
   the service modules under `services/api/`. The build will then fail loudly
   if a client component ever imports one, instead of silently widening the
   attack surface.
3. `lib/zone-storefront-feature.ts`, `lib/storefront-cart-cookie.ts` and
   `lib/server/dashboard-request-cache.ts` already do this correctly — follow
   that precedent.

**Resolution — this was live, not latent.** The review said "no client
component imports this module today". That was wrong: six client components
imported API service *values* (`tenantsService`, `merchantDirectoryService`,
`adminService`), each of which pulls in `HttpService` → `app/actions/cookie-store`.
The action IDs were therefore already in the browser bundle, and
`getCookiesStringAction` was a reachable endpoint returning the httpOnly
`access_token`.

Fixed in three parts:
1. Cookie *reads* moved to `lib/server/cookies.ts` (`server-only`, plain
   functions). Cookie *writes* stay actions in `actions/cookie-actions.ts`.
   `app/actions/cookie-store.ts` is deleted.
2. The six client components now call server actions instead of services — new
   `actions/merchant-directory-actions.ts`, plus `updateOnboardingProgressAction`,
   `updatePaymentMethodsAction`, `saveOnboardingDeliverySettingsAction` and
   `updateTenantCategoryAction`.
3. `services/base/http.service.ts` is `server-only`, so a future client import
   fails the build instead of silently re-opening the hole.

`app/(dashboard)/merchant/onboarding/page.tsx` was a `"use client"` page — a
direct violation of the project's own rule — and is now a server component that
fetches the tenant, handles the redirects, and renders
`_components/OnboardingWizard.tsx`.

---

### 12. Three PWA manifest route handlers are referenced by nothing

**Where:** `app/pwa/storefront/[slug]/manifest/route.ts`,
`app/pwa/zone-storefront/[slug]/manifest/route.ts`,
`app/pwa/stores-directory/manifest/route.ts`.

Every `manifest:` in the codebase points somewhere else:

| Consumer | Value |
|---|---|
| [`lib/customer-pwa.ts:11`](../lib/customer-pwa.ts) | `/pwa/customer/manifest` |
| [`app/(public)/[slug]/page.tsx:128`](../app/(public)/[slug]/page.tsx) | `CUSTOMER_PWA.manifestPath` |
| [`app/(public)/market/[zoneSlug]/page.tsx:44`](../app/(public)/market/[zoneSlug]/page.tsx) | `CUSTOMER_PWA.manifestPath` |
| [`app/(dashboard)/admin/layout.tsx:16`](../app/(dashboard)/admin/layout.tsx) | `/pwa/admin/manifest` |
| [`app/(dashboard)/merchant/(features)/layout.tsx:12`](../app/(dashboard)/merchant/(features)/layout.tsx) | `/pwa/merchant/manifest` |

**Why it must be addressed:**

- `app/pwa/storefront/[slug]/manifest/route.ts` builds a per-store manifest with
  the store's own name, icon and `start_url` — clearly the intended behaviour
  for "install this shop as an app". The storefront page links the *generic*
  customer manifest instead, so installing from a store produces a generic
  "تجارتك" icon. Either the feature was never wired up or a refactor dropped it.
- The handler still calls `tenantsService.getPublicTenant(slug)` and has no
  `Cache-Control`, so any crawler or scanner probing `/pwa/storefront/*/manifest`
  causes an uncached backend call.

**How to fix:**

1. Decide whether per-store install identity is wanted. If yes, set
   `manifest: \`/pwa/storefront/${slug}/manifest\`` in the storefront's
   `generateMetadata` and the zone equivalent in the market page.
2. If not, delete all three route handlers.
3. For whichever handlers remain, add a `Cache-Control` header —
   `public, max-age=3600, stale-while-revalidate=86400` is appropriate for a
   manifest.

**Resolution:** All three deleted (`pwa/storefront/[slug]`,
`pwa/stores-directory`, and `pwa/zone-storefront` with the zone feature).

**Worth revisiting:** `pwa/storefront/[slug]/manifest` was a working per-store
manifest — store name, own icon, own `start_url` — that nothing ever linked, so
installing from a storefront produces a generic "تجارتك" icon. Deleting was the
no-behaviour-change option; if per-store install identity is wanted, the handler
is one `git revert` away and needs one line in the storefront's
`generateMetadata`.

---

### 13. Sentry demo page and demo API route shipped to production

**Where:** [`app/api/sentry-example-api/route.ts`](../app/api/sentry-example-api/route.ts)
and [`app/sentry-example-page/page.tsx`](../app/sentry-example-page/page.tsx) —
both scaffolded by the Sentry wizard and never removed.

**Why it must be addressed:**

- The route handler throws unconditionally on every `GET`, with no auth:

  ```ts
  export function GET() {
    Sentry.logger.info("Sentry example API called");
    throw new SentryExampleAPIError("This error is raised on the backend...");
  }
  ```

  Anyone can curl `https://www.tijaratk.com/api/sentry-example-api` in a loop
  and generate unbounded Sentry events. On a paid Sentry plan that is a billing
  problem; on any plan it is alert noise that buries real errors.
- The page is a client component with no metadata, using `next/head` (finding
  7e), and it is not in `robots.ts`'s disallow list — `/api/` is, but
  `/sentry-example-page` is not, so it is crawlable.

**How to fix:**

1. Delete both files. Sentry is verified — [`instrumentation-client.ts`](../instrumentation-client.ts),
   [`sentry.server.config.ts`](../sentry.server.config.ts) and
   [`sentry.edge.config.ts`](../sentry.edge.config.ts) are configured and the
   `tunnelRoute` is live.
2. If a smoke-test hook is genuinely wanted, gate it on
   `process.env.NODE_ENV !== "production"`.

**Resolution:** Both deleted. `app/dummy-storefront/` went too — a design mock
in the production route tree with hot-linked `googleusercontent.com` images and
an icon font that was never loaded.

---

### 14. No `viewport` export, so no `theme-color` meta tag

**Where:** no file in the project exports `viewport`. Every manifest route
declares `theme_color: "#0F5A3D"` and `background_color: "#F7F8F6"` — see
[`app/pwa/storefront/[slug]/manifest/route.ts`](../app/pwa/storefront/[slug]/manifest/route.ts).

**Why it must be addressed:**

- The manifest `theme_color` only applies to an *installed* PWA. For a browser
  tab, the `<meta name="theme-color">` tag is what colours the Android Chrome
  toolbar and the iOS Safari surface. Without it, a customer opening a store
  link sees default browser chrome, then a branded one only after installing —
  an inconsistency on the primary mobile flow for a mobile-first product.
- In Next 16, `themeColor` in the `metadata` export is not supported; it must be
  in the separate `viewport` export. Anyone adding it to `metadata` will get a
  build warning and no tag, so the correct location is worth documenting.

**How to fix:**

Add to [`app/layout.tsx`](../app/layout.tsx):

```ts
import type { Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#0F5A3D",
  colorScheme: "light",
};
```

Next already injects a sensible default `width=device-width, initial-scale=1`,
so no `width`/`initialScale` override is needed unless a specific behaviour is
wanted.

**Resolution:** `app/layout.tsx` exports
`viewport = { themeColor: "#0F5A3D", colorScheme: "light" }`.

---

### 15. The sitemap covers 12 of the site's indexable routes

**Where:** [`app/sitemap.ts`](../app/sitemap.ts) maps `publicMarketingPages`
from [`lib/marketing-seo.ts:11`](../lib/marketing-seo.ts) — 12 entries, all
static marketing pages.

**Why it must be addressed:**

- Missing entirely: every merchant storefront `/[slug]`, and every directory
  page `/stores/[areaSlug]/[categorySlug]`. Those are the pages built *for*
  organic discovery — `generateMetadata` on the directory page consumes a
  backend-supplied `page.seo.title` and `page.seo.canonicalUrl`, and
  [`app/stores/[areaSlug]/[categorySlug]/page.tsx`](../app/stores/[areaSlug]/[categorySlug]/page.tsx)
  emits `CollectionPage` + `ItemList` + `BreadcrumbList` JSON-LD. All that
  structured-data work is being done for pages a crawler has to find by luck.
- Also missing: `/terms`, `/privacy`, `/return-policy`. These three build their
  metadata inline rather than through `createPublicMetadata`
  ([`lib/marketing-seo.ts:206`](../lib/marketing-seo.ts)), so they also have no
  `openGraph` or `twitter` tags — a shared policy link posted to WhatsApp
  renders with no preview card.
- No entry has `lastModified`, so crawlers get no recrawl signal.

**How to fix:**

1. Make `sitemap.ts` `async` and append the dynamic routes. `storesDirectoryService.getLanding()`
   already returns the area/category matrix used to build the directory; a
   backend endpoint listing published storefront slugs would cover `/[slug]`.
2. Add `/terms`, `/privacy`, `/return-policy` to `publicMarketingPages` and
   switch those three pages to `createPublicMetadata` so they gain OG/Twitter
   tags for free.
3. Add `lastModified` — the backend's `updated_at` for dynamic entries, build
   time for static ones.

**Resolution:** `app/sitemap.ts` is async, adds `lastModified` to every entry,
and expands the area × category matrix from `storesDirectoryService.getLanding()`
into `/stores/<area>/<category>` entries (daily, 0.7), with a 24-hour
`revalidate`. `/terms`, `/privacy` and `/return-policy` joined
`publicMarketingPages` and now build metadata through `createPublicMetadata`, so
they also gained OG and Twitter tags.

**Not done:** individual storefronts `/[slug]` are still absent — there is no
endpoint that lists published slugs. That needs a backend addition.

---

### 16. `Logo` downloads two images and hides one with CSS

**Where:** [`components/ui/Logo.tsx`](../components/ui/Logo.tsx) — the `auto`
variant (the default) returns:

```tsx
<Image src="/tijaratk-logo-suite/horizontal-logo-light.png" className={cn("dark:hidden", className)} />
<Image src="/tijaratk-logo-suite/horizontal-logo-dark.png"  className={cn("hidden dark:block", className)} />
```

The `icon` variant does the same with the app icons.

**Why it must be addressed:**

`dark:hidden` hides an element visually; it does not stop the browser
fetching its `src`. Every page rendering a logo — the public header, the public
footer, the offline page, both dashboard shells — pays for two image requests
and two decodes where one is displayed. On the storefront, that competes with
the LCP element for early bandwidth on a mobile connection.

**How to fix:**

1. Replace the double-`<Image>` pattern with a single `<picture>` and a
   `<source media="(prefers-color-scheme: dark)">`, so the browser fetches one
   file.
2. Or, since the app is currently light-only (`<html>` carries no dark-mode
   toggle and `globals.css` defines no dark palette), drop the dark variants
   entirely and render one `<Image>`. This is the simpler change and matches
   how the app actually renders today.
3. Add `priority` where the logo is the LCP candidate — the offline page and
   the public header above the fold.

**Resolution:** `Logo` renders exactly one `<Image>`. `auto` resolves to the
light asset, consistent with the `colorScheme: "light"` the root viewport now
declares; `dark` / `icon-dark` remain for callers on dark surfaces. Also added an
optional `priority` prop for above-the-fold use.

**Behaviour change:** a visitor with OS dark mode used to get the dark logo. They
now get the light one — which is the correct pairing, since the app renders light
surfaces regardless of OS preference.

---

### 17. Eight files over 700 lines, three over 1,400

**Where:**

| File | Lines | Note |
|---|---|---|
| [`app/(public)/[slug]/_components/OrderForm.tsx`](../app/(public)/[slug]/_components/OrderForm.tsx) | 2,446 | see finding 10 — delete rather than split |
| [`actions/admin-server.ts`](../actions/admin-server.ts) | 2,278 | every admin mutation in one module |
| [`app/(dashboard)/merchant/(features)/products/new/_components/ProductOnboardingClient.tsx`](../app/(dashboard)/merchant/(features)/products/new/_components/ProductOnboardingClient.tsx) | 1,835 | 1,501-line component body |
| [`services/api/admin.service.ts`](../services/api/admin.service.ts) | 1,457 | one class, every admin endpoint |
| [`app/(public)/[slug]/_components/ProductList.tsx`](../app/(public)/[slug]/_components/ProductList.tsx) | 1,249 | six sub-components in one file |
| [`app/about/page.tsx`](../app/about/page.tsx) | 972 | 936-line JSX return |
| [`app/(dashboard)/merchant/(features)/orders/[id]/_components/OrderItemsReplacement.tsx`](../app/(dashboard)/merchant/(features)/orders/[id]/_components/OrderItemsReplacement.tsx) | 937 | |
| [`components/pwa/CustomerPwaEngagement.tsx`](../components/pwa/CustomerPwaEngagement.tsx) | 893 | see finding 6 |
| [`app/(dashboard)/admin/categories/page.tsx`](../app/(dashboard)/admin/categories/page.tsx) | 784 | holds the codebase's only `sonarjs/cognitive-complexity` suppression, at [`:230`](../app/(dashboard)/admin/categories/page.tsx) |

**Why it must be addressed:**

Size alone is not a defect, and several of these are legitimately long-but-flat
(the marketing page is 936 lines of static JSX; splitting it into sections buys
readability but no behaviour). The ones that matter are where size tracks
*state*, because that is what makes a file hard to change safely:
`OrderForm` (~30 `useState`), `ProductOnboardingClient` (1,501-line body),
`OrderItemsReplacement`, `CustomerPwaEngagement`.

`admin-server.ts` and `admin.service.ts` are a different problem — they are
flat lists of functions, so they are readable, but at 2,278 and 1,457 lines
every admin feature touches the same two files, which makes them a permanent
merge-conflict hotspot.

The single suppressed `cognitive-complexity` warning is worth resolving on its
own merits: it is the one place the linter was overruled rather than satisfied.

**How to fix:**

1. `OrderForm.tsx` — resolve via finding 10.
2. `admin-server.ts` → split by resource into `actions/admin/merchants.ts`,
   `actions/admin/orders.ts`, `actions/admin/zones.ts`, `actions/admin/catalog.ts`,
   re-exported from an `actions/admin/index.ts` so imports do not churn. Same
   split for `services/api/admin.service.ts`.
3. `ProductOnboardingClient.tsx` — extract the step bodies into sibling
   components and lift the shared state into a single reducer. `_utils/product-onboarding.ts`
   (438 lines) already exists as the home for the pure logic.
4. `ProductList.tsx` — it already contains six well-named sub-components
   (`QuantitySelectionControls`, `WeightSelectionControls`,
   `PriceSelectionControls`, `InlineCustomEditor`, `ProductSelectionControls`,
   `ProductListCard`). Move each to its own file; this is a near-mechanical
   change.
5. `app/about/page.tsx` — extract each `<section>` into
   `app/about/_components/`. Low value, do it opportunistically.
6. `admin/categories/page.tsx:231` — extract the branching that triggered the
   suppression into named helpers and remove the `eslint-disable`.

**Resolution — partial, and deliberately so.** `OrderForm.tsx` (2,446) is gone
with the zone feature, and `actions/admin-server.ts` dropped from 2,278 to ~1,750
once the zone actions were removed. `app/(public)/[slug]/_utils/order-form.ts`
lost four exports that only `OrderForm` used.

The rest were **not** split. `ProductOnboardingClient.tsx` (1,835),
`admin.service.ts` (~1,300), `ProductList.tsx` (1,249),
`OrderItemsReplacement.tsx` (937) and `admin/categories/page.tsx` (784, still
holding the one `sonarjs/cognitive-complexity` suppression) are mechanical but
wide-reaching refactors with real regression surface and no behavioural payoff.
They belong in their own change, reviewed on their own. Splitting them inside a
diff that already touches 143 files would make both harder to review.

---

## P3 — Cleanups

**Structural drift.** Two server-action directories: `actions/` (14 files,
6,082 lines) and `app/actions/` (one file). Two hooks directories: `hooks/`
(one file) and `lib/hooks/` (three files). Consolidate to `actions/` and
`lib/hooks/`; note that `app/actions/cookie-store.ts` is being split anyway
under finding 11.

**`AGENTS.md` is stale in three places.** It mandates Zustand for state
management and forbids the Context API — Zustand is not in
[`package.json`](../package.json), and `createContext` is used in
[`CustomerPwaEngagement.tsx`](../components/pwa/CustomerPwaEngagement.tsx) and
[`PushNotificationsControl.tsx`](../components/pwa/PushNotificationsControl.tsx).
It documents `npm run prettier` and `npx eslint`, but there is no Prettier
dependency and `lint` is `eslint && tsc --noEmit && node scripts/check-next16-request-apis.mjs`.
It says "do not focus on SEO optimization methodologies" while the app has a
substantial and deliberate public SEO surface. Guidance a reader cannot trust is
worse than no guidance — either install Zustand or amend the document.

**`STORAGE_KEYS` is missing `as const`.** [`constants/index.ts:1`](../constants/index.ts)
— `AGENTS.md` requires `as const` for static maps, and without it the values
widen to `string`, losing the literal types at every call site.

**`credentials: "include"` is meaningless server-side.**
[`services/base/http.service.ts:266`](../services/base/http.service.ts). Remove
it alongside finding 2.

**`dir="rtl"` is repeated on 26 elements** under an `<html dir="rtl">`
([`app/layout.tsx:99`](../app/layout.tsx)). Harmless, but it suggests
uncertainty about whether the root direction is applying. Remove the redundant
ones; keep the deliberate `dir="ltr"` overrides such as
[`ZoneStorefrontHome.tsx:116`](../components/zone-storefronts/ZoneStorefrontHome.tsx).

**Poppins is loaded for one usage.** [`app/layout.tsx:17`](../app/layout.tsx)
declares the font and `globals.css:5` maps it to `--font-latin`, which is used
by exactly one element. `preload: false` keeps the cost near zero, so this is
informational — either commit to a Latin type ramp or drop the font.

**`app/dummy-storefront/page.tsx`** ships images hot-linked from
`lh3.googleusercontent.com`, an inline `<style dangerouslySetInnerHTML>`, a
file-level `eslint-disable @next/next/no-img-element`, and
`material-symbols-outlined` icon classes for a font that is never loaded — so
those icons render as literal text. It is correctly `noindex`, but it is a
design mock living in the production route tree. Move it behind a
`NODE_ENV !== "production"` guard or delete it.

**Route-level `dynamic = "force-dynamic"` is applied broadly** — 33 files.
That is correct for the authenticated dashboards. But once findings 1 and 2
land, re-check `app/(public)/track-order/[token]/page.tsx` and
`app/(public)/track-orders/page.tsx`: they are cookie-driven, so they will be
dynamic anyway, and the explicit export becomes redundant noise.

---

## Suggested order

1. **Finding 2**, then **finding 1**. In that order — fixing the root layout
   alone will not make anything static while `HttpService` still reads cookies
   on every public fetch. Together they are the difference between four
   prerendered routes and roughly twenty.
2. **Findings 5, 3, 9, 13** — small, isolated, no regression surface.
3. **Findings 7, 14, 15** — the metadata and SEO pass, done as one change.
4. **Findings 6, 8** — the client-boundary pass on the root layout.
5. **Finding 4** — `loading.tsx` and `Suspense`; do it after 1 and 2 so the
   skeletons are designed against the new render behaviour.
6. **Finding 10** — the zone-storefront decision. Needs a product call before
   any code moves.

---

## Verification

No code has been changed by this review. To confirm the two anchor measurements:

```bash
cd frontend && node -e "const m=require('./.next/prerender-manifest.json');console.log('static routes:',Object.keys(m.routes))"
```

```bash
du -h frontend/public/tijaratk-logo-suite.zip frontend/public/logo.png frontend/public/images/hero-mockup.png
```

After the P0 fixes, the same prerender-manifest command should list the static
marketing pages. Per `AGENTS.md` the build, lint and typecheck commands are for
you to run:

```bash
cd frontend && pnpm run lint
```

```bash
cd frontend && pnpm run build
```

Manual checks that carry real regression risk after finding 2:

- Merchant: login → dashboard → orders → order detail → settings.
- Admin: login → merchants → tenant manage → orders.
- Customer: storefront → cart → checkout → success → track order.
