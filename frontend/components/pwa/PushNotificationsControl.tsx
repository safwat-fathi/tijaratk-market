"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Loader2, X } from "lucide-react";
import { startTransition, useCallback, useEffect, useState } from "react";
import {
  subscribePushNotificationsAction,
  unsubscribePushNotificationsAction,
} from "@/actions/push-notification-actions";
import { cn } from "@/lib/utils";
import {
  PUSH_SCOPES,
  type BrowserPushSubscriptionPayload,
  type PushNotificationMessage,
  type PushNotificationsConfig,
  type PushScope,
} from "@/types/services/push-notifications";

type NotificationState =
  | "loading"
  | "unsupported"
  | "disabled"
  | "denied"
  | "available"
  | "subscribed"
  | "busy"
  | "error";

type PushNotificationsControlProps = {
  scope: PushScope;
  config: PushNotificationsConfig;
  className?: string;
};

const PUSH_MESSAGE_TYPES = new Set<PushNotificationMessage["type"]>([
  "merchant.order.created",
  "admin.order.created",
  "merchant.assignment.created",
]);

const isPushNotificationMessage = (
  value: unknown,
): value is PushNotificationMessage => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<PushNotificationMessage>;
  return (
    candidate.version === 1 &&
    typeof candidate.eventId === "string" &&
    typeof candidate.type === "string" &&
    PUSH_MESSAGE_TYPES.has(candidate.type as PushNotificationMessage["type"]) &&
    typeof candidate.title === "string" &&
    typeof candidate.body === "string" &&
    typeof candidate.url === "string" &&
    candidate.url.startsWith("/") &&
    !candidate.url.startsWith("//") &&
    typeof candidate.tag === "string" &&
    typeof candidate.createdAt === "string"
  );
};

const toApplicationServerKey = (value: string) => {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const decoded = window.atob(base64);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
};

const serializeSubscription = (
  subscription: PushSubscription,
): BrowserPushSubscriptionPayload | null => {
  const value = subscription.toJSON();
  if (
    typeof value.endpoint !== "string" ||
    !value.keys ||
    typeof value.keys.p256dh !== "string" ||
    typeof value.keys.auth !== "string"
  ) {
    return null;
  }
  return {
    endpoint: value.endpoint,
    expirationTime: value.expirationTime ?? null,
    keys: {
      p256dh: value.keys.p256dh,
      auth: value.keys.auth,
    },
  };
};

/** Registers one scoped PWA worker and owns opt-in Web Push interactions. */
export const PushNotificationsControl = ({
  scope,
  config,
  className,
}: PushNotificationsControlProps) => {
  const router = useRouter();
  const [state, setState] = useState<NotificationState>("loading");
  const [message, setMessage] = useState<PushNotificationMessage | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const registerWorker = useCallback(async () => {
    return navigator.serviceWorker.register(`/sw.js?app=${scope}`, {
      scope: PUSH_SCOPES[scope],
    });
  }, [scope]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setState("unsupported");
      return;
    }

    let cancelled = false;
    const initialize = async () => {
      try {
        const registration = await registerWorker();
        if (cancelled) return;
        if (!config.enabled || !config.publicKey) {
          setState("disabled");
          return;
        }
        if (!("PushManager" in window) || !("Notification" in window)) {
          setState("unsupported");
          return;
        }
        const existing = await registration.pushManager.getSubscription();
        if (cancelled) return;
        if (existing) {
          const payload = serializeSubscription(existing);
          if (payload) {
            const result = await subscribePushNotificationsAction(scope, payload);
            if (cancelled) return;
            setState(result.success ? "subscribed" : "error");
            setFeedback(result.message ?? null);
            return;
          }
        }
        setState(Notification.permission === "denied" ? "denied" : "available");
      } catch {
        if (!cancelled) {
          setState("error");
          setFeedback("تعذر تجهيز إشعارات هذا الجهاز.");
        }
      }
    };

    void initialize();
    return () => {
      cancelled = true;
    };
  }, [config.enabled, config.publicKey, registerWorker, scope]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (!isPushNotificationMessage(event.data)) return;
      setMessage(event.data);
      startTransition(() => router.refresh());
    };
    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, [router]);

  const enableNotifications = useCallback(async () => {
    if (!config.publicKey) return;
    if (Notification.permission === "denied") {
      setState("denied");
      setFeedback(
        "الإشعارات محظورة. فعّلها من إعدادات الموقع في المتصفح ثم أعد المحاولة.",
      );
      return;
    }
    setState("busy");
    setFeedback(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "available");
        return;
      }
      const registration = await registerWorker();
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toApplicationServerKey(config.publicKey),
        }));
      const payload = serializeSubscription(subscription);
      if (!payload) throw new Error("Invalid browser subscription");
      const result = await subscribePushNotificationsAction(scope, payload);
      setState(result.success ? "subscribed" : "error");
      setFeedback(result.message ?? null);
    } catch {
      setState("error");
      setFeedback("تعذر تفعيل الإشعارات. جرّب تثبيت التطبيق أولاً.");
    }
  }, [config.publicKey, registerWorker, scope]);

  const disableNotifications = useCallback(async () => {
    setState("busy");
    setFeedback(null);
    try {
      const registration = await registerWorker();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribePushNotificationsAction(scope, subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState(Notification.permission === "denied" ? "denied" : "available");
    } catch {
      setState("error");
      setFeedback("تعذر إيقاف الإشعارات على هذا الجهاز.");
    }
  }, [registerWorker, scope]);

  const isBusy = state === "loading" || state === "busy";
  const isSubscribed = state === "subscribed";
  const label = isSubscribed
    ? "إيقاف الإشعارات"
    : state === "denied"
      ? "الإشعارات محظورة"
      : "تفعيل الإشعارات";

  return (
    <>
      {config.enabled ? (
        <button
          type="button"
          onClick={isSubscribed ? disableNotifications : enableNotifications}
          disabled={isBusy || state === "unsupported"}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border bg-white px-3 text-sm font-semibold text-brand-text shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 disabled:cursor-not-allowed disabled:opacity-60",
            isSubscribed && "border-brand-primary text-brand-primary",
            className,
          )}
          aria-label={label}
          title={label}
        >
          {isBusy ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : state === "denied" ? (
            <BellOff className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Bell className="h-5 w-5" aria-hidden="true" />
          )}
          <span>{label}</span>
        </button>
      ) : null}

      {feedback ? (
        <p
          className="fixed end-4 top-16 z-[110] max-w-sm rounded-md border border-brand-border bg-white px-4 py-3 text-sm leading-6 text-brand-text shadow-lg"
          role="status"
          aria-live="polite"
          dir="rtl"
        >
          {feedback}
        </p>
      ) : null}

      {message ? (
        <div
          className="fixed bottom-4 end-4 z-[110] w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-brand-border bg-white p-4 text-right shadow-xl"
          role="status"
          aria-live="polite"
          dir="rtl"
        >
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-brand-text">{message.title}</p>
              <p className="mt-1 text-sm leading-6 text-gray-600">{message.body}</p>
              <Link
                href={message.url}
                onClick={() => setMessage(null)}
                className="mt-3 inline-flex min-h-10 items-center font-semibold text-brand-primary hover:underline"
              >
                فتح الطلب
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
              aria-label="إغلاق الإشعار"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
};
