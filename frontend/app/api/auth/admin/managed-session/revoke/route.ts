import { NextResponse } from "next/server";
import { STORAGE_KEYS } from "@/constants";
import { createAppUrl } from "@/lib/url/app-url";

function clearManagedSession(response: NextResponse): NextResponse {
  const domain = process.env.NODE_ENV === "production" ? ".tijaratk.com" : undefined;
  if (domain) {
    response.cookies.set(STORAGE_KEYS.ADMIN_MANAGEMENT_SESSION, "", {
      maxAge: 0,
      domain,
      path: "/",
    });
  } else {
    response.cookies.delete(STORAGE_KEYS.ADMIN_MANAGEMENT_SESSION);
  }
  return response;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectValue = searchParams.get("redirect");
  const redirectPath = redirectValue?.startsWith("/")
    ? redirectValue
    : "/admin/merchants";
  return clearManagedSession(
    NextResponse.redirect(createAppUrl(redirectPath, request)),
  );
}

export async function POST() {
  return clearManagedSession(NextResponse.json({ success: true }));
}
