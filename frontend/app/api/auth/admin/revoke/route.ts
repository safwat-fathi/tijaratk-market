import { NextResponse } from "next/server";
import { STORAGE_KEYS } from "@/constants";

const DEFAULT_LOGIN_ROUTE = "/admin/login";

function clearAdminSessionCookie(response: NextResponse): NextResponse {
	response.cookies.delete(STORAGE_KEYS.ADMIN_ACCESS_TOKEN);
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

	const response = NextResponse.redirect(new URL(redirectPath, request.url));
	return clearAdminSessionCookie(response);
}
