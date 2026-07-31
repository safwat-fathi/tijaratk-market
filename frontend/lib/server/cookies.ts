import "server-only";

import { cookies } from "next/headers";

/**
 * Read-only cookie helpers.
 *
 * These are deliberately NOT server actions. A `"use server"` export is a
 * callable endpoint, and `getCookiesString` returns the httpOnly session
 * cookies — exposing it as an action would hand the browser a way to read
 * `access_token`, defeating the httpOnly flag. Mutations still live in
 * `actions/cookie-actions.ts`.
 */

export async function getCookie(name: string): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(name)?.value;
}

export async function getCookiesString(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.toString();
}
