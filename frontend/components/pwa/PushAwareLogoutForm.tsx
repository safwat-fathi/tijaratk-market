"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { unsubscribePushNotificationsAction } from "@/actions/push-notification-actions";
import {
  PUSH_SCOPES,
  type PushScope,
} from "@/types/services/push-notifications";

type PushAwareLogoutFormProps = {
  scope: PushScope;
  logoutAction: (formData: FormData) => void | Promise<void>;
};

/** Removes only this device's scoped subscription before clearing its login. */
export const PushAwareLogoutForm = ({
  scope,
  logoutAction,
}: PushAwareLogoutFormProps) => {
  const [pending, setPending] = useState(false);

  const handleLogout = async () => {
    if (pending) return;
    setPending(true);
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration(
          PUSH_SCOPES[scope],
        );
        const subscription = registration?.pushManager
          ? await registration.pushManager.getSubscription()
          : null;
        if (subscription) {
          try {
            await unsubscribePushNotificationsAction(scope, subscription.endpoint);
          } finally {
            await subscription.unsubscribe();
          }
        }
      }
    } catch {
      // Browser-side unsubscribe remains best effort; expired endpoints are pruned by delivery.
    }
    await logoutAction(new FormData());
  };

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={handleLogout}
      className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
    >
      {pending ? "جارٍ تسجيل الخروج..." : "تسجيل خروج"}
    </Button>
  );
};
