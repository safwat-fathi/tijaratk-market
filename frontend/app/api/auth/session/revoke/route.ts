import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STORAGE_KEYS } from "@/constants";

const DEFAULT_LOGIN_ROUTE = "/merchant/login";

async function notifyBackendLogout(): Promise<void> {
	const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
	if (!baseUrl) {
		return;
	}

	const cookieStore = await cookies();
	const token = cookieStore.get(STORAGE_KEYS.ACCESS_TOKEN)?.value;
	const cookiesString = cookieStore.toString();

	const headers: HeadersInit = {
		Accept: "application/json",
	};

	if (token) {
		headers["Authorization"] = `Bearer ${token.replace(/['"]+/g, "")}`;
	}

	if (cookiesString) {
		headers["Cookie"] = cookiesString;
	}

	const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

	try {
		await fetch(`${normalizedBaseUrl}/auth/logout`, {
			method: "POST",
			headers,
			credentials: "include",
			cache: "no-store",
		});
	} catch {
		// Best effort logout.
	}
}

function clearSessionCookies(response: NextResponse): NextResponse {
	const domain = process.env.NODE_ENV === "production" ? ".tijaratk.com" : undefined;
	
	if (domain) {
		response.cookies.set(STORAGE_KEYS.ACCESS_TOKEN, "", { maxAge: 0, domain, path: "/" });
		response.cookies.set(STORAGE_KEYS.USER, "", { maxAge: 0, domain, path: "/" });
	} else {
		response.cookies.delete(STORAGE_KEYS.ACCESS_TOKEN);
		response.cookies.delete(STORAGE_KEYS.USER);
	}
	return response;
}

export async function POST() {
	await notifyBackendLogout();

	return clearSessionCookies(NextResponse.json({ success: true }));
}

export async function GET(request: Request) {
	await notifyBackendLogout();

	const { searchParams } = new URL(request.url);
	const redirectPathParam = searchParams.get("redirect");
	const redirectPath =
		redirectPathParam && redirectPathParam.startsWith("/")
			? redirectPathParam
			: DEFAULT_LOGIN_ROUTE;

	const response = NextResponse.redirect(new URL(redirectPath, request.url));
	return clearSessionCookies(response);
}
