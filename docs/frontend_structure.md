# Tijaratk Frontend Application Structure

This document outlines the directory structure, architecture, and design patterns of the Tijaratk frontend application.

The frontend is a **Next.js 16 (App Router)** application written in **TypeScript** using **React 19** and styled with **TailwindCSS 4**.

---

## Codebase Directory Tree

```
frontend/
├── actions/                         # Business logic Server Actions
│   ├── admin-server.ts              # Admin portal operations
│   ├── auth-server.ts               # Merchant and system authentication
│   ├── availability-request-cookie-actions.ts
│   ├── customer-actions.ts          # Customer profile actions
│   ├── order-actions.ts             # Merchant order updates & actions
│   ├── order-tracking-actions.ts    # Customer order tracking updates
│   ├── product-actions.ts           # Product details/catalog management
│   └── tenant-actions.ts            # Merchant shop/tenant settings
├── app/                             # Next.js App Router (pages and layouts)
│   ├── (dashboard)/                 # Protected portal layouts
│   │   ├── admin/                   # SaaS platform administration
│   │   │   ├── login/
│   │   │   ├── merchants/
│   │   │   ├── plans/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   └── merchant/                # Merchant management portal
│   │       ├── (auth)/              # Register/Login routes
│   │       │   ├── login/
│   │       │   └── register/
│   │       └── (features)/          # Operations features
│   │           ├── customers/       # Customer base overview
│   │           ├── orders/          # Live orders management
│   │           ├── products/        # Product inventory details
│   │           ├── settings/        # Store details & config
│   │           └── page.tsx
│   ├── (public)/                    # Public storefront routes
│   │   ├── [slug]/                  # Dynamic merchant storefront (e.g. /my-bakery)
│   │   │   ├── success/             # Successful checkout page
│   │   │   └── page.tsx
│   │   ├── track-order/             # Order tracker loader
│   │   └── track-orders/            # Order list tracker
│   ├── actions/                     # App-specific helpers
│   │   └── cookie-store.ts          # Server actions for cookies
│   ├── api/                         # Backend route handers
│   │   └── auth/session/revoke/     # Auth cookie clearance endpoints
│   ├── about/                       # Standard informational static pages
│   ├── contact/                     # Platform contact page
│   ├── features/                    # Platform features description page
│   ├── pricing/                     # Platform pricing plans comparison
│   ├── layout.tsx                   # Root HTML shell (RTL alignment)
│   ├── page.tsx                     # Tijaratk platform landing page
│   └── globals.css                  # Main CSS stylesheet
├── components/                      # Shared reusable UI elements
│   ├── layout/                      # Layout components (e.g. PublicFooter.tsx)
│   ├── marketing/                   # Marketing widgets (e.g. PublicPageShell.tsx)
│   └── ui/                          # Low-level UI primitives (buttons, inputs)
├── constants/                       # Constants configuration
│   ├── index.ts                     # Main entrypoint
│   └── tenant-categories.ts         # Categories values & translations
├── lib/                             # Shared libraries and utility folders
│   ├── auth/                        # Auth verification & error mapping
│   ├── hooks/                       # Custom React hooks (body lock, swipe to close)
│   ├── tracking/                    # Cookie state managers for customer carts
│   ├── utils/                       # Generic formatters (date, currency, phone)
│   └── validations/                 # Zod validation schemas
├── services/                        # Backend API communication layer
│   ├── base/                        # Main fetch abstraction layer
│   │   ├── http.service.ts          # Handles headers, cookies, token refresh
│   │   └── index.ts
│   └── api/                         # NestJS endpoint mapping clients
│       ├── admin.service.ts
│       ├── auth.service.ts
│       ├── availability-requests.service.ts
│       ├── customers.service.ts
│       ├── orders.service.ts
│       ├── products.service.ts
│       └── tenants.service.ts
└── types/                           # TypeScript types and definitions
    ├── models/                      # Backend entity maps
    │   ├── customer.ts
    │   ├── order.ts
    │   ├── product.ts
    │   ├── tenant.ts
    │   └── user.ts
    └── services/                    # Payload interface maps
```

---

## Architectural Layers Explained

### 1. The Route Routing Model (`app/`)
Routing uses Next.js App Router folders separated into specific route groups:
* **`(dashboard)`**: Contains administration workspaces. It splits into `/admin` (SaaS owner overview) and `/merchant` (merchant operational portal).
* **`(public)`**: Holds client-facing experiences. The central entry point is the dynamic `/[slug]` directory representing individual shop catalogs. It also contains `/track-order` for order history delivery tracking.
* **Standard Pages**: Paths like `/pricing`, `/about`, `/features`, and `/contact` are server-rendered static and marketing pages.

### 2. UI Component Architecture (`components/`)
Components are divided into three clean layout tiers:
* **`components/ui/`**: Core reusable visual elements (e.g., `Button.tsx`, `BottomSheet.tsx`, `Field.tsx`). Built to support dynamic tailwind properties.
* **`components/layout/`**: Structural components shared across pages (e.g., `PublicFooter.tsx`).
* **`components/marketing/`**: Layout wrappers specific to platform-level sales flows (e.g., `PublicPageShell.tsx`).

### 3. API Communication Layer (`services/`)
Communicating with the NestJS backend API is designed around service classes:
* **`services/base/http.service.ts`**: The base wrapper class encapsulating standard fetch API requests. It dynamically handles base URLs, auth token transmission, response serialization, and error trapping.
* **`services/api/`**: Service modules representing discrete business entities (e.g., `orders.service.ts` queries the backend endpoints for order status changes).

### 4. Mutation and Data Updates (`actions/`)
All application actions that update database states or sessions are handled through **Next.js Server Actions**:
* Located in the `frontend/actions/` folder.
* Validate inputs using **Zod** schema sets found in `lib/validations/`.
* Invoke backend methods through the service class instances.
* Perform cache invalidations using `revalidatePath` to trigger fresh page re-rendering in Next.js.

### 5. Utility Helpers (`lib/`)
* **`lib/tracking/`**: Client side cookie persistence managers to track cart products (`customer-tracking-cookie.ts`) or user interest targets (`availability-request-cookie.ts`).
* **`lib/hooks/`**: Handles mobile UX custom micro-interactions like dragging down sheets (`useDragToClose.ts`) or scroll overlays (`useBodyScrollLock.ts`).
* **`lib/utils/`**: Shared functions for standard conversions like formatting currency values to Arabic and displaying local phone formats.

---

## Key Development Design Patterns

1. **Server-First Components**: Pages are server-side components by default to ensure fast response speeds and minimize layout shift. Interactive inputs are split into client-side child fragments (demarcated with `'use client'`).
2. **Arabic Translation Standard**: Tijaratk is localized in Arabic. The main `layout.tsx` is configured with `dir="rtl"` and standard strings are written in Arabic.
3. **No client-side Fetching**: All database lookups go through Server Components or Server Actions, fetching data using services before loading client elements.
4. **Zustand State Rule**: As per development guidelines, Zustand stores should be used if complex global client states are introduced, avoiding standard React Context wrappers.
