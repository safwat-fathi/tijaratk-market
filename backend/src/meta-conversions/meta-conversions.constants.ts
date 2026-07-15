export const META_MARKETING_CONSENT_COOKIE =
  'tijaratk_marketing_consent';
export const META_CONTEXT_HEADER = 'x-tijaratk-meta-context';
export const META_CONTEXT_SIGNATURE_HEADER =
  'x-tijaratk-meta-context-signature';
export const META_CONTEXT_MAX_AGE_MS = 5 * 60 * 1000;
export const META_OUTBOX_POLL_INTERVAL_MS = 5_000;
export const META_OUTBOX_BATCH_SIZE = 20;
export const META_OUTBOX_LOCK_TIMEOUT_MS = 2 * 60 * 1000;
export const META_OUTBOX_MAX_ATTEMPTS = 10;
export const META_OUTBOX_MAX_EVENT_AGE_MS =
  6 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000;
export const META_OUTBOX_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const META_OUTBOX_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
export const META_CAPI_REQUEST_TIMEOUT_MS = 5_000;

