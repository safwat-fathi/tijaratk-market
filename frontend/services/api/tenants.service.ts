import HttpService from "@/services/base/http.service";
import { Tenant } from "@/types/models/tenant";

const PUBLIC_STOREFRONT_REVALIDATE_SECONDS = 60;

type UpdateTenantDeliverySettingsRequest = {
  delivery_fee: number;
  delivery_available: boolean;
  delivery_starts_at?: string;
  delivery_ends_at?: string;
};

class TenantsService extends HttpService {
  constructor() {
    super("/tenants");
  }

  public async getPublicTenant(slug: string) {
    return this.get<Tenant>(`public/${slug}`, undefined, {
      next: { revalidate: PUBLIC_STOREFRONT_REVALIDATE_SECONDS },
    });
  }

  public async getMyTenant() {
    return this.get<Tenant>("me", undefined, {
      authRequired: true,
      cache: "no-store",
    });
  }

  public async updateMyDeliverySettings(
    payload: UpdateTenantDeliverySettingsRequest,
  ) {
    return this.patch<Tenant>("me/delivery", payload, undefined, {
      authRequired: true,
    });
  }
}

export const tenantsService = new TenantsService();
