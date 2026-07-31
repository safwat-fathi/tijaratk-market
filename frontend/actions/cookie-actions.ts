"use server";

import { cookies } from "next/headers";

const PRODUCTION_COOKIE_DOMAIN =
  process.env.NODE_ENV === "production" ? ".tijaratk.com" : undefined;

export async function setCookieAction(
  name: string,
  value: string,
  options: Record<string, unknown> = {},
) {
  const cookieStore = await cookies();
  cookieStore.set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    domain: PRODUCTION_COOKIE_DOMAIN,
    sameSite: "lax",
    path: "/",
    ...options,
  });
}

export async function deleteCookieAction(name: string) {
  const cookieStore = await cookies();

  if (PRODUCTION_COOKIE_DOMAIN) {
    cookieStore.set(name, "", {
      maxAge: 0,
      domain: PRODUCTION_COOKIE_DOMAIN,
      path: "/",
    });
  } else {
    cookieStore.delete(name);
  }
}
