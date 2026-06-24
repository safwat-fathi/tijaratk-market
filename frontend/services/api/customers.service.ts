import HttpService from "@/services/base/http.service";
import { Customer } from "@/types/models/customer";
import { Order } from "@/types/models/order";

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
		return this.get<CustomersListResponse>("", params, { authRequired: true, cache: "no-store" });
	}

	public async getCustomer(id: number) {
		return this.get<Customer>(`${id}`, undefined, { authRequired: true, cache: "no-store" });
	}

	public async getPublicCustomerByPhone(slug: string, phone: string) {
		return this.get<PublicCustomerProfile | null>(`public/${slug}/by-phone`, { phone }, {
			cache: "no-store",
		});
	}

	public async getPublicCustomerByAccessCode(input: {
		code: string;
		phone: string;
	}) {
		return this.get<PublicCustomerProfile | null>(
			"public/by-access-code/profile",
			input,
			{ cache: "no-store" },
		);
	}

	public async getPublicOrdersByAccessCode(input: {
		code: string;
		phone: string;
	}) {
		return this.get<Order[]>("public/by-access-code/orders", input, {
			cache: "no-store",
		});
	}
}

export const customersService = new CustomersService();
