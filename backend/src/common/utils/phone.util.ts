export const formatPhoneNumber = (phone: string): string => {
  // 1. Remove non-numeric characters except leading +
  const cleaned = phone
    .trim()
    .replace(/(?!^)\+/g, '')
    .replace(/[^\d+]/g, '');

  // 2. Already in E.164 format for Egypt (+20...)
  if (cleaned.startsWith('+20')) {
    return cleaned;
  }

  // 3. Starts with 20... (missing +)
  if (cleaned.startsWith('20') && cleaned.length >= 12) {
    return `+${cleaned}`;
  }

  // 4. Egyptian mobile number starting with 01... (11 digits: 01xxxxxxxxx)
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    return `+20${cleaned.substring(1)}`;
  }

  // 5. Egyptian mobile number without country code or leading zero (1xxxxxxxxx)
  if (cleaned.startsWith('1') && cleaned.length === 10) {
    return `+20${cleaned}`;
  }

  // 6. Fallback: return as is (could be international or invalid)
  return cleaned;
};

/**
 * Redacts a phone-like value while retaining a short suffix for correlation.
 */
export const maskPhoneNumber = (value: string): string => {
  if (value.length <= 4) return '*'.repeat(value.length);

  const visibleSuffix = value.slice(-4);
  return `${'*'.repeat(value.length - 4)}${visibleSuffix}`;
};

/**
 * Redacts phone-like substrings that an upstream provider may include in errors.
 */
export const maskPhoneNumbersInText = (value: string): string =>
  value.replace(/(?:whatsapp:)?\+?\d[\d\s()-]{6,}\d/gu, (phone) =>
    maskPhoneNumber(phone),
  );
