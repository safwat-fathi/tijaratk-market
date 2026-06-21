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

WhatsApp providers:

- `ACCOUNT_SID`: Twilio account SID.
- `AUTH_TOKEN`: Twilio auth token.
- `WHATSAPP_PHONE_NUMBER`: Twilio WhatsApp sender number.

Twilio Content Template SIDs:

- `TWILIO_CONTENT_SID_ORDER_RECEIVED_CUSTOMER`
- `TWILIO_CONTENT_SID_ORDER_OUT_FOR_DELIVERY`
- `TWILIO_CONTENT_SID_ORDER_STATUS_UPDATE_CUSTOMER`
- `TWILIO_CONTENT_SID_NEW_ORDER_MERCHANT`
- `TWILIO_CONTENT_SID_MERCHANT_REPLACEMENT_REJECTED`
- `TWILIO_CONTENT_SID_MERCHANT_REPLACEMENT_ACCEPTED`
- `TWILIO_CONTENT_SID_ORDER_PRODUCT_REPLACEMENT`
- `TWILIO_CONTENT_SID_MERCHANT_DAY_CLOSURE_SUMMARY`

Seed data:

- `SEED_SUPERMARKET_OWNER_CREDENTIAL`: Seed credential payload for the supermarket merchant owner.

## Running Locally

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

```bash
pnpm run lint
pnpm run lint:ci
pnpm run test:e2e
```

`test:e2e` currently delegates to the security e2e flow.

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
