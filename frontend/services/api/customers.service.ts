import HttpService from "@/services/base/http.service";
import { Customer } from "@/types/models/customer";

type CustomersListMeta = {
	total: number;
	page: number;
	last_page: number;
	limit?: number;
	has_next?: boolean;
};

type CustomersListResponse = {
	data: Customer[];
	meta: CustomersListMeta;
};

export type PublicCustomerProfile = Pick<Customer, "name" | "phone" | "notes"> & {
	addresses: string[];
};

class CustomersService extends HttpService {
	constructor() {
		super("/customers");
	}

	public async getCustomers(params?: { search?: string; page?: number; limit?: number }) {
		return this.get<CustomersListResponse>("", params, { authRequired: true });
	}

	public async getCustomer(id: number) {
		return this.get<Customer>(`${id}`, undefined, { authRequired: true });
	}

	public async getPublicCustomerByPhone(slug: string, phone: string) {
		return this.get<PublicCustomerProfile | null>(`public/${slug}/by-phone`, { phone }, {
			cache: "no-store",
		});
	}
}

export const customersService = new CustomersService();
