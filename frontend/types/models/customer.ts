export interface CustomerOrderSummary {
	id: number;
	created_at: string;
	total?: number | string | null;
	status: string;
}

export interface Customer {
	id: number;
	tenant_id: number;
	global_customer_id?: number | null;
	phone: string;
	code: number;
	merchant_label?: string;
	name?: string;
	address?: string;
	notes?: string;
	first_order_at?: string;
	last_order_at?: string;
	order_count: number;
	completed_order_count: number;
	created_at: string;
	updated_at: string;
	orders?: CustomerOrderSummary[];
}
