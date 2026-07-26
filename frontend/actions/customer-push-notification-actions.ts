"use server";

import { z } from "zod";
import {
  clearCustomerPushDeviceToken,
  getCustomerPushDeviceToken,
  getOrCreateCustomerPushDeviceToken,
} from "@/lib/pwa/customer-push-device-cookie";
import { getSavedAccessCodesFromCookie } from "@/lib/tracking/customer-tracking-cookie";
import { customerPushNotificationsService } from "@/services/api/push-notifications.service";
import type { BrowserPushSubscriptionPayload } from "@/types/services/push-notifications";

const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(4096),
  expirationTime: z.number().int().nonnegative().nullable(),
  keys: z.object({
    p256dh: z.string().min(16).max(512),
    auth: z.string().min(8).max(256),
  }),
});

export type CustomerPushActionResult = {
  success: boolean;
  linkedCustomers?: number;
  message?: string;
};

/** Registers or refreshes this private customer device and its saved identities. */
export async function syncCustomerPushSubscriptionAction(
  payload: BrowserPushSubscriptionPayload,
): Promise<CustomerPushActionResult> {
  const subscription = subscriptionSchema.parse(payload);
  const [deviceToken, identities] = await Promise.all([
    getOrCreateCustomerPushDeviceToken(),
    getSavedAccessCodesFromCookie(),
  ]);
  const response = await customerPushNotificationsService.subscribe({
    deviceToken,
    subscription,
    identities: identities.map(({ code, phone }) => ({ code, phone })),
  });

  return response.success
    ? {
        success: true,
        linkedCustomers: response.data?.linkedCustomers ?? 0,
      }
    : {
        success: false,
        message: response.message || "تعذر تفعيل إشعارات الطلبات.",
      };
}

/** Removes the server registration authenticated by the private device cookie. */
export async function disableCustomerPushSubscriptionAction(): Promise<CustomerPushActionResult> {
  const deviceToken = await getCustomerPushDeviceToken();
  if (!deviceToken) return { success: true };

  const response =
    await customerPushNotificationsService.unsubscribe(deviceToken);
  if (!response.success) {
    return {
      success: false,
      message: response.message || "تعذر إيقاف إشعارات الطلبات.",
    };
  }

  await clearCustomerPushDeviceToken();
  return { success: true };
}
