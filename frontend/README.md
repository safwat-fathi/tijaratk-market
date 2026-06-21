# Tijaratk Frontend (v0.7.0)

Frontend application for Tijaratk, an Arabic-first SaaS that helps local merchants receive structured orders through WhatsApp-linked storefronts and manage daily store operations from a seller dashboard.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- TailwindCSS 4
- Zod
- Server Actions
- Server-side API services

## Requirements

- Node.js 20 or compatible local runtime
- pnpm
- Running Tijaratk backend API

## Setup

```bash
pnpm install
cp .env.example .env.local
```

Set the backend API URL in `.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:<backend-port>
```

Use the same backend port configured by `HTTP_SERVER_PORT` in the backend environment.

## Running Locally

```bash
pnpm dev
```

Open `http://localhost:3000` in the browser.

Production-style local run:

```bash
pnpm build
pnpm start
```

## Quality Checks

```bash
pnpm lint
pnpm type-check
```

`pnpm lint` runs ESLint and TypeScript checking.

## Main Routes

- `/`: Arabic landing page.
- `/about`: Public product/about page.
- `/merchant/login`: Merchant login.
- `/merchant/register`: Merchant registration.
- `/merchant`: Merchant dashboard.
- `/merchant/orders`: Merchant order list and filtering.
- `/merchant/orders/[id]`: Merchant order details and order actions.
- `/merchant/customers`: Customer list and customer details.
- `/merchant/products/new`: Product onboarding and catalog management (manual creation, catalog search, and the new **Bulk Essential Items Wizard**).
- `/[slug]`: Public merchant storefront.
- `/track-orders`: Public order tracking entry point.
- `/track-order/[token]`: Public order tracking details.

## Project Structure

- `app`: App Router pages, layouts, route groups, route handlers, and server actions.
- `app/(dashboard)`: Merchant authentication and protected dashboard routes.
- `app/(public)`: Public storefront and order tracking routes.
- `components`: Shared UI components.
- `constants`: Reusable constant maps and app constants.
- `lib`: Shared framework utilities and auth helpers.
- `middlewares`: Middleware composition utilities.
- `services/api`: Backend API service classes.
- `services/base`: Shared HTTP service abstraction.
- `services/bff`: Composed backend-for-frontend service logic when needed.
- `styles`: Shared styling assets.
- `types`: Shared TypeScript models and service types.
- `utilities`: Shared utility functions.

## API Access Pattern

Backend communication should go through service classes under `services/api`. Shared request behavior lives in `services/base/http.service.ts`.

Important conventions:

- Fetch data on the server when possible.
- Do not fetch protected backend data directly from client components.
- Read auth cookies on the server side only.
- Pass server-fetched data into client components as props when interactivity is needed.
- Use Server Actions for form submissions where possible.

## UI And Product Notes

- The application is Arabic-first and uses `dir="rtl"` at the root layout.
- Fonts are loaded through `next/font` using IBM Plex Sans Arabic and Poppins.
- TailwindCSS is the styling system.
- Prefer existing shared components before creating new ones.
- Keep merchant workflows optimized for operations, not SEO-heavy content pages.
- **Bulk Essential Wizard**: Displays common essential Egyptian brands (e.g. dairy, beverages) matching localized patterns. It includes bulk selection, search, category filtering, and bulk price modification, automatically tagging added products as requiring price review (`price_needs_review`).

## Development Notes

- Prefer Server Components for pages.
- Use Client Components only for browser interactivity.
- Validate form input with Zod.
- Use type aliases instead of interfaces.
- Avoid storing sensitive data in browser storage.
- Keep file and component names in PascalCase for React components.
- **SafeImage and Local Images**: The `SafeImage` component bypasses next/image optimization (`unoptimized={true}`) for locally-served downloaded images (matching `localhost` or `127.0.0.1`) to prevent Next.js image domain configuration issues during development.
