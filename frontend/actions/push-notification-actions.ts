"use server";

import { z } from "zod";
import {
  adminPushNotificationsService,
  merchantPushNotificationsService,
} from "@/services/api/push-notifications.service";
import type {
  BrowserPushSubscriptionPayload,
  PushScope,
} from "@/types/services/push-notifications";

const pushScopeSchema = z.enum(["merchant", "admin"]);
const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(4096),
  expirationTime: z.number().int().nonnegative().nullable(),
  keys: z.object({
    p256dh: z.string().min(16).max(512),
    auth: z.string().min(8).max(256),
  }),
});

export type PushSubscriptionActionResult = {
  success: boolean;
  message?: string;
};

/** Persists a browser subscription using only server-held authentication. */
export async function subscribePushNotificationsAction(
  scope: PushScope,
  payload: BrowserPushSubscriptionPayload,
): Promise<PushSubscriptionActionResult> {
  const validScope = pushScopeSchema.parse(scope);
  const validPayload = subscriptionSchema.parse(payload);
  const service =
    validScope === "admin"
      ? adminPushNotificationsService
      : merchantPushNotificationsService;
  const response = await service.subscribe(validPayload);
  return response.success
    ? { success: true }
    : {
        success: false,
        message: response.message || "تعذر تفعيل الإشعارات.",
      };
}

/** Deletes the current actor's matching browser endpoint. */
export async function unsubscribePushNotificationsAction(
  scope: PushScope,
  endpoint: string,
): Promise<PushSubscriptionActionResult> {
  const validScope = pushScopeSchema.parse(scope);
  const validEndpoint = z
    .string()
    .url()
    .startsWith("https://")
    .max(4096)
    .parse(endpoint);
  const service =
    validScope === "admin"
      ? adminPushNotificationsService
      : merchantPushNotificationsService;
  const response = await service.unsubscribe(validEndpoint);
  return response.success
    ? { success: true }
    : {
        success: false,
        message: response.message || "تعذر إيقاف الإشعارات.",
      };
}
