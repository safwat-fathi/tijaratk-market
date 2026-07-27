import HttpService from "@/services/base/http.service";
import {
  StoresDirectoryCategoryPage,
  StoresDirectoryLanding,
} from "@/types/models/stores-directory";
import { TenantDirectoryProfile, DirectoryArea, MissingDeliveryAreaRequest } from "@/types/models/tenant";
import { IParams } from "@/types/services/base";

const STORES_DIRECTORY_REVALIDATE_SECONDS = 300;

class StoresDirectoryService extends HttpService {
  constructor() {
    super("/stores");
  }

  public async getLanding() {
    return this.get<StoresDirectoryLanding>("", undefined, {
      next: { revalidate: STORES_DIRECTORY_REVALIDATE_SECONDS },
    });
  }

  public async getCategoryPage(
    areaSlug: string,
    categorySlug: string,
    params?: IParams & { delivery_area_slug?: string },
  ) {
    return this.get<StoresDirectoryCategoryPage>(
      `areas/${areaSlug}/categories/${categorySlug}`,
      params,
      {
        next: { revalidate: STORES_DIRECTORY_REVALIDATE_SECONDS },
      },
    );
  }
}
class MerchantDirectoryService extends HttpService {
  constructor() {
    super("/merchant");
  }

  public async getProfile() {
    return this.get<TenantDirectoryProfile>("directory-profile", undefined, {
      authRequired: true,
      cache: "no-store",
    });
  }

  public async updateProfile(payload: {
    area_id?: number;
  }) {
    return this.patch<TenantDirectoryProfile>("directory-profile", payload, undefined, {
      authRequired: true,
    });
  }

  public async getActiveAreas() {
    return this.getList<DirectoryArea[]>("areas", undefined, {
      authRequired: true,
      cache: "no-store",
    });
  }

  public async getMissingDeliveryAreaRequest(mainAreaId?: number) {
    return this.get<MissingDeliveryAreaRequest | null>(
      "missing-delivery-area-request",
      mainAreaId ? { mainAreaId } : undefined,
      { authRequired: true, cache: "no-store" },
    );
  }

  public async createMissingDeliveryAreaRequest(payload: {
    main_area_id: number;
    requested_area_name: string;
    note?: string;
  }) {
    return this.post<MissingDeliveryAreaRequest>(
      "missing-delivery-area-request",
      payload,
      undefined,
      { authRequired: true },
    );
  }
}

export const storesDirectoryService = new StoresDirectoryService();
export const merchantDirectoryService = new MerchantDirectoryService();
