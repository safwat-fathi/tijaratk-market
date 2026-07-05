# Research: Admin Error Logs

## Decisions
- **Decision**: Use Sentry for both Next.js frontend and NestJS backend.
- **Rationale**: Sentry is the industry standard, provides robust error capturing out-of-the-box, has official SDKs for both frameworks (`@sentry/nextjs` and `@sentry/node`), and automatically scrubs PII by default.
- **Alternatives considered**: Datadog (too heavy/expensive for just error logs), Rollbar (less seamless Next.js integration), Custom UI (violates requirement to not change admin UI).
