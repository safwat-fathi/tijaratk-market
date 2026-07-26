import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const CUSTOMER_PUSH_DEVICE_COOKIE = "__Host-tijaratk_customer_push_device";
const CUSTOMER_PUSH_DEVICE_TTL_SECONDS = 365 * 24 * 60 * 60;
const DEVICE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;

/** Reads the private customer device credential without exposing it to React. */
export async function getCustomerPushDeviceToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_PUSH_DEVICE_COOKIE)?.value?.trim();
  return token && DEVICE_TOKEN_PATTERN.test(token) ? token : null;
}

/** Creates the private one-year customer device credential when first needed. */
export async function getOrCreateCustomerPushDeviceToken(): Promise<string> {
  const existing = await getCustomerPushDeviceToken();
  if (existing) return existing;

  const token = randomBytes(32).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_PUSH_DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: CUSTOMER_PUSH_DEVICE_TTL_SECONDS,
  });
  return token;
}

/** Removes the browser credential after the customer disables notifications. */
export async function clearCustomerPushDeviceToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_PUSH_DEVICE_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
