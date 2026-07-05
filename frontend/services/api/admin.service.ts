import HttpService, { type ServiceResponse } from "@/services/base/http.service";
import { STORAGE_KEYS } from "@/constants";
import type { ImportRowError, ImportRun } from "@/types/models/import";
import type {
	BulkEssentialStage,
	CatalogItemsResponse,
	Product,
	ProductOrderConfig,
	ProductStatus,
	PublicProductCategory,
	TenantProductsSearchResponse,
} from "@/types/models/product";

type AdminLoginPayload = {
	phone: string;
	password: string;
};

type AdminLoginResponse = {
	admin_access_token: string;
	user: unknown;
};

type AdminDashboardStats = {
	totalMerchants: number;
	activeMerchants: number;
	totalOrders: number;
	totalPlans: number;
};

export type AdminDirectoryArea = {
	id: number;
	name_ar: string;
	name_en: string | null;
	slug: string;
	parent_area_id: number | null;
	city: string | null;
	governorate: string | null;
	is_active: boolean;
};

type AdminTenantCount = {
	orders: number;
	customers: number;
	products: number;
};

type AdminTenantSubscription = {
	plan_id: number;
	plan?: {
		id: number;
		name: string;
	};
};

type AdminTenantDirectoryProfile = {
	area_id: number | null;
	directory_status: "draft" | "listed" | "hidden" | "suspended";
	area: AdminDirectoryArea | null;
};

type AdminTenantDeliveryArea = {
	area_id: number;
	area: AdminDirectoryArea;
};

type AdminTenantCancellationPolicy = {
	status: "ok" | "warning" | "suspended";
	count: number;
	warning_threshold: number;
	suspension_threshold: number;
	remaining_before_suspension: number;
	window_start: string;
	window_end: string;
	is_probation: boolean;
	last_warning_at: string | null;
	last_suspension_at: string | null;
	last_event_type: "merchant_order_cancelled" | "warning_issued" | "auto_suspended" | "admin_reactivated" | null;
	last_event_at: string | null;
	last_suspension_policy: boolean;
};

export type AdminTenantCategory =
	| "grocery"
	| "greengrocer"
	| "butcher"
	| "bakery"
	| "pharmacy"
	| "other";

export type AdminTenant = {
	id: number;
	name: string;
	phone: string;
	slug: string;
	status: "active" | "inactive" | "suspended";
	category?: AdminTenantCategory;
	last_bulk_essentials_added_at?: string | null;
	_count?: AdminTenantCount;
	tenant_subscriptions?: AdminTenantSubscription[];
	directory_profile?: AdminTenantDirectoryProfile | null;
	tenant_delivery_areas?: AdminTenantDeliveryArea[];
	cancellation_policy?: AdminTenantCancellationPolicy;
};

export type AdminPlan = {
	id: number;
	name: string;
	price?: number | string;
	is_active?: boolean;
};

type AdminPaginatedResponse<T> = {
	data: T[];
	meta: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
};

type AdminTenantsResponse = AdminTenant[] | AdminPaginatedResponse<AdminTenant>;

export type AdminProduct = {
	id: number;
	name: string;
	category?: string | null;
	current_price?: number | string | null;
	status?: "active" | "archived" | string | null;
	is_available?: boolean;
	price_needs_review?: boolean;
	tenant_id?: number;
	tenant?: {
		id?: number;
		name?: string | null;
	} | null;
};

export type AdminCatalogItem = {
	id: number;
	name: string;
	image_url?: string | null;
	original_image_url?: string | null;
	category: string;
	price?: number | string | null;
	currency?: string;
	is_active: boolean;
	is_essential: boolean;
	essential_sort_order?: number | null;
	source: string;
	external_id?: string | null;
	created_at?: string;
	updated_at?: string;
};

export type AdminCatalogCategory = {
	id?: number;
	name?: string;
	category: string;
	count: number;
	image_url?: string | null;
};

export type AdminCatalogSource = "talabat_csv" | "chefaa_csv";
export type AdminCatalogType = "grocery" | "pharmacy";

const isAdminCatalogType = (
	value: AdminCatalogType | AdminCatalogSource,
): value is AdminCatalogType => value === "grocery" || value === "pharmacy";

export type AdminTenantProductCategory = {
	id: number;
	name: string;
	count: number;
};

export type AdminProductSheetUploadSummary = {
	total_rows: number;
	created_rows: number;
	updated_rows: number;
	skipped_rows: number;
	failed_rows: number;
	errors: Array<{
		row_number: number;
		message: string;
	}>;
};

type AdminOrder = Record<string, unknown>;

type AdminProductPayload = {
	name: string;
	image_url?: string;
	current_price?: number;
	category?: string;
	is_available?: boolean;
	status?: "active" | "archived";
	order_mode?: "quantity" | "weight" | "price";
	order_config?: ProductOrderConfig;
};
type AdminCatalogItemPayload =
	| FormData
	| {
			source: AdminCatalogSource;
			name: string;
			category: string;
			price?: number | null;
			currency?: string;
			image_url?: string | null;
			external_id?: string | null;
			is_active?: boolean;
			is_essential?: boolean;
			essential_sort_order?: number | null;
	  };

export type UpdateAdminCatalogItemPayload =
	| FormData
	| {
			name?: string;
			category?: string;
			price?: number | null;
			currency?: string;
			image_url?: string | null;
			external_id?: string | null;
			is_active?: boolean;
			is_essential?: boolean;
			essential_sort_order?: number | null;
	  };

type BulkUpdateAdminCatalogItemsPayload = {
	ids: number[];
	category?: string;
	is_active?: boolean;
	is_essential?: boolean;
};

type BulkUpdateAdminProductsPayload = {
	ids: number[];
	category?: string;
	is_available?: boolean;
	status?: "active" | "archived";
};

type UpdateTenantDirectoryProfilePayload = {
	area_id?: number;
	delivery_area_ids?: number[];
	directory_status?: "draft" | "listed" | "hidden" | "suspended";
};

const ADMIN_AUTH_OPTIONS = {
	authRequired: true,
	cache: "no-store" as const,
};

class AdminApiService extends HttpService {
	constructor() {
		super("/admin");
		this._tokenKey = STORAGE_KEYS.ADMIN_ACCESS_TOKEN;
		this._unauthorizedRedirectRoute = `/api/auth/admin/revoke?redirect=${encodeURIComponent("/admin/login")}`;
	}

	public async login(payload: AdminLoginPayload) {
		return this.post<AdminLoginResponse>("login", payload);
	}

	public async logout() {
		try {
			await this.post("logout", {}, undefined, ADMIN_AUTH_OPTIONS);
		} catch (error) {
			console.error("Admin logout API call failed:", error);
		}
		return { success: true };
	}

	public async getDashboardStats() {
		return this.get<AdminDashboardStats>("dashboard-stats", undefined, ADMIN_AUTH_OPTIONS);
	}

	public async getTenants(): Promise<ServiceResponse<AdminTenant[]>>;
	public async getTenants(params: {
		page?: number;
		limit?: number;
		search?: string;
		tenantId?: number;
		category?: string;
		status?: string;
		areaId?: number;
	}): Promise<ServiceResponse<AdminTenantsResponse>>;
	public async getTenants(params?: { 
		page?: number; 
		limit?: number; 
		search?: string; 
		tenantId?: number; 
		category?: string; 
		status?: string; 
		areaId?: number; 
	}) {
		const searchParams = new URLSearchParams();
		if (params?.page) searchParams.append("page", String(params.page));
		if (params?.limit) searchParams.append("limit", String(params.limit));
		if (params?.search) searchParams.append("search", params.search);
		if (params?.tenantId) searchParams.append("tenantId", String(params.tenantId));
		if (params?.category) searchParams.append("category", params.category);
		if (params?.status) searchParams.append("status", params.status);
		if (params?.areaId) searchParams.append("areaId", String(params.areaId));
		const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
		return this.get<AdminTenantsResponse>(`tenants${qs}`, undefined, ADMIN_AUTH_OPTIONS);
	}

	public async getDirectoryAreas() {
		return this.get<AdminDirectoryArea[]>("directory/areas", undefined, ADMIN_AUTH_OPTIONS);
	}

	public async createDirectoryArea(payload: Partial<AdminDirectoryArea>) {
		return this.post<AdminDirectoryArea>("directory/areas", payload, undefined, ADMIN_AUTH_OPTIONS);
	}

	public async updateDirectoryArea(id: number, payload: Partial<AdminDirectoryArea>) {
		return this.patch<AdminDirectoryArea>(`directory/areas/${id}`, payload, undefined, ADMIN_AUTH_OPTIONS);
	}

	public async deleteDirectoryArea(id: number) {
		return this.delete<{ success: boolean }>(`directory/areas/${id}`, undefined, ADMIN_AUTH_OPTIONS);
	}

	public async updateTenantStatus(id: number, status: string) {
		return this.patch<AdminTenant>(`tenants/${id}/status`, { status }, undefined, ADMIN_AUTH_OPTIONS);
	}

	public async updateTenantPlan(id: number, plan_id: number) {
		return this.patch<AdminTenant>(`tenants/${id}/plan`, { plan_id }, undefined, ADMIN_AUTH_OPTIONS);
	}

	public async updateTenantDirectoryProfile(
		id: number,
		payload: UpdateTenantDirectoryProfilePayload,
	) {
		return this.patch<AdminTenant>(`tenants/${id}/directory-profile`, payload, undefined, ADMIN_AUTH_OPTIONS);
	}

	public async getTenantBulkEssentialStages(tenantId: number) {
		return this.get<BulkEssentialStage[]>(
			`tenants/${tenantId}/bulk-essentials/stages`,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async adminBulkAddEssentialItems(
		tenantId: number,
		payload:
			| { category: string; catalog_item_ids: number[] }
			| { categories: string[] },
	) {
		return this.post<{ count: number }>(
			`tenants/${tenantId}/bulk-essentials`,
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async createTenantProduct(tenantId: number, payload: AdminProductPayload) {
		return this.post<AdminProduct>(
			`tenants/${tenantId}/products`,
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async createTenantProductPayload(
		tenantId: number,
		payload: FormData | AdminProductPayload,
	) {
		return this.post<Product>(
			`tenants/${tenantId}/products`,
			payload,
			undefined,
			{
				...ADMIN_AUTH_OPTIONS,
				timeoutMs: payload instanceof FormData ? 30000 : undefined,
			}
		);
	}

	public async getTenantProducts(
		tenantId: number,
		params?: { status?: ProductStatus },
	) {
		return this.get<Product[]>(
			`tenants/${tenantId}/products`,
			params,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async searchTenantProducts(
		tenantId: number,
		params: {
			search: string;
			category?: string;
			page?: number;
			limit?: number;
			rank_all?: boolean;
			exclude_product_ids?: string;
			status?: ProductStatus;
		},
	) {
		return this.get<TenantProductsSearchResponse>(
			`tenants/${tenantId}/products`,
			params,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async getTenantProductCategories(tenantId: number) {
		return this.get<string[]>(
			`tenants/${tenantId}/products/categories`,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async getTenantCatalogCategories(tenantId: number) {
		return this.get<PublicProductCategory[]>(
			`tenants/${tenantId}/catalog/categories`,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async getTenantCatalogItems(
		tenantId: number,
		params?: {
			search?: string;
			category?: string;
			page?: number;
			limit?: number;
		},
	) {
		return this.get<CatalogItemsResponse>(
			`tenants/${tenantId}/catalog`,
			params,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async addTenantProductFromCatalog(
		tenantId: number,
		catalogItemId: number,
	) {
		return this.post<Product>(
			`tenants/${tenantId}/products/from-catalog`,
			{ catalog_item_id: catalogItemId },
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async uploadTenantProductCatalogSheet(
		tenantId: number,
		formData: FormData,
	) {
		return this.post<AdminProductSheetUploadSummary>(
			`tenants/${tenantId}/products/catalog-sheet`,
			formData,
			undefined,
			{
				...ADMIN_AUTH_OPTIONS,
				timeoutMs: 30000,
			}
		);
	}

	public async updateProduct(productId: number, payload: AdminProductPayload) {
		return this.patch<AdminProduct>(
			`products/${productId}`,
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async updateProductPayload(productId: number, payload: FormData) {
		return this.patch<Product>(
			`products/${productId}`,
			payload,
			undefined,
			{
				...ADMIN_AUTH_OPTIONS,
				timeoutMs: 30000,
			}
		);
	}

	public async bulkUpdateProducts(payload: BulkUpdateAdminProductsPayload) {
		return this.patch<{ success: boolean; count: number }>(
			"products/bulk",
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async removeProduct(productId: number) {
		return this.delete<void>(
			`products/${productId}`,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async getAdminCatalogItems(params: {
		catalogType: AdminCatalogType;
		search?: string;
		category?: string;
		status?: "all" | "active" | "inactive";
		essentialStatus?: "all" | "essential" | "non_essential";
		page?: number;
		limit?: number;
	}) {
		const qs = this.buildQueryString(params);
		return this.get<AdminPaginatedResponse<AdminCatalogItem>>(
			`catalog-items${qs}`,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async getAdminCatalogCategories(catalogType: AdminCatalogType): Promise<ServiceResponse<AdminCatalogCategory[]>>;
	public async getAdminCatalogCategories(source: AdminCatalogSource): Promise<ServiceResponse<AdminCatalogCategory[]>>;
	public async getAdminCatalogCategories(
		catalogTypeOrSource: AdminCatalogType | AdminCatalogSource,
	) {
		const qs = isAdminCatalogType(catalogTypeOrSource)
			? this.buildQueryString({ catalogType: catalogTypeOrSource })
			: this.buildQueryString({ source: catalogTypeOrSource });
		return this.get<AdminCatalogCategory[]>(
			`catalog-items/categories${qs}`,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public getAdminCatalogExportPath(catalogType: AdminCatalogType) {
		const qs = this.buildQueryString({ catalogType });
		return `/api/admin/catalog-items/export${qs}`;
	}

	public async createAdminCatalogCategory(payload: {
		source: AdminCatalogSource;
		name: string;
	}) {
		return this.post<AdminCatalogCategory>(
			"catalog-items/categories",
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async updateAdminCatalogCategory(id: number, payload: { name: string }) {
		return this.patch<AdminCatalogCategory>(
			`catalog-items/categories/${id}`,
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async deleteAdminCatalogCategory(id: number) {
		return this.delete<{ success: boolean }>(
			`catalog-items/categories/${id}`,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async getAdminTenantProductCategories(tenantId: number) {
		return this.get<AdminTenantProductCategory[]>(
			`tenants/${tenantId}/product-categories`,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async createAdminTenantProductCategory(tenantId: number, payload: { name: string }) {
		return this.post<AdminTenantProductCategory>(
			`tenants/${tenantId}/product-categories`,
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async updateAdminTenantProductCategory(
		tenantId: number,
		categoryId: number,
		payload: { name: string },
	) {
		return this.patch<AdminTenantProductCategory>(
			`tenants/${tenantId}/product-categories/${categoryId}`,
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async deleteAdminTenantProductCategory(tenantId: number, categoryId: number) {
		return this.delete<{ success: boolean }>(
			`tenants/${tenantId}/product-categories/${categoryId}`,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async createAdminCatalogItem(payload: AdminCatalogItemPayload) {
		return this.post<AdminCatalogItem>(
			"catalog-items",
			payload,
			undefined,
			{
				...ADMIN_AUTH_OPTIONS,
				timeoutMs: payload instanceof FormData ? 30000 : undefined,
			}
		);
	}

	public async updateAdminCatalogItem(
		id: number,
		payload: UpdateAdminCatalogItemPayload,
	) {
		return this.patch<AdminCatalogItem>(
			`catalog-items/${id}`,
			payload,
			undefined,
			{
				...ADMIN_AUTH_OPTIONS,
				timeoutMs: payload instanceof FormData ? 30000 : undefined,
			}
		);
	}

	public async deleteAdminCatalogItem(id: number) {
		return this.delete<{ success: boolean }>(
			`catalog-items/${id}`,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async bulkUpdateAdminCatalogItems(payload: BulkUpdateAdminCatalogItemsPayload) {
		return this.patch<{ success: boolean; count: number }>(
			"catalog-items/bulk",
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async getPlans() {
		return this.get<AdminPlan[]>("plans", undefined, ADMIN_AUTH_OPTIONS);
	}

	public async togglePlanStatus(id: number, is_active: boolean) {
		return this.patch<AdminPlan>(`plans/${id}/status`, { is_active }, undefined, ADMIN_AUTH_OPTIONS);
	}

	public async createImport(formData: FormData) {
		return this.post<ImportRun>("imports", formData, undefined, {
			...ADMIN_AUTH_OPTIONS,
			timeoutMs: 30000,
		});
	}

	public async getImports() {
		return this.get<ImportRun[]>("imports", undefined, ADMIN_AUTH_OPTIONS);
	}

	public async getImport(id: number) {
		return this.get<ImportRun>(`imports/${id}`, undefined, ADMIN_AUTH_OPTIONS);
	}

	public async cancelImport(id: number) {
		return this.post<{ success: boolean; message: string }>(`imports/${id}/cancel`, undefined, undefined, ADMIN_AUTH_OPTIONS);
	}

	public async getImportErrors(id: number) {
		return this.get<ImportRowError[]>(`imports/${id}/errors`, undefined, ADMIN_AUTH_OPTIONS);
	}

	public async getProducts(
		tenantName?: string,
		productName?: string,
		tenantCategory?: "grocery" | "pharmacy",
		page?: number,
		limit?: number,
	) {
		const params = new URLSearchParams();
		if (tenantName) params.append("tenantName", tenantName);
		if (productName) params.append("productName", productName);
		if (tenantCategory) params.append("tenantCategory", tenantCategory);
		if (page) params.append("page", String(page));
		if (limit) params.append("limit", String(limit));
		const qs = params.toString() ? `?${params.toString()}` : '';
		return this.get<AdminPaginatedResponse<AdminProduct>>(`products${qs}`, undefined, ADMIN_AUTH_OPTIONS);
	}

	public async getOrders(
		clientName?: string,
		totalCost?: string,
		page?: number,
		limit?: number,
	) {
		const params = new URLSearchParams();
		if (clientName) params.append("clientName", clientName);
		if (totalCost) params.append("totalCost", totalCost);
		if (page) params.append("page", String(page));
		if (limit) params.append("limit", String(limit));
		const qs = params.toString() ? `?${params.toString()}` : '';
		return this.get<AdminPaginatedResponse<AdminOrder>>(`orders${qs}`, undefined, ADMIN_AUTH_OPTIONS);
	}

	private buildQueryString(params?: {
		catalogType?: AdminCatalogType;
		source?: AdminCatalogSource;
		search?: string;
		category?: string;
		status?: "all" | "active" | "inactive";
		essentialStatus?: "all" | "essential" | "non_essential";
		page?: number;
		limit?: number;
	}) {
		const searchParams = new URLSearchParams();
		if (params?.catalogType) {
			searchParams.append("catalogType", params.catalogType);
		}
		if (params?.source) searchParams.append("source", params.source);
		if (params?.search) searchParams.append("search", params.search);
		if (params?.category) searchParams.append("category", params.category);
		if (params?.status && params.status !== "all") {
			searchParams.append("status", params.status);
		}
		if (params?.essentialStatus && params.essentialStatus !== "all") {
			searchParams.append("essentialStatus", params.essentialStatus);
		}
		if (params?.page) searchParams.append("page", String(params.page));
		if (params?.limit) searchParams.append("limit", String(params.limit));
		return searchParams.toString() ? `?${searchParams.toString()}` : "";
	}
}

export const adminService = new AdminApiService();
