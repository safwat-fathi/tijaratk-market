import HttpService from "@/services/base/http.service";
import { STORAGE_KEYS } from "@/constants";
import type { ImportRowError, ImportRun } from "@/types/models/import";

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

export type AdminTenant = {
	id: number;
	name: string;
	phone: string;
	slug: string;
	status: "active" | "inactive" | "suspended";
	_count?: AdminTenantCount;
	tenant_subscriptions?: AdminTenantSubscription[];
	directory_profile?: AdminTenantDirectoryProfile | null;
	tenant_delivery_areas?: AdminTenantDeliveryArea[];
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

type AdminProduct = Record<string, unknown>;
type AdminOrder = Record<string, unknown>;

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

	public async getTenants() {
		return this.get<AdminTenant[]>("tenants", undefined, ADMIN_AUTH_OPTIONS);
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

	public async getImportErrors(id: number) {
		return this.get<ImportRowError[]>(`imports/${id}/errors`, undefined, ADMIN_AUTH_OPTIONS);
	}

	public async getProducts(
		tenantName?: string,
		productName?: string,
		page?: number,
		limit?: number,
	) {
		const params = new URLSearchParams();
		if (tenantName) params.append("tenantName", tenantName);
		if (productName) params.append("productName", productName);
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
}

export const adminService = new AdminApiService();
