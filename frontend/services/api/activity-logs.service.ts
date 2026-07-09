import HttpService from "@/services/base/http.service";
import type {
  ActivityLogsResponse,
  GetActivityLogsParams,
} from "@/types/models/activity-log";

class ActivityLogsService extends HttpService {
  constructor() {
    super("/activity-logs");
  }

  public async getActivityLogs(params?: GetActivityLogsParams) {
    return this.get<ActivityLogsResponse>("", params, {
      authRequired: true,
      cache: "no-store",
    });
  }
}

export const activityLogsService = new ActivityLogsService();
