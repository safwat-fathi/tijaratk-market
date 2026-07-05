# Implementation Plan: Admin Error Logs

**Branch**: `002-admin-error-logs` | **Date**: 2026-07-05 | **Spec**: [spec.md](../spec.md)
**Input**: Feature specification from `/specs/002-admin-error-logs/spec.md`

## Summary

Integrate Sentry to capture backend (NestJS) and frontend (Next.js) errors automatically. Provide admins the ability to view these error logs via the external Sentry UI without building a custom UI in the admin dashboard. Configure PII scrubbing in Sentry.

## User Review Required

> [!IMPORTANT]
> The only action needed is to confirm the package choices and setup. No admin UI changes will be made as requested. Sentry DSNs will need to be added to your environment variables.

## Proposed Changes

### Configuration
#### [MODIFY] `.env.example`
- Add placeholders for Sentry DSNs (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`).

### Backend (NestJS)
#### [MODIFY] `backend/package.json`
- Install `@sentry/node` and `@sentry/profiling-node`.
#### [NEW] `backend/src/common/filters/sentry-exception.filter.ts`
- Create a global exception filter to catch all exceptions and send them to Sentry.
#### [MODIFY] `backend/src/main.ts`
- Initialize Sentry during bootstrap and apply the global exception filter.

### Frontend (Next.js)
#### [MODIFY] `frontend/package.json`
- Install `@sentry/nextjs`.
#### [NEW] `frontend/sentry.client.config.ts`
- Configure Sentry for client-side errors.
#### [NEW] `frontend/sentry.server.config.ts`
- Configure Sentry for server-side errors.
#### [NEW] `frontend/sentry.edge.config.ts`
- Configure Sentry for edge functions.
#### [MODIFY] `frontend/next.config.js`
- Wrap the Next.js config with `withSentryConfig` to enable sourcemap uploading (optional depending on whether sourcemaps are desired in dev/prod).

## Verification Plan

### Automated Tests
- Unit test the backend `sentry-exception.filter.ts` to ensure `Sentry.captureException` is called when an error is thrown.

### Manual Verification
- Deliberately throw an error in the frontend and backend, then verify the error appears in your Sentry dashboard.
- Verify that PII (e.g., passwords or auth tokens) are scrubbed in Sentry's dashboard (Sentry handles this automatically by default for common sensitive keys, but we can enable Data Scrubber).
