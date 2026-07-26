import { STORAGE_KEYS } from "@/constants";
import HttpService from "@/services/base/http.service";
import type {
  BrowserPushSubscriptionPayload,
  CustomerPushSubscriptionPayload,
  PushNotificationsConfig,
} from "@/types/services/push-notifications";

const AUTHENTICATED_OPTIONS = {
  authRequired: true,
  cache: "no-store" as const,
};

const PUSH_CONFIG_REVALIDATE_SECONDS = 300;
const PUBLIC_OPTIONS = {
  cache: "no-store" as const,
};

/** Server-only API client for anonymous customer PWA devices. */
class CustomerPushNotificationsService extends HttpService {
  constructor() {
    super("/push-notifications");
  }

  public getConfig() {
    return this.get<PushNotificationsConfig>("config", undefined, {
      next: { revalidate: PUSH_CONFIG_REVALIDATE_SECONDS },
    });
  }

  public subscribe(payload: CustomerPushSubscriptionPayload) {
    return this.post<{ subscribed: true; linkedCustomers: number }>(
      "customer/subscriptions",
      payload,
      undefined,
      PUBLIC_OPTIONS,
    );
  }

  public unsubscribe(deviceToken: string) {
    return this.delete<{ subscribed: false }>(
      "customer/subscriptions",
      undefined,
      {
        ...PUBLIC_OPTIONS,
        body: JSON.stringify({ deviceToken }),
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

/** Server-only API client for merchant Web Push subscription state. */
class MerchantPushNotificationsService extends HttpService {
  constructor() {
    super("/push-notifications");
  }

  public getConfig() {
    return this.get<PushNotificationsConfig>("config", undefined, {
      next: { revalidate: PUSH_CONFIG_REVALIDATE_SECONDS },
    });
  }

  public subscribe(payload: BrowserPushSubscriptionPayload) {
    return this.post<{ subscribed: true }>(
      "subscriptions",
      payload,
      undefined,
      AUTHENTICATED_OPTIONS,
    );
  }

  public unsubscribe(endpoint: string) {
    return this.delete<{ subscribed: false }>("subscriptions", undefined, {
      ...AUTHENTICATED_OPTIONS,
      body: JSON.stringify({ endpoint }),
      headers: { "Content-Type": "application/json" },
    });
  }
}

/** Server-only API client for administrator Web Push subscription state. */
class AdminPushNotificationsService extends HttpService {
  constructor() {
    super("/admin/push-notifications");
    this._tokenKey = STORAGE_KEYS.ADMIN_ACCESS_TOKEN;
    this._unauthorizedRedirectRoute = `/api/auth/admin/revoke?redirect=${encodeURIComponent("/admin/login")}`;
  }

  public subscribe(payload: BrowserPushSubscriptionPayload) {
    return this.post<{ subscribed: true }>(
      "subscriptions",
      payload,
      undefined,
      AUTHENTICATED_OPTIONS,
    );
  }

  public unsubscribe(endpoint: string) {
    return this.delete<{ subscribed: false }>("subscriptions", undefined, {
      ...AUTHENTICATED_OPTIONS,
      body: JSON.stringify({ endpoint }),
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const merchantPushNotificationsService =
  new MerchantPushNotificationsService();
export const adminPushNotificationsService =
  new AdminPushNotificationsService();
export const customerPushNotificationsService =
  new CustomerPushNotificationsService();
