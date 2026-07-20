import { createHash } from 'node:crypto';

export type RuntimeIdentity = {
  pid: number;
  pm2Instance: string;
  release: string;
};

/** Returns non-sensitive process metadata for clustered runtime diagnostics. */
export function getRuntimeIdentity(): RuntimeIdentity {
  return {
    pid: process.pid,
    pm2Instance: process.env.NODE_APP_INSTANCE || 'standalone',
    release: process.env.APP_RELEASE || process.env.SENTRY_RELEASE || 'unknown',
  };
}

/** Creates a non-reversible fingerprint for the configured database target. */
export function getDatabaseTargetFingerprint(
  connectionString = process.env.DB_URL,
): string {
  if (!connectionString) return 'missing';

  try {
    const url = new URL(connectionString);
    const queryParameters = [...url.searchParams.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    const target = [
      url.protocol,
      url.hostname,
      url.port,
      url.pathname,
      url.username,
      queryParameters,
    ].join('|');
    return createHash('sha256').update(target).digest('hex').slice(0, 12);
  } catch {
    return 'invalid';
  }
}
