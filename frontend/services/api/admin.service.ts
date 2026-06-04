import HttpService from "@/services/base/http.service";
import { STORAGE_KEYS } from "@/constants";

class AdminApiService extends HttpService {
	constructor() {
		super("/admin");
		this._tokenKey = STORAGE_KEYS.ADMIN_ACCESS_TOKEN;
	}

	public async login(payload: any) {
		return this.post<{ access_token: string, user: any }>("login", payload);
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
		return this.get<any>("dashboard-stats");
	}

	public async getTenants() {
		return this.get<any[]>("tenants");
	}

	public async updateTenantStatus(id: number, status: string) {
		return this.patch<any>(`tenants/${id}/status`, { status });
	}

	public async getPlans() {
		return this.get<any[]>("plans");
	}

	public async togglePlanStatus(id: number, is_active: boolean) {
		return this.patch<any>(`plans/${id}/status`, { is_active });
	}
}

export const adminService = new AdminApiService();
