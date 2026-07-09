type DiffResult = {
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  hasChanges: boolean;
};

/**
 * Picks changed fields from old/new records without treating missing fields as changes.
 */
export function pickChangedFields<T extends Record<string, unknown>>(
  oldData: T,
  newData: Partial<T>,
  fields: Array<keyof T>,
): DiffResult {
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  for (const field of fields) {
    if (!(field in newData)) {
      continue;
    }

    const oldValue = oldData[field];
    const newValue = newData[field];

    if (toComparableValue(oldValue) === toComparableValue(newValue)) {
      continue;
    }

    oldValues[String(field)] = oldValue;
    newValues[String(field)] = newValue;
  }

  return {
    oldValues,
    newValues,
    hasChanges: Object.keys(oldValues).length > 0,
  };
}

/**
 * Converts primitive and object values into stable strings for diff checks.
 */
function toComparableValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}
