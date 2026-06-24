"use server";

import { cookies } from "next/headers";

export async function getCookieAction(name: string): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(name)?.value;
}

export async function getCookiesStringAction(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.toString();
}

export async function setCookieAction(
  name: string,
  value: string,
  options: Record<string, unknown> = {}
) {
  const cookieStore = await cookies();
  cookieStore.set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    domain: process.env.NODE_ENV === "production" ? ".tijaratk.com" : undefined,
    sameSite: "lax",
    path: "/",
    ...options,
  });
}

export async function deleteCookieAction(name: string) {
  const cookieStore = await cookies();
  const domain = process.env.NODE_ENV === "production" ? ".tijaratk.com" : undefined;
  
  if (domain) {
    cookieStore.set(name, "", { maxAge: 0, domain, path: "/" });
  } else {
    cookieStore.delete(name);
  }
}
