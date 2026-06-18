import HttpService from "@/services/base/http.service";
import { Order } from "@/types/models/order";
import {
	CloseDayResponse,
	CreateOrderRequest,
	DayCloseTodayStatusResponse,
} from "@/types/services/orders";

class OrdersService extends HttpService {
	constructor() {
		super("/orders");
	}

	public async getOrders(date?: string) {
		const query = date ? `?date=${date}` : "";
		return this.get<Order[]>(`${query}`, undefined, { authRequired: true });
	}

	public async getTodayDayCloseStatus() {
		return this.get<DayCloseTodayStatusResponse>("day-close/today", undefined, {
			authRequired: true,
		});
	}

	public async closeDay() {
		return this.post<CloseDayResponse>("day-close", {}, undefined, {
			authRequired: true,
		});
	}

	public async getOrder(id: number) {
		return this.get<Order>(`${id}`, undefined, { authRequired: true });
	}

	// Public tracking endpoint
	public async getOrderByPublicToken(token: string) {
		return this.get<Order>(`tracking/${token}`);
	}

	public async getOrdersByPublicTokens(tokens: string[]) {
		const normalizedTokens = Array.from(
			new Set(
				tokens
					.map(token => token.trim())
					.filter(token => token.length > 0),
			),
		).slice(0, 15);

		if (normalizedTokens.length === 0) {
			return { success: true, data: [] as Order[] };
		}

		const query = new URLSearchParams();
		for (const token of normalizedTokens) {
			query.append("token", token);
		}

		return this.get<Order[]>(`tracking?${query.toString()}`);
	}

	public async createPublicOrder(
		tenantSlug: string,
		payload: CreateOrderRequest | FormData,
	) {
		return this.post<Order>(`${tenantSlug}`, payload);
	}

	public async updateOrder(
		id: number,
		payload: Partial<Pick<Order, "status" | "total">> & {
			cancellation_reason?: string;
		},
	) {
		return this.patch<Order>(`${id}`, payload, undefined, {
			authRequired: true,
		});
	}

	public async replaceOrderItem(
		itemId: number,
		payload: { replaced_by_product_id: number | null },
	) {
		return this.patch<{ id: number }>(
			`items/${itemId}/replace`,
			payload,
			undefined,
			{ authRequired: true },
		);
	}

	public async resetOrderItemReplacement(itemId: number) {
		return this.patch<{ id: number }>(
			`items/${itemId}/replacement-reset`,
			{},
			undefined,
			{ authRequired: true },
		);
	}

	public async decideReplacementByToken(
		token: string,
		itemId: number,
		payload: { decision: "approve" | "reject"; reason?: string },
	) {
		return this.patch<{ id: number }>(
			`tracking/${token}/items/${itemId}/replacement-decision`,
			payload,
		);
	}

	public async rejectOrderByToken(token: string, payload: { reason?: string }) {
		return this.patch<Order>(`tracking/${token}/reject`, payload);
	}

	public async updateOrderItemPrice(
		itemId: number,
		payload: { total_price: number },
	) {
		return this.patch<{ id: number; total_price: number }>(
			`items/${itemId}/price`,
			payload,
			undefined,
			{ authRequired: true },
		);
	}
}

export const ordersService = new OrdersService();
