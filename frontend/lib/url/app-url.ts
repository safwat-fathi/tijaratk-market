const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function firstHeaderValue(value: string | null): string | null {
	return value?.split(",")[0]?.trim() || null;
}

function isLocalHost(hostname: string): boolean {
	return LOCAL_HOSTS.has(hostname);
}

function getConfiguredAppOrigin(): string | null {
	const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL?.trim();
	if (!configuredBaseUrl) {
		return null;
	}

	try {
		return new URL(configuredBaseUrl).origin;
	} catch {
		return null;
	}
}

export function getAppOrigin(request: Request): string {
	const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
	const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));

	if (forwardedHost) {
		const protocol = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : "http");
		return `${protocol}://${forwardedHost}`;
	}

	const requestUrl = new URL(request.url);
	const configuredOrigin = getConfiguredAppOrigin();

	if (process.env.NODE_ENV === "production" && isLocalHost(requestUrl.hostname) && configuredOrigin) {
		return configuredOrigin;
	}

	return requestUrl.origin;
}

export function createAppUrl(path: string, request: Request): URL {
	return new URL(path, getAppOrigin(request));
}
