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
import type { Order } from "@/types/models/order";
import type {
	AdminAuditLogsResponse,
	GetAdminAuditLogsParams,
} from "@/types/models/admin-audit-log";
import type {
	AdminZoneStorefront,
	EligibleZoneMerchant,
	ManagedZoneDispatchContext,
	ZoneEssentialCatalogSyncResult,
	ZoneOrderDispatch,
} from "@/types/models/zone-storefront";

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
	pendingApplications: number;
	totalOrders: number;
	completedOrders: number;
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
	child_count?: number;
	active_child_count?: number;
};

export type AdminDirectoryAreasQuery = {
	page: number;
	limit: number;
	search?: string;
	kind?: "main" | "sub";
	parentId?: number;
	status?: "active" | "inactive";
	governorate?: string;
	city?: string;
	attention?:
		| "any"
		| "main_without_active_children"
		| "missing_english"
		| "missing_location"
		| "orphaned_child";
};

export type AdminDirectoryAreasResponse = {
	data: AdminDirectoryArea[];
	meta: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
	facets: {
		main_areas: Array<Pick<AdminDirectoryArea, "id" | "name_ar" | "is_active">>;
		governorates: string[];
		cities: Array<{ name: string; governorate: string | null }>;
	};
};

export type AdminDirectoryAreaPayload = Pick<
	AdminDirectoryArea,
	| "name_ar"
	| "name_en"
	| "slug"
	| "parent_area_id"
	| "city"
	| "governorate"
	| "is_active"
>;

export type AdminMissingDeliveryAreaRequest = {
	id: number;
	main_area_id: number;
	requested_area_name: string;
	note: string | null;
	status: "pending" | "resolved";
	created_at: string;
	resolved_at: string | null;
	tenant: { id: number; name: string; slug: string; phone: string };
	main_area: Pick<AdminDirectoryArea, "id" | "name_ar" | "name_en" | "slug">;
	resolved_area: Pick<AdminDirectoryArea, "id" | "name_ar" | "name_en" | "slug"> | null;
	resolved_by_admin: { id: number; name: string } | null;
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
	id?: number;
	area_id: number;
	delivery_fee: number | string;
	is_active?: boolean;
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
	status: "pending" | "active" | "inactive" | "suspended" | "rejected";
	category?: AdminTenantCategory;
	delivery_available?: boolean;
	delivery_starts_at?: string | null;
	delivery_ends_at?: string | null;
	last_bulk_essentials_added_at?: string | null;
	_count?: AdminTenantCount;
	tenant_subscriptions?: AdminTenantSubscription[];
	directory_profile?: AdminTenantDirectoryProfile | null;
	tenant_delivery_areas?: AdminTenantDeliveryArea[];
	cancellation_policy?: AdminTenantCancellationPolicy;
	operated_zone_storefront?: {
		id: number;
		name: string;
		slug: string;
		is_active: boolean;
		area: Pick<AdminDirectoryArea, "id" | "name_ar" | "name_en" | "slug">;
	} | null;
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

type MoveAdminCatalogCategoryProductsPayload = {
	source: AdminCatalogSource;
	from_category: string;
	to_category: string;
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

export type AdminOrder = Order;

export type AdminOrderListItem = Pick<
	Order,
	| "id"
	| "tenant_id"
	| "customer_id"
	| "created_at"
	| "order_type"
	| "status"
	| "pricing_mode"
	| "subtotal"
	| "delivery_fee"
	| "total"
	| "free_text_payload"
	| "notes"
	| "card_on_delivery_requested"
> & {
	tenant?: Order["tenant"];
	customer_name?: string | null;
	customer_phone?: string | null;
	delivery_address?: string | null;
	customer: {
		name?: string | null;
		phone?: string | null;
		access_code?: string | null;
	};
	items: Array<
		Pick<
			Order["items"][number],
			| "id"
			| "order_id"
			| "name_snapshot"
			| "quantity"
			| "unit_price"
			| "total_price"
			| "notes"
			| "is_out_of_stock"
			| "replacement_decision_status"
			| "replaced_by_product"
			| "pending_replacement_product"
		>
	>;
};

export type AdminOrdersFilters = {
	search?: string;
	storeName?: string;
	status?: string;
	from?: string;
	to?: string;
	minTotal?: string;
	maxTotal?: string;
};

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

export type DeleteTenantProductsSummary = {
	totalCount: number;
	deletedCount: number;
	skippedCount: number;
	skippedReasons: Array<{
		reason: "active_order_reference";
		count: number;
	}>;
};

export type AdminRole = "platform_admin" | "operations_admin";

export type AdminManagedPermission =
	| "products.read"
	| "products.create"
	| "products.update"
	| "products.update_price"
	| "products.update_availability"
	| "products.archive"
	| "orders.read"
	| "orders.update_status"
	| "orders.update_pricing"
	| "orders.manage_replacements"
	| "customers.read_limited"
	| "activity_logs.read"
	| "dispatches.read"
	| "dispatches.assign"
	| "dispatches.cancel";

export type AdminProfile = {
	id: number;
	name: string;
	phone: string;
	role: AdminRole;
	is_active: boolean;
};

export type AdminTenantAccess = {
	id: number;
	admin_user_id: number;
	tenant_id: number;
	permissions: AdminManagedPermission[];
	is_active: boolean;
	granted_by_admin_id?: number | null;
	granted_at: string;
	expires_at?: string | null;
	revoked_at?: string | null;
	admin_user?: AdminProfile;
	granted_by_admin?: { id: number; name: string } | null;
};

export type AdminManagementSession = {
	id: number;
	admin_user_id: number;
	tenant_id: number;
	reason: string;
	started_at: string;
	last_active_at: string;
	expires_at: string;
	ended_at?: string | null;
	end_reason?: string | null;
	permissions: AdminManagedPermission[];
	tenant: {
		id: number;
		name: string;
		slug: string;
		status: string;
		operated_zone_storefront?: { id: number; slug: string } | null;
	};
};

export type AdminManagementSessionSummary = {
	id: number;
	reason: string;
	started_at: string;
	last_active_at: string;
	expires_at: string;
	ended_at?: string | null;
	end_reason?: string | null;
	ip_address?: string | null;
	admin_user: { id: number; name: string; role: AdminRole };
};

export type ManagedMerchantContext = {
	tenant: AdminTenant;
	current_admin_access: AdminTenantAccess | null;
	managed_stores_enabled: boolean;
};

type UpdateTenantDirectoryProfilePayload = {
	area_id?: number;
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

	public async getCurrentAdmin() {
		return this.get<AdminProfile>("me", undefined, ADMIN_AUTH_OPTIONS);
	}

	public async getAdminActivityLogs(params?: GetAdminAuditLogsParams) {
		return this.get<AdminAuditLogsResponse>(
			"activity-logs",
			params ? { ...params } : undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async getAssignedTenants() {
		return this.get<Array<AdminTenant & { access: AdminTenantAccess }>>(
			"managed-tenants",
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async getManagedMerchantContext(tenantId: number) {
		return this.get<ManagedMerchantContext>(
			`managed-tenants/${tenantId}/context`,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async getAdminUsers() {
		return this.get<AdminProfile[]>("admin-users", undefined, ADMIN_AUTH_OPTIONS);
	}

	public async getTenantAccesses(tenantId: number) {
		return this.get<AdminTenantAccess[]>(
			`tenants/${tenantId}/accesses`,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async upsertTenantAccess(
		tenantId: number,
		adminUserId: number,
		payload: { permissions: AdminManagedPermission[]; expires_at?: string | null },
	) {
		return this.put<AdminTenantAccess>(
			`tenants/${tenantId}/accesses/${adminUserId}`,
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async revokeTenantAccess(tenantId: number, adminUserId: number) {
		return this.delete<{ success: boolean }>(
			`tenants/${tenantId}/accesses/${adminUserId}`,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async getTenantManagementSessions(tenantId: number) {
		return this.get<AdminManagementSessionSummary[]>(
			`tenants/${tenantId}/management-sessions`,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async startManagementSession(payload: { tenant_id: number; reason: string }) {
		return this.post<{
			session_token: string;
			session: AdminManagementSession;
		}>("management-sessions", payload, undefined, ADMIN_AUTH_OPTIONS);
	}

	public async getCurrentManagementSession() {
		return this.get<AdminManagementSession | null>(
			"management-sessions/current",
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async endCurrentManagementSession() {
		return this.delete<{ success: boolean }>(
			"management-sessions/current",
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async getManagedProducts(
		tenantId: number,
		params?: { status?: ProductStatus | string; page?: number; limit?: number; search?: string; category?: string } | ProductStatus | string,
	) {
		const queryParams = typeof params === "string" ? { status: params } : params || { status: "active" };
		return this.get<Product[] | TenantProductsSearchResponse>(
			`managed-tenants/${tenantId}/products`,
			queryParams,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async getManagedProduct(tenantId: number, productId: number) {
		return this.get<Product>(
			`managed-tenants/${tenantId}/products/${productId}`,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async getManagedProductCategories(tenantId: number) {
		return this.get<string[]>(
			`managed-tenants/${tenantId}/product-categories`,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async getManagedCatalog(
		tenantId: number,
		params?: { page?: number; limit?: number; category?: string; search?: string } | number,
	) {
		const limit = typeof params === "number" ? params : params?.limit || 40;
		const page = typeof params === "object" && params.page ? params.page : 1;
		const category = typeof params === "object" ? params.category : undefined;
		const search = typeof params === "object" ? params.search : undefined;

		return this.get<CatalogItemsResponse>(
			`managed-tenants/${tenantId}/catalog`,
			{ page, limit, category, search },
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async createManagedProduct(tenantId: number, payload: AdminProductPayload) {
		return this.post<Product>(
			`managed-tenants/${tenantId}/products`,
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async addManagedProductFromCatalog(tenantId: number, catalogItemId: number) {
		return this.post<Product>(
			`managed-tenants/${tenantId}/products/from-catalog`,
			{ catalog_item_id: catalogItemId },
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async updateManagedProduct(
		tenantId: number,
		productId: number,
		section: "details" | "price" | "availability" | "status",
		payload: Record<string, unknown>,
	) {
		return this.patch<Product>(
			`managed-tenants/${tenantId}/products/${productId}/${section}`,
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async bulkUpdateManagedProducts(
		tenantId: number,
		payload: { ids: number[]; is_available?: boolean; status?: ProductStatus; category?: string },
	) {
		return this.patch<{ success: boolean; count: number }>(
			`managed-tenants/${tenantId}/products/bulk`,
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async getManagedOrders(tenantId: number, date?: string) {
		return this.get<AdminOrder[]>(
			`managed-tenants/${tenantId}/orders`,
			date ? { date } : undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async getManagedOrder(tenantId: number, orderId: number) {
		return this.get<AdminOrder>(
			`managed-tenants/${tenantId}/orders/${orderId}`,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async updateManagedOrderStatus(
		tenantId: number,
		orderId: number,
		payload: { status: string; cancellation_reason?: string },
	) {
		return this.patch<AdminOrder>(
			`managed-tenants/${tenantId}/orders/${orderId}/status`,
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async updateManagedOrderPricing(tenantId: number, orderId: number, total: number) {
		return this.patch<AdminOrder>(
			`managed-tenants/${tenantId}/orders/${orderId}/pricing`,
			{ total },
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async updateManagedOrderItem(
		tenantId: number,
		itemId: number,
		action: "price" | "out-of-stock" | "replacement" | "replacement-reset",
		payload: Record<string, unknown> = {},
	) {
		return this.patch<unknown>(
			`managed-tenants/${tenantId}/orders/items/${itemId}/${action}`,
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async getManagedActivityLogs(
		tenantId: number,
		params?: { entity_type?: string; entity_id?: number; cursor?: number; limit?: number },
	) {
		return this.get<{ items: import("@/types/models/activity-log").ActivityLog[]; next_cursor: number | null }>(
			`managed-tenants/${tenantId}/activity-logs`,
			params,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async getZones() {
		return this.get<AdminZoneStorefront[]>("zones", undefined, ADMIN_AUTH_OPTIONS);
	}

	public async getZone(zoneId: number) {
		return this.get<AdminZoneStorefront>(`zones/${zoneId}`, undefined, ADMIN_AUTH_OPTIONS);
	}

	public async getEligibleZoneMerchants(zoneId: number) {
		return this.get<EligibleZoneMerchant[]>(
			`zones/${zoneId}/eligible-merchants`,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async syncZoneEssentialCatalog(zoneId: number) {
		return this.post<ZoneEssentialCatalogSyncResult>(
			`zones/${zoneId}/catalog/sync-essentials`,
			{},
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async createZone(payload: {
		name: string;
		slug: string;
		area_id: number;
		category: "grocery" | "pharmacy";
		operations_phone: string;
		delivery_fee?: number;
	}) {
		return this.post<AdminZoneStorefront>(
			"zones",
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async updateZoneActivation(zoneId: number, isActive: boolean) {
		return this.patch<AdminZoneStorefront>(
			`zones/${zoneId}/activation`,
			{ is_active: isActive },
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async updateZoneDeliveryFees(
		zoneId: number,
		payload: {
			delivery_areas: Array<{ area_id: number; delivery_fee: number }>;
		},
	) {
		return this.patch<AdminZoneStorefront>(
			`zones/${zoneId}/delivery-fees`,
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async updateZoneOperatingHours(
		zoneId: number,
		payload: { delivery_starts_at: string; delivery_ends_at: string },
	) {
		return this.patch<AdminZoneStorefront>(
			`zones/${zoneId}/operating-hours`,
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async upsertZoneMerchant(
		zoneId: number,
		payload: { tenant_id: number; priority?: number; is_active?: boolean },
	) {
		return this.post<AdminZoneStorefront>(
			`zones/${zoneId}/merchants`,
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async getManagedZoneDispatches(tenantId: number, status?: string) {
		return this.get<ZoneOrderDispatch[]>(
			`managed-tenants/${tenantId}/zone-dispatches`,
			status ? { status } : undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async getManagedZoneDispatchContext(tenantId: number) {
		return this.get<ManagedZoneDispatchContext>(
			`managed-tenants/${tenantId}/zone-dispatches/context`,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async getManagedZoneDispatch(tenantId: number, dispatchId: number) {
		return this.get<ZoneOrderDispatch>(
			`managed-tenants/${tenantId}/zone-dispatches/${dispatchId}`,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async assignManagedZoneDispatch(
		tenantId: number,
		dispatchId: number,
		payload: {
			target_tenant_id: number;
			expected_version: number;
			internal_notes?: string;
		},
	) {
		return this.post<ZoneOrderDispatch>(
			`managed-tenants/${tenantId}/zone-dispatches/${dispatchId}/assign`,
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async cancelManagedZoneDispatch(
		tenantId: number,
		dispatchId: number,
		payload: { expected_version: number; reason: string },
	) {
		return this.post<ZoneOrderDispatch>(
			`managed-tenants/${tenantId}/zone-dispatches/${dispatchId}/cancel`,
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
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

	public async getDirectoryAreasForManagement(params: AdminDirectoryAreasQuery) {
		return this.get<AdminDirectoryAreasResponse>(
			"directory/areas",
			params,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async createDirectoryArea(payload: AdminDirectoryAreaPayload) {
		return this.post<AdminDirectoryArea>("directory/areas", payload, undefined, ADMIN_AUTH_OPTIONS);
	}

	public async updateDirectoryArea(id: number, payload: AdminDirectoryAreaPayload) {
		return this.patch<AdminDirectoryArea>(`directory/areas/${id}`, payload, undefined, ADMIN_AUTH_OPTIONS);
	}

	public async deleteDirectoryArea(id: number) {
		return this.delete<{ success: boolean }>(`directory/areas/${id}`, undefined, ADMIN_AUTH_OPTIONS);
	}

	public async getMissingDeliveryAreaRequests(status?: "pending" | "resolved") {
		return this.get<AdminMissingDeliveryAreaRequest[]>(
			"missing-delivery-area-requests",
			status ? { status } : undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async resolveMissingDeliveryAreaRequest(id: number, resolved_area_id: number) {
		return this.patch<AdminMissingDeliveryAreaRequest>(
			`missing-delivery-area-requests/${id}/resolve`,
			{ resolved_area_id },
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
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

	public async updateTenantDeliveryConfiguration(
		id: number,
		payload: {
			delivery_available: boolean;
			delivery_starts_at?: string | null;
			delivery_ends_at?: string | null;
			main_area_ids: number[];
			delivery_areas: Array<{ area_id: number; delivery_fee: number }>;
		},
	) {
		return this.patch<AdminTenant>(
			`tenants/${id}/delivery-configuration`,
			payload,
			undefined,
			ADMIN_AUTH_OPTIONS,
		);
	}

	public async getTenantBulkEssentialStages(tenantId: number) {
		return this.get<BulkEssentialStage[]>(
			`managed-tenants/${tenantId}/bulk-essentials/stages`,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async adminBulkAddEssentialItems(
		tenantId: number,
		payload:
			| { all_essential_items: boolean }
			| { category: string; catalog_item_ids: number[] }
			| { categories: string[] },
	) {
		return this.post<{ count: number }>(
			`managed-tenants/${tenantId}/bulk-essentials`,
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

	public async deleteTenantProducts(tenantId: number) {
		return this.delete<DeleteTenantProductsSummary>(
			`tenants/${tenantId}/products`,
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

	public getAdminCatalogExportPath(
		catalogType: AdminCatalogType,
		essentialStatus: "all" | "essential" | "non_essential" = "all",
	) {
		const qs = this.buildQueryString({
			catalogType,
			essentialStatus:
				essentialStatus === "all" ? undefined : essentialStatus,
		});
		return `/api/admin/catalog-items/export${qs}`;
	}

	public async createAdminCatalogCategory(payload: FormData) {
		return this.post<AdminCatalogCategory>(
			"catalog-items/categories",
			payload,
			undefined,
			{
				...ADMIN_AUTH_OPTIONS,
				timeoutMs: 30000,
			}
		);
	}

	public async updateAdminCatalogCategory(
		id: number,
		payload: FormData,
	) {
		return this.patch<AdminCatalogCategory>(
			`catalog-items/categories/${id}`,
			payload,
			undefined,
			{
				...ADMIN_AUTH_OPTIONS,
				timeoutMs: 30000,
			}
		);
	}

	public async deleteAdminCatalogCategory(id: number) {
		return this.delete<{ success: boolean }>(
			`catalog-items/categories/${id}`,
			undefined,
			ADMIN_AUTH_OPTIONS
		);
	}

	public async moveAdminCatalogCategoryProducts(
		payload: MoveAdminCatalogCategoryProductsPayload,
	) {
		return this.post<{ success: boolean; count: number }>(
			"catalog-items/categories/move-products",
			payload,
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
		filters: AdminOrdersFilters = {},
		page?: number,
		limit?: number,
	) {
		const params = new URLSearchParams();
		Object.entries(filters).forEach(([key, value]) => {
			if (value) params.append(key, value);
		});
		if (page) params.append("page", String(page));
		if (limit) params.append("limit", String(limit));
		const qs = params.toString() ? `?${params.toString()}` : '';
		return this.get<AdminPaginatedResponse<AdminOrderListItem>>(`orders${qs}`, undefined, ADMIN_AUTH_OPTIONS);
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
