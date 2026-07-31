export const STORAGE_KEYS = {
  ACCESS_TOKEN: "access_token",
  USER: "user_info",
  PHONE_CHANGE_CHALLENGE: "phone_change_challenge",
  CUSTOMER_TRACKED_ORDERS: "customer_tracked_orders",
  CUSTOMER_AVAILABILITY_STATE: "customer_availability_state",
  ADMIN_ACCESS_TOKEN: "admin_access_token",
  ADMIN_MANAGEMENT_SESSION: "admin_management_session",
} as const;

export {
  TENANT_CATEGORIES,
  TENANT_CATEGORY_VALUES,
} from "./tenant-categories";
export type { TenantCategory } from "./tenant-categories";
