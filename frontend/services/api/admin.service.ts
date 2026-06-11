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

type AdminTenant = Record<string, unknown>;

type AdminPlan = {
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

class AdminApiService extends HttpService {
	constructor() {
		super("/admin");
		this._tokenKey = STORAGE_KEYS.ADMIN_ACCESS_TOKEN;
	}

	public async login(payload: AdminLoginPayload) {
		return this.post<AdminLoginResponse>("login", payload);
	}

	public async logout() {
		try {
			await this.post("logout", {});
		} catch (error) {
			console.error("Admin logout API call failed:", error);
		}
		return { success: true };
	}

	public async getDashboardStats() {
		return this.get<AdminDashboardStats>("dashboard-stats");
	}

	public async getTenants() {
		return this.get<AdminTenant[]>("tenants");
	}

	public async updateTenantStatus(id: number, status: string) {
		return this.patch<AdminTenant>(`tenants/${id}/status`, { status });
	}

	public async updateTenantPlan(id: number, plan_id: number) {
		return this.patch<AdminTenant>(`tenants/${id}/plan`, { plan_id });
	}

	public async getPlans() {
		return this.get<AdminPlan[]>("plans");
	}

	public async togglePlanStatus(id: number, is_active: boolean) {
		return this.patch<AdminPlan>(`plans/${id}/status`, { is_active });
	}

	public async createImport(formData: FormData) {
		return this.post<ImportRun>("imports", formData, undefined, {
			timeoutMs: 30000,
		});
	}

	public async getImports() {
		return this.get<ImportRun[]>("imports");
	}

	public async getImport(id: number) {
		return this.get<ImportRun>(`imports/${id}`);
	}

	public async getImportErrors(id: number) {
		return this.get<ImportRowError[]>(`imports/${id}/errors`);
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
		return this.get<AdminPaginatedResponse<AdminProduct>>(`products${qs}`);
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
		return this.get<AdminPaginatedResponse<AdminOrder>>(`orders${qs}`);
	}
}

export const adminService = new AdminApiService();
