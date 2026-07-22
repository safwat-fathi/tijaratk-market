import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "tijaratk_storefront_cart";
const CART_TTL_SECONDS = 24 * 60 * 60;

const cookiePath = (tenantSlug: string) =>
  `/${encodeURIComponent(tenantSlug.trim())}`;

/** Returns the route-scoped opaque cart token, if present. */
export async function getStorefrontCartToken(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE_NAME)?.value?.trim() || undefined;
}

/** Persists a route-scoped opaque token using hardened browser flags. */
export async function setStorefrontCartToken(
  tenantSlug: string,
  token: string,
): Promise<void> {
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: cookiePath(tenantSlug),
    maxAge: CART_TTL_SECONDS,
  });
}

/** Clears the cart token after successful order creation. */
export async function clearStorefrontCartToken(
  tenantSlug: string,
): Promise<void> {
  (await cookies()).set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: cookiePath(tenantSlug),
    maxAge: 0,
  });
}

/** Derives a hidden form nonce from the HTTP-only token. */
export function deriveStorefrontCheckoutCsrf(token: string): string {
  return createHash("sha256")
    .update(`storefront-checkout:${token}`)
    .digest("hex");
}

/** Compares a submitted checkout nonce without timing leaks. */
export function verifyStorefrontCheckoutCsrf(
  token: string,
  submitted: string,
): boolean {
  const expected = Buffer.from(deriveStorefrontCheckoutCsrf(token));
  const candidate = Buffer.from(submitted.trim());
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
