# Quickstart & Validation: Admin Error Logs

## Prerequisites
- A Sentry account and project DSNs for both frontend and backend.
- `.env.local` configured with `NEXT_PUBLIC_SENTRY_DSN` and backend `.env` configured with `SENTRY_DSN`.

## Validation Scenarios

### 1. Frontend Error Capture
1. Add a temporary button in the frontend admin UI that throws an error when clicked: `throw new Error("Test Frontend Error");`
2. Click the button.
3. Open the Sentry Dashboard and verify the "Test Frontend Error" appears under the frontend project.

### 2. Backend Error Capture
1. Add a temporary endpoint in the backend that throws an exception: `throw new InternalServerErrorException("Test Backend Error");`
2. Call the endpoint.
3. Open the Sentry Dashboard and verify the "Test Backend Error" appears under the backend project.
