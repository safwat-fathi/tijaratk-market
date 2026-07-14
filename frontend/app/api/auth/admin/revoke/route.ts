import { NextResponse } from "next/server";
import { STORAGE_KEYS } from "@/constants";
import { createAppUrl } from "@/lib/url/app-url";

const DEFAULT_LOGIN_ROUTE = "/admin/login";

function clearAdminSessionCookie(response: NextResponse): NextResponse {
	const domain =
		process.env.NODE_ENV === "production" ? ".tijaratk.com" : undefined;

	if (domain) {
		response.cookies.set(STORAGE_KEYS.ADMIN_ACCESS_TOKEN, "", {
			maxAge: 0,
			domain,
			path: "/",
		});
		response.cookies.set(STORAGE_KEYS.ADMIN_MANAGEMENT_SESSION, "", {
			maxAge: 0,
			domain,
			path: "/",
		});
	} else {
		response.cookies.delete(STORAGE_KEYS.ADMIN_ACCESS_TOKEN);
		response.cookies.delete(STORAGE_KEYS.ADMIN_MANAGEMENT_SESSION);
	}

	return response;
}

export async function POST() {
	return clearAdminSessionCookie(NextResponse.json({ success: true }));
}

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const redirectPathParam = searchParams.get("redirect");
	const redirectPath =
		redirectPathParam && redirectPathParam.startsWith("/")
			? redirectPathParam
			: DEFAULT_LOGIN_ROUTE;

	const response = NextResponse.redirect(createAppUrl(redirectPath, request));
	return clearAdminSessionCookie(response);
}
