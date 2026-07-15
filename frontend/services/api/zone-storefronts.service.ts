import HttpService from "@/services/base/http.service";
import type { CreateOrderRequest } from "@/types/services/orders";
import type {
  ZonePublicCategory,
  ZonePublicProductsResponse,
  ZoneStorefront,
} from "@/types/models/zone-storefront";

/** Public server-side client for central zone storefronts. */
class ZoneStorefrontsService extends HttpService {
  constructor() {
    super("/zone-storefronts");
  }

  public async getPublicZones() {
    return this.get<ZoneStorefront[]>("public", undefined, {
      cache: "no-store",
    });
  }

  public async getPublicZone(slug: string) {
    return this.get<ZoneStorefront>(`public/${slug}`, undefined, {
      cache: "no-store",
    });
  }

  public async getPublicProducts(
    slug: string,
    params?: { search?: string; category?: string; page?: number; limit?: number },
  ) {
    return this.get<ZonePublicProductsResponse>(
      `public/${slug}/products`,
      params,
      { cache: "no-store" },
    );
  }

  public async getPublicCategories(slug: string) {
    return this.get<ZonePublicCategory[]>(
      `public/${slug}/categories`,
      undefined,
      { cache: "no-store" },
    );
  }

  public async createPublicOrder(
    slug: string,
    payload: CreateOrderRequest | FormData,
  ) {
    return this.post<{
      id: number;
      public_token: string;
      customer_access_code?: string;
    }>(`public/${slug}/orders`, payload);
  }
}

export const zoneStorefrontsService = new ZoneStorefrontsService();
