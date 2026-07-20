import * as bcrypt from 'bcrypt';

export const BCRYPT_COST = 10;

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$.{53}$/;

/** Returns whether a value is a complete bcrypt password hash. */
export function isBcryptHash(value: unknown): value is string {
  return typeof value === 'string' && BCRYPT_HASH_PATTERN.test(value);
}

/** Hashes plaintext passwords while preserving values that are already bcrypt hashes. */
export async function hashPassword(password: string): Promise<string> {
  if (isBcryptHash(password)) return password;
  return bcrypt.hash(password, BCRYPT_COST);
}
