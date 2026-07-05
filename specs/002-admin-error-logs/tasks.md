# Implementation Tasks: Admin Error Logs

**Feature Branch**: `002-admin-error-logs`
**Spec**: [spec.md](../spec.md)
**Plan**: [plan.md](../plan.md)

## Phase 1: Setup

Goal: Project initialization and environment setup.

- [ ] T001 Update `.env.example` with Sentry DSN placeholders in `/.env.example`
- [ ] T002 Install backend Sentry dependencies (`@sentry/node`, `@sentry/profiling-node`) in `/backend/package.json`
- [ ] T003 Install frontend Sentry dependencies (`@sentry/nextjs`) in `/frontend/package.json`

## Phase 2: Foundational

Goal: Core foundational tasks that block other phases.

(No foundational tasks needed as setup provides the libraries)

## Phase 3: User Story 1 (Access Error Backlog)

Goal: As an administrator, I want to access a centralized view of system error logs from the external error tracking UI (e.g., Sentry) so that I can quickly monitor the application's health.

- [ ] T004 [US1] Create global Sentry exception filter for backend in `/backend/src/common/filters/sentry-exception.filter.ts`
- [ ] T005 [US1] Register exception filter in backend bootstrap in `/backend/src/main.ts`
- [ ] T006 [P] [US1] Configure Sentry for Next.js client-side in `/frontend/sentry.client.config.ts`
- [ ] T007 [P] [US1] Configure Sentry for Next.js server-side in `/frontend/sentry.server.config.ts`
- [ ] T008 [P] [US1] Configure Sentry for Next.js edge in `/frontend/sentry.edge.config.ts`
- [ ] T009 [US1] Update Next.js config with Sentry wrapper in `/frontend/next.config.js`

## Phase 4: Polish

Goal: Polish and cross-cutting concerns.

- [ ] T010 Test error tracking manually by throwing test errors in frontend and backend.
