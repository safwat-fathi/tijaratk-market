import "server-only";

import { cache } from "react";
import { adminService } from "@/services/api/admin.service";
import { ordersService } from "@/services/api/orders.service";
import { merchantPushNotificationsService } from "@/services/api/push-notifications.service";
import { tenantsService } from "@/services/api/tenants.service";

/** Per-request authenticated reads shared by layouts and their pages. */
export const getCurrentAdminCached = cache(() =>
  adminService.getCurrentAdmin(),
);

export const getMyTenantCached = cache(() => tenantsService.getMyTenant());

export const getInboxSummaryCached = cache((date?: string) =>
  ordersService.getInboxSummary(date),
);

export const getPushNotificationsConfigCached = cache(() =>
  merchantPushNotificationsService.getConfig(),
);
