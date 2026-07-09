const SENSITIVE_KEY_PATTERNS = [
  /phone/i,
  /address/i,
  /password/i,
  /token/i,
  /prescription/i,
];

/**
 * Removes sensitive values from activity payloads while preserving change intent.
 */
export function sanitizeActivityPayload(
  value?: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, entryValue] of Object.entries(value)) {
    if (entryValue === undefined) {
      continue;
    }

    if (SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
      sanitized[`${key}_changed`] = entryValue !== undefined;
      continue;
    }

    if (
      entryValue &&
      typeof entryValue === 'object' &&
      !Array.isArray(entryValue) &&
      !(entryValue instanceof Date)
    ) {
      sanitized[key] = sanitizeActivityPayload(
        entryValue as Record<string, unknown>,
      );
      continue;
    }

    sanitized[key] = entryValue;
  }

  return sanitized;
}
