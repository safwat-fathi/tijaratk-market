import HttpService from "@/services/base/http.service";
import {
  DeliveryConfigurationInput,
  Tenant,
} from "@/types/models/tenant";

const PUBLIC_STOREFRONT_REVALIDATE_SECONDS = 60;

type UpdateTenantSettingsRequest = {
  name: string;
  category: string;
  instapay_account_name?: string;
  instapay_account_number?: string;
  ewallet_account_name?: string;
  ewallet_account_number?: string;
  card_on_delivery_available?: boolean;
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
    payload: DeliveryConfigurationInput,
  ) {
    return this.patch<Tenant>("me/delivery", payload, undefined, {
      authRequired: true,
    });
  }

  public async updateMyGeneralSettings(payload: UpdateTenantSettingsRequest) {
    return this.patch<Tenant>("me/general", payload, undefined, {
      authRequired: true,
    });
  }

  public async updateMyOnboardingProgress(payload: {
    onboarding_completed?: boolean;
    onboarding_step?: number;
  }) {
    return this.patch<Tenant>("me/onboarding", payload, undefined, {
      authRequired: true,
    });
  }
}

export const tenantsService = new TenantsService();
