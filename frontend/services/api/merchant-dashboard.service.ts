import HttpService from "@/services/base/http.service";
import {
  DashboardPeriod,
  MerchantDashboardMeasurements,
} from "@/types/services/merchant-dashboard";

class MerchantDashboardService extends HttpService {
  constructor() {
    super("/dashboard");
  }

  public async getMeasurements(period: DashboardPeriod = "today") {
    return this.get<MerchantDashboardMeasurements>(
      "measurements",
      { period },
      { authRequired: true },
    );
  }
}

export const merchantDashboardService = new MerchantDashboardService();
