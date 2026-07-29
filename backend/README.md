# Tijaratk Backend (v0.7.0)

Backend API for Tijaratk, an operations-first SaaS for local merchants to receive structured WhatsApp-linked orders, manage products and customers, track order status, and send customer/merchant WhatsApp notifications.

## Stack

- NestJS 11
- TypeScript
- Prisma ORM 7
- PostgreSQL
- Swagger/OpenAPI
- JWT authentication with secure cookies
- Twilio WhatsApp messaging
- Zod, class-validator, Helmet, Sharp

## Requirements

- Node.js 22 or compatible local runtime
- pnpm
- PostgreSQL

## Setup

```bash
pnpm install
cp .env.example .env.development
```

Fill `.env.development` with local values before starting the API.

## Environment Variables

Application and server:

- `APP_URL`: Public API URL used by Swagger server metadata.
- `HTTP_SERVER_PORT`: Port used by `main.ts` when starting the HTTP server.
- `CLIENT_URL`: Frontend URL allowed to communicate with the API.

Database:

- `DB_URL`: Full PostgreSQL connection string.

Auth, session, and security:

- `JWT_SECRET`: Access token signing secret.
- `THEME_EDITOR_JWT_SECRET`: Theme editor token signing secret.
- `THEME_EDITOR_PREVIEW_URL`: Theme editor preview URL.
- `THEME_EDITOR_TOKEN_EXPIRES_IN`: Theme editor token lifetime.
- `CSRF_SECRET`: CSRF token secret.
- `SESSION_SECRET`: Session signing secret.
- `ENCRYPTION_PASSWORD`: Encryption password for sensitive values.
- `IP_HASH_SALT`: Salt used when hashing IP-derived identifiers.

Meta Conversions API:

- `META_PIXEL_ID`: Dataset/Pixel ID for the company-level `Tijaratk Sales` data source.
- `META_CAPI_ACCESS_TOKEN`: Server-only token generated in Meta Events Manager.
- `META_GRAPH_API_VERSION`: Required explicit Graph API version (initial rollout example: `v23.0`).
- `META_CAPI_TEST_EVENT_CODE`: Optional temporary Test Events code; remove it after validation.
- `META_CONTEXT_SIGNING_SECRET`: HMAC secret shared with the Next.js server only.
- `ENCRYPTION_PASSWORD`: Required and non-empty whenever CAPI is enabled because retry payloads are encrypted at rest.

The Meta outbox worker runs in each API process, coordinates claims with
`FOR UPDATE SKIP LOCKED`, and delivers events after the order transaction has
committed. Delivery failures never change an order result.

Web Push notifications:

- `PUSH_NOTIFICATIONS_ENABLED`: Feature switch. Deploy migrations and configuration with this set to `false` before enabling delivery.
- `PUSH_VAPID_PUBLIC_KEY`: Stable VAPID public key exposed to subscribed browsers.
- `PUSH_VAPID_PRIVATE_KEY`: Stable server-only VAPID private key.
- `PUSH_VAPID_SUBJECT`: A `mailto:` or HTTPS contact URI used by push services.
- `ENCRYPTION_PASSWORD`: Required and non-empty whenever Web Push is enabled because subscription endpoints and keys are encrypted at rest.

Generate the VAPID key pair once, keep it stable across deployments, and never
expose the private key to the frontend. The Web Push outbox worker uses
`FOR UPDATE SKIP LOCKED`, bounded retry, and sanitized error codes; delivery
does not change the order creation result.

When Web Push is enabled, a successful public merchant signup queues a
privacy-minimized event in the signup transaction. Only active platform
administrators with a current device subscription receive the registration
alert; operations administrators are intentionally excluded.

WhatsApp providers:

- `ACCOUNT_SID`: Twilio account SID.
- `AUTH_TOKEN`: Twilio auth token.
- `WHATSAPP_PHONE_NUMBER`: Twilio WhatsApp sender number.
- `WEBHOOK_PUBLIC_BASE_URL`: Optional public API origin used for Twilio webhook
  signatures and outbound status callbacks; falls back to `APP_URL`.

Twilio Content Template SIDs:

- `TWILIO_CONTENT_SID_ORDER_OUT_FOR_DELIVERY`
- `TWILIO_CONTENT_SID_ORDER_STATUS_UPDATE_CUSTOMER`
- `TWILIO_CONTENT_SID_NEW_ORDER_MERCHANT`
- `TWILIO_CONTENT_SID_MERCHANT_REPLACEMENT_REJECTED`
- `TWILIO_CONTENT_SID_MERCHANT_REPLACEMENT_ACCEPTED`
- `TWILIO_CONTENT_SID_ORDER_PRODUCT_REPLACEMENT`
- `TWILIO_CONTENT_SID_MERCHANT_DAY_CLOSURE_SUMMARY`

Proactive WhatsApp notifications are template-only. Missing or rejected
Content Templates are logged and are not retried as plaintext messages.

Seed data:

- `SEED_SUPERMARKET_OWNER_CREDENTIAL`: Seed credential payload for the supermarket merchant owner.

## Running Locally

> AI agents: these commands are documented for human developers only. Do not run them. If verification is needed, ask the user to run the relevant command and share the output.

```bash
pnpm run start:dev
```

Production-style local run:

```bash
pnpm run build
pnpm run start:prod
```

## API Documentation

Swagger is mounted by the API at:

- `/docs`: Swagger UI
- `/docs/json`: OpenAPI JSON document

The Swagger server URL is derived from `APP_URL`.

## Prisma And Database

> AI agents: these commands are documented for human developers only. Do not run them. If verification is needed, ask the user to run the relevant command and share the output.

Prisma is the current database layer for the backend.

Key files:

- `prisma/schema.prisma`: Prisma schema and model definitions.
- `prisma.config.ts`: Prisma configuration and database URL resolution.
- `src/prisma/prisma.service.ts`: Global NestJS Prisma service using `@prisma/adapter-pg`.
- `src/prisma/prisma.module.ts`: Global Prisma module.
- `generated/prisma`: Generated Prisma client output path.

The Prisma datasource uses PostgreSQL. The connection URL is read from `DB_URL`.

Useful Prisma commands:

```bash
pnpm prisma:generate
pnpm prisma:reset:dev
pnpm prisma:migrate dev
pnpm prisma:migrate:deploy
pnpm prisma:studio
```

### Database Reset & Permissions Grant

When resetting the database during development or production migrations, environments with split-privilege users can encounter schema permission errors. To automatically resolve this:

- **Development Reset**: Runs `prisma migrate reset` and automatically executes `src/common/scripts/grant-permissions.ts` to grant all public schema privileges to the app user:
  ```bash
  pnpm run prisma:reset:dev
  ```
- **Production Reset**:
  ```bash
  pnpm run prisma:reset:prod
  ```

Some legacy TypeORM scripts and dependencies may still exist during the migration period. Do not use them as the primary database workflow unless the team explicitly decides to keep them for a specific task.

## Seed Data

Development seed:

```bash
pnpm run seed:dev
```

Production seed:

```bash
pnpm run seed:prod
```

Development-only Sheikh Zayed zone storefront fixture (requires at least 100
distinct active `talabat_csv` catalog products and one active grocery fixture
merchant):

```bash
pnpm run seed:zone:dev
```

Production zone storefronts must be configured through the admin APIs; the
development fixture is intentionally excluded from the general seed commands.

## Catalog Management & Cleanup

### Catalog Source Isolation

Catalog visibility is isolated by tenant category (defined in `src/products/catalog-source-policy.ts`):

- Grocery tenants (`TenantCategory.grocery`) use the supermarket catalog source (`talabat_csv`).
- Pharmacy tenants (`TenantCategory.pharmacy`) use the pharmacy catalog source (`chefaa_csv`).

### Cleanup & Decontamination

To deactivate/cleanup contaminated rows in the catalog (e.g. pharmacy categories showing up in supermarket sources or generic spillover):

- Development:
  ```bash
  pnpm run catalog:cleanup:dev
  ```
- Production:
  ```bash
  pnpm run catalog:cleanup:prod
  ```

## Quality Checks

> AI agents: these commands are documented for human developers only. Do not run them. If verification is needed, ask the user to run the relevant command and share the output.

```bash
pnpm -C backend lint
pnpm -C backend lint:ci
pnpm run test:e2e
```

`test:e2e` currently delegates to the security e2e flow.

### Testing Policy

This backend does not use unit tests. Do not add `*.spec.ts` / `*.test.ts`
files, test frameworks or runners (jest, vitest, playwright, cypress, mocha,
and similar), `test`/`coverage` scripts, or CI test steps.

The security e2e suites in `test/` (`security.e2e-spec.js`,
`zone-storefront.security.e2e-spec.js`) are the single deliberate exception.
Keep them, and do not grow them into a general-purpose test suite. See the
"Testing policy" section in the repository root `AGENTS.md`.

## Meta Rollout

Use `META_CAPI_TEST_EVENT_CODE` while checking consented merchant and zone
orders in Events Manager, including browser/server `Purchase` deduplication by
event ID. Then remove the test code.

Create the reporting conversion manually once in Meta Events Manager:

- Name: `Tijaratk Order Created`
- Data source: `Tijaratk Sales`
- Event and optimization category: `Purchase`
- Rule: `conversion_type` equals `order_created`
- Value: dynamic Purchase value; do not configure a fixed value

Use the standard `Purchase` event—not the custom conversion—as the Sales
campaign optimization event.

## Project Structure

- `src/auth`: Authentication and JWT strategy.
- `src/users`: User persistence and lookup logic.
- `src/tenants`: Tenant lookup and tenant-aware operations.
- `src/products`: Product, catalog, category, pricing, and availability logic.
- `src/orders`: Order lifecycle, replacement decisions, closures, and WhatsApp order notifications.
- `src/customers`: Customer creation, lookup, and order history.
- `src/availability-requests`: Customer product availability interest tracking.
- `src/whatsapp`: WhatsApp provider integration and message templates.
- `src/webhooks`: Incoming webhook handlers.
- `src/common`: Shared filters, decorators, middleware, context, utilities, DTOs, and constants.
- `src/prisma`: Prisma module and service.

## Development Notes

- **Swagger Integration**: Add Swagger decorators to new routes.
- **DTOs**: Keep request and response DTOs typed.
- **Prisma & RLS**: Use Prisma through `PrismaService` or request-bound transaction clients where tenant RLS context is required.
- **Tenant Context**: Keep tenant-aware reads and writes scoped by tenant context.
- **Catalog Image Downloading**: Remote catalog images are downloaded, processed/resized to WebP format using `sharp`, and saved locally. The original URLs are preserved under the `original_image_url` field to prevent duplicate downloads and track syncing.
- **Bulk Onboarding**: Supermarket tenants can onboard essential items in bulk using `POST /products/bulk-essentials` which filters by popular Arabic brands and key categories. Products imported this way default to `price_needs_review = true` to alert the merchant to verify pricing.
- **Error Handling**: Avoid exposing sensitive error details to clients.
