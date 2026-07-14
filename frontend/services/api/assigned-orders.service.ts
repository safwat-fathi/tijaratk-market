import HttpService from "@/services/base/http.service";
import type {
  AssignedOrderReplacementProduct,
  ZoneOrderDispatch,
} from "@/types/models/zone-storefront";

/** Authenticated merchant client for manually assigned zone orders. */
class AssignedOrdersService extends HttpService {
  constructor() {
    super("/assigned-orders");
  }

  public async getAssignedOrders() {
    return this.get<ZoneOrderDispatch[]>("", undefined, {
      authRequired: true,
      cache: "no-store",
    });
  }

  public async getAssignedOrder(dispatchId: number) {
    return this.get<ZoneOrderDispatch>(String(dispatchId), undefined, {
      authRequired: true,
      cache: "no-store",
    });
  }

  public async getReplacementProducts(dispatchId: number) {
    return this.get<AssignedOrderReplacementProduct[]>(
      `${dispatchId}/replacement-products`,
      undefined,
      { authRequired: true, cache: "no-store" },
    );
  }

  public async updateQuoteLine(
    dispatchId: number,
    itemId: number,
    payload: { total_price: number; expected_version: number },
  ) {
    return this.patch<ZoneOrderDispatch>(
      `${dispatchId}/items/${itemId}/quote`,
      payload,
      undefined,
      { authRequired: true },
    );
  }

  public async accept(dispatchId: number, expectedVersion: number) {
    return this.post<ZoneOrderDispatch>(
      `${dispatchId}/accept`,
      { expected_version: expectedVersion },
      undefined,
      { authRequired: true },
    );
  }

  public async reject(
    dispatchId: number,
    payload: { expected_version: number; reason: string },
  ) {
    return this.post<{ status: string }>(
      `${dispatchId}/reject`,
      payload,
      undefined,
      { authRequired: true },
    );
  }

  public async updateStatus(dispatchId: number, status: string) {
    return this.patch<ZoneOrderDispatch>(
      `${dispatchId}/status`,
      { status },
      undefined,
      { authRequired: true },
    );
  }

  public async updateReplacement(
    dispatchId: number,
    itemId: number,
    replacementProductId: number | null,
  ) {
    return this.patch<{ id: number }>(
      `${dispatchId}/items/${itemId}/replacement`,
      { replacement_product_id: replacementProductId },
      undefined,
      { authRequired: true },
    );
  }

  public async resetReplacement(dispatchId: number, itemId: number) {
    return this.post<{ id: number }>(
      `${dispatchId}/items/${itemId}/replacement/reset`,
      {},
      undefined,
      { authRequired: true },
    );
  }
}

export const assignedOrdersService = new AssignedOrdersService();
