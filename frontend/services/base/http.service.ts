import "server-only";

import {
	HttpRequestOptions,
	HttpServiceAbstract,
	IPaginatedResponse,
	IParams,
	TMethod,
} from "@/types/services/base";
import { getCookie, getCookiesString } from "@/lib/server/cookies";

import { STORAGE_KEYS } from "@/constants";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import { createParams } from "@/lib/utils/qs";

// Enhanced response type for better type safety
export interface ServiceResponse<T = unknown> {
	data?: T;
	success: boolean;
	message?: string;
	status?: number;
	errors?: unknown;
}

const DEFAULT_TIMEOUT = 10000;
const LOGIN_ROUTE = "/merchant/login";
const REVOKE_ROUTE = `/api/auth/session/revoke?redirect=${encodeURIComponent(LOGIN_ROUTE)}`;

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return typeof value === "object" && value !== null && !Array.isArray(value);
};

const toReadableMessage = (value: unknown): string | null => {
	if (typeof value === "string") {
		const normalized = value.trim();
		return normalized.length > 0 ? normalized : null;
	}

	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}

	return null;
};

const extractMessageFromArray = (value: unknown[], depth: number): string | null => {
	for (const item of value) {
		const nestedMessage = extractFirstReadableMessage(item, depth + 1);
		if (nestedMessage) {
			return nestedMessage;
		}
	}

	return null;
};

const extractMessageFromRecordByPreferredKeys = (
	value: Record<string, unknown>,
	depth: number,
): string | null => {
	const nestedMessageFromMessage = extractFirstReadableMessage(
		value.message,
		depth + 1,
	);
	if (nestedMessageFromMessage) {
		return nestedMessageFromMessage;
	}

	const nestedMessageFromError = extractFirstReadableMessage(
		value.error,
		depth + 1,
	);
	if (nestedMessageFromError) {
		return nestedMessageFromError;
	}

	const nestedMessageFromDetail = extractFirstReadableMessage(
		value.detail,
		depth + 1,
	);
	if (nestedMessageFromDetail) {
		return nestedMessageFromDetail;
	}

	const nestedMessageFromDetails = extractFirstReadableMessage(
		value.details,
		depth + 1,
	);
	if (nestedMessageFromDetails) {
		return nestedMessageFromDetails;
	}

	const nestedMessageFromErrors = extractFirstReadableMessage(
		value.errors,
		depth + 1,
	);
	if (nestedMessageFromErrors) {
		return nestedMessageFromErrors;
	}

	return extractFirstReadableMessage(value.constraints, depth + 1);
};

const extractMessageFromRecordValues = (
	value: Record<string, unknown>,
	depth: number,
): string | null => {
	for (const nestedValue of Object.values(value)) {
		const nestedMessage = extractFirstReadableMessage(nestedValue, depth + 1);
		if (nestedMessage) {
			return nestedMessage;
		}
	}

	return null;
};

const extractFirstReadableMessage = (value: unknown, depth = 0): string | null => {
	if (depth > 6 || value === null || value === undefined) {
		return null;
	}

	const directMessage = toReadableMessage(value);
	if (directMessage) {
		return directMessage;
	}

	if (Array.isArray(value)) {
		return extractMessageFromArray(value, depth);
	}

	if (!isRecord(value)) {
		return null;
	}

	const preferredKeyMessage = extractMessageFromRecordByPreferredKeys(value, depth);
	if (preferredKeyMessage) {
		return preferredKeyMessage;
	}

	return extractMessageFromRecordValues(value, depth);
};

export default class HttpService<T = unknown> extends HttpServiceAbstract<T> {
	private readonly _baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
	private readonly _timeout: number;
	private readonly _defaultHeaders: HeadersInit;

	constructor(url: string, timeout = DEFAULT_TIMEOUT) {
		super();

		if (!this._baseUrl) {
			throw new Error("NEXT_PUBLIC_API_BASE_URL is not defined");
		}

		this._baseUrl += url;
		this._timeout = timeout;
		this._defaultHeaders = {
			Accept: "application/json",
		};
	}

	private async _handleUnauthorized(): Promise<void> {
		const { redirect } = await import("next/navigation");
		redirect(this._unauthorizedRedirectRoute);
	}

	private async _parseErrorResponse(
		response: Response,
	): Promise<{ message: string; data: unknown | null }> {
		let errorBody: string | undefined;

		try {
			errorBody = await response.clone().text();
		} catch (readError) {
			errorBody = `<<failed to read body: ${String(readError)}>>`;
		}

		let errorMessage = response.statusText || "Request failed";
		let errorData: unknown = null;
		try {
			const errorJson = JSON.parse(errorBody || "{}") as unknown;
			const normalizedMessage = extractFirstReadableMessage(errorJson);
			if (normalizedMessage) {
				errorMessage = normalizedMessage;
			}
			errorData = errorJson;
		} catch {
			const fallbackMessage = toReadableMessage(errorBody);
			if (fallbackMessage) {
				errorMessage = fallbackMessage;
			}
		}

		return { message: errorMessage, data: errorData };
	}

	protected _tokenKey: string = STORAGE_KEYS.ACCESS_TOKEN;
	protected _unauthorizedRedirectRoute: string = REVOKE_ROUTE;

	/**
	 * Only authenticated calls read cookies. Reading them for a public request
	 * would opt the calling route out of static rendering, and would put a
	 * per-visitor `Cookie` header into the Next Data Cache key — which makes
	 * the `next: { revalidate }` windows on public endpoints useless.
	 */
	private async _getAuthHeaders(authRequired: boolean): Promise<HeadersInit> {
		if (!authRequired) {
			return {};
		}

		// Always get fresh token from cookies
		const token = await getCookie(this._tokenKey);

		const headers: HeadersInit = {};

		if (token) {
			headers["Authorization"] = `Bearer ${token.replace(/['"]+/g, "")}`;
		}

		// Forward all cookies in SSR
		const cookies = await getCookiesString();
		if (cookies) {
			headers["Cookie"] = cookies;
		}

		return headers;
	}

	private _buildFullURL(route: string, params?: IParams): string {
		const urlParams = createParams(params || {});
		const searchParams = urlParams.toString();
		return searchParams
			? `${this._baseUrl}/${route}?${searchParams}`
			: `${this._baseUrl}/${route}`;
	}

	private _buildRequestOptions(
		method: TMethod,
		options: HttpRequestOptions,
		authHeaders: HeadersInit,
	): RequestInit {
		const {
			authRequired: _authRequired,
			timeoutMs = this._timeout,
			...requestOverrides
		} = options;

		return {
			...requestOverrides,
			signal: requestOverrides.signal || AbortSignal.timeout(timeoutMs),
			method,
			headers: {
				...this._defaultHeaders,
				...authHeaders,
				...requestOverrides.headers,
			},
		};
	}

	private async _handleNonOkResponse<R>(
		response: Response,
		authRequired: boolean,
	): Promise<ServiceResponse<R>> {
		const { message, data } = await this._parseErrorResponse(response);
		const errors = isRecord(data) ? data.errors : undefined;

		if (response.status === 401 && authRequired) {
			await this._handleUnauthorized();
		}

		return {
			success: false,
			message,
			status: response.status,
			data: data as R,
			errors,
		};
	}

	private async _parseSuccessResponse<R>(response: Response): Promise<ServiceResponse<R>> {
		const contentType = response.headers.get("content-type");
		const isJson = contentType?.includes("application/json");
		let data: unknown;

		if (isJson) {
			try {
				const rawData = (await response.json()) as unknown;
				if (
					rawData &&
					typeof rawData === "object" &&
					"data" in rawData &&
					"success" in rawData
				) {
					data = (rawData as { data: unknown }).data;
				} else {
					data = rawData;
				}
			} catch {
				data = null;
			}
		} else {
			data = await response.text();
		}

		return {
			success: true,
			status: response.status,
			data: data as R,
		};
	}

	private async _request<R = T>(
		route: string,
		method: TMethod,
		options: HttpRequestOptions = {},
		params?: IParams
	): Promise<ServiceResponse<R>> {
		try {
			if (!this._baseUrl || this._baseUrl.startsWith("undefined")) {
				return {
					success: false,
					message:
						"API base URL is not configured. Please set NEXT_PUBLIC_API_BASE_URL in your .env.local file.",
				};
			}

			const authRequired = options.authRequired ?? false;
			const authHeaders = await this._getAuthHeaders(authRequired);
			const fullURL = this._buildFullURL(route, params);
			const requestOptions = this._buildRequestOptions(
				method,
				options,
				authHeaders,
			);

			const response = await fetch(fullURL, requestOptions);

			if (response.status === 204) {
				return { success: true, status: response.status };
			}

			if (!response.ok) {
				return this._handleNonOkResponse(response, authRequired);
			}

			return this._parseSuccessResponse<R>(response);
		} catch (error) {
			if (isNextRedirectError(error)) {
				throw error;
			}

			return {
				success: false,
				message:
					error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	}

	private _prepareBody(body: unknown): {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		processedBody: any;
		headers: HeadersInit;
	} {
		if (body instanceof FormData) {
			return {
				processedBody: body,
				headers: {}, // Let browser set Content-Type for FormData
			};
		}

		if (body && typeof body === "object") {
			return {
				processedBody: JSON.stringify(body),
				headers: { "Content-Type": "application/json" },
			};
		}

		return {
			processedBody: body,
			headers: { "Content-Type": "application/json" },
		};
	}

	// Public API methods with consistent return types
	protected async get<R = T>(
		route: string,
		params?: IParams,
		options?: HttpRequestOptions
	): Promise<ServiceResponse<R>> {
		return this._request<R>(route, "GET", options, params);
	}

	protected async getList<R = T[]>(
		route: string,
		params?: IParams,
		options?: HttpRequestOptions
	): Promise<ServiceResponse<R>> {
		return this._request<R>(route, "GET", options, params);
	}

	protected async post<R = T>(
		route: string,
		body: unknown,
		params?: IParams,
		options?: HttpRequestOptions
	): Promise<ServiceResponse<R>> {
		const { processedBody, headers } = this._prepareBody(body);

		return this._request<R>(
			route,
			"POST",
			{
				...options,
				body: processedBody,
				headers: { ...headers, ...options?.headers },
			},
			params
		);
	}

	protected async put<R = T>(
		route: string,
		body: unknown,
		params?: IParams,
		options?: HttpRequestOptions
	): Promise<ServiceResponse<R>> {
		const { processedBody, headers } = this._prepareBody(body);

		return this._request<R>(
			route,
			"PUT",
			{
				...options,
				body: processedBody,
				headers: { ...headers, ...options?.headers },
			},
			params
		);
	}

	protected async patch<R = T>(
		route: string,
		body: unknown,
		params?: IParams,
		options?: HttpRequestOptions
	): Promise<ServiceResponse<R>> {
		const { processedBody, headers } = this._prepareBody(body);

		return this._request<R>(
			route,
			"PATCH",
			{
				...options,
				body: processedBody,
				headers: { ...headers, ...options?.headers },
			},
			params
		);
	}

	protected async delete<R = T>(
		route: string,
		params?: IParams,
		options?: HttpRequestOptions
	): Promise<ServiceResponse<R>> {
		return this._request<R>(route, "DELETE", options, params);
	}

	// Utility method for handling paginated responses
	protected async getPaginated<R = T>(
		route: string,
		params?: IParams,
		options?: HttpRequestOptions
	): Promise<ServiceResponse<IPaginatedResponse<R>>> {
		return this._request<IPaginatedResponse<R>>(route, "GET", options, params);
	}
}
