export interface ServiceResponse<T = unknown> {
	data?: T;
	success: boolean;
	message?: string;
	status?: number;
	errors?: unknown;
}

export interface IPaginatedResponse<T> {
	items: T[];
	total: number;
	page: number;
	limit: number;
	last_page: number;
}

export interface IParams {
	[key: string]: string | number | boolean | undefined | null;
}
export type TMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type HttpRequestOptions = RequestInit & {
	authRequired?: boolean;
	timeoutMs?: number;
};

// Updated abstract class
export abstract class HttpServiceAbstract<T> {
	protected abstract getList<R = T[]>(
		route: string,
		params?: IParams,
		options?: HttpRequestOptions
	): Promise<ServiceResponse<R>>;

	protected abstract get<R = T>(
		route: string,
		params?: IParams,
		options?: HttpRequestOptions
	): Promise<ServiceResponse<R>>;

	protected abstract post<R = T>(
		route: string,
		body: unknown,
		params?: IParams,
		options?: HttpRequestOptions
	): Promise<ServiceResponse<R>>;

	protected abstract put<R = T>(
		route: string,
		body: unknown,
		params?: IParams,
		options?: HttpRequestOptions
	): Promise<ServiceResponse<R>>;

	protected abstract patch<R = T>(
		route: string,
		body: unknown,
		params?: IParams,
		options?: HttpRequestOptions
	): Promise<ServiceResponse<R>>;

	protected abstract delete<R = T>(
		route: string,
		params?: IParams,
		options?: HttpRequestOptions
	): Promise<ServiceResponse<R>>;

	// Utility method for paginated responses
	protected abstract getPaginated<R = T>(
		route: string,
		params?: IParams,
		options?: HttpRequestOptions
	): Promise<ServiceResponse<IPaginatedResponse<R>>>;
}
