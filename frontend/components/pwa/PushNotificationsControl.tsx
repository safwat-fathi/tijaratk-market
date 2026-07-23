"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  CheckCircle2,
  Loader2,
  Smartphone,
  X,
} from "lucide-react";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  subscribePushNotificationsAction,
  unsubscribePushNotificationsAction,
} from "@/actions/push-notification-actions";
import { runAfterLoadAndIdle } from "@/lib/browser/run-after-load-and-idle";
import { cn } from "@/lib/utils";
import {
  PUSH_SCOPES,
  type BrowserPushSubscriptionPayload,
  type PushNotificationMessage,
  type PushNotificationsConfig,
  type PushScope,
} from "@/types/services/push-notifications";

export type PushNotificationState =
  | "loading"
  | "unsupported"
  | "disabled"
  | "denied"
  | "available"
  | "subscribed"
  | "busy"
  | "error";

type PushNotificationsContextValue = {
  state: PushNotificationState;
  feedback: string | null;
  enableNotifications: () => Promise<void>;
  disableNotifications: () => Promise<void>;
  showMobileEnablePrompt: boolean;
};

type PushNotificationsProviderProps = {
  scope: PushScope;
  config: PushNotificationsConfig;
  children: ReactNode;
};

type PushNotificationsSettingsCardProps = {
  compact?: boolean;
  className?: string;
};

const PushNotificationsContext =
  createContext<PushNotificationsContextValue | null>(null);

const PUSH_MESSAGE_TYPES = new Set<PushNotificationMessage["type"]>([
  "admin.merchant.registered",
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
    (candidate.iconUrl === undefined ||
      typeof candidate.iconUrl === "string") &&
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

/** Provides one scoped browser Push lifecycle for a dashboard shell. */
export const PushNotificationsProvider = ({
  scope,
  config,
  children,
}: PushNotificationsProviderProps) => {
  const router = useRouter();
  const [state, setState] = useState<PushNotificationState>("loading");
  const [message, setMessage] = useState<PushNotificationMessage | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const registerWorker = useCallback(async () => {
    return navigator.serviceWorker.register(`/sw.js?app=${scope}`, {
      scope: PUSH_SCOPES[scope],
    });
  }, [scope]);

  useEffect(() => {
    if (!config.enabled || !config.publicKey) {
      setState("disabled");
      if ("serviceWorker" in navigator) {
        return runAfterLoadAndIdle(() => {
          void registerWorker().catch(() => undefined);
        });
      }
      return;
    }

    if (!("serviceWorker" in navigator)) {
      setState("unsupported");
      return;
    }
    if (!("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }

    let cancelled = false;
    const initialize = async () => {
      try {
        const registration = await registerWorker();
        if (cancelled) return;
        const subscription = await registration.pushManager.getSubscription();
        if (cancelled) return;
        if (!subscription) {
          setState(
            Notification.permission === "denied" ? "denied" : "available",
          );
          return;
        }

        const payload = serializeSubscription(subscription);
        if (!payload) {
          setState("available");
          return;
        }

        const result = await subscribePushNotificationsAction(scope, payload);
        if (cancelled) return;
        setState(result.success ? "subscribed" : "error");
        setFeedback(result.message ?? null);
      } catch {
        if (!cancelled) {
          setState(
            "Notification" in window && Notification.permission === "denied"
              ? "denied"
              : "error",
          );
          setFeedback("تعذر تجهيز إشعارات هذا الجهاز.");
        }
      }
    };

    const cancelInitialization = runAfterLoadAndIdle(() => {
      void initialize();
    });
    return () => {
      cancelled = true;
      cancelInitialization();
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
    if (!config.publicKey || !("Notification" in window)) return;
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
      setFeedback(
        result.success ? "تم تفعيل إشعارات الطلبات على هذا الجهاز." : result.message ?? null,
      );
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
        const result = await unsubscribePushNotificationsAction(
          scope,
          subscription.endpoint,
        );
        if (!result.success) {
          throw new Error(result.message || "Unable to remove subscription");
        }
        await subscription.unsubscribe();
      }
      setState(Notification.permission === "denied" ? "denied" : "available");
      setFeedback("تم إيقاف إشعارات الطلبات على هذا الجهاز.");
    } catch {
      setState("error");
      setFeedback("تعذر إيقاف الإشعارات على هذا الجهاز.");
    }
  }, [registerWorker, scope]);

  const value = useMemo<PushNotificationsContextValue>(
    () => ({
      state,
      feedback,
      enableNotifications,
      disableNotifications,
      showMobileEnablePrompt:
        config.enabled && (state === "available" || state === "error"),
    }),
    [config.enabled, disableNotifications, enableNotifications, feedback, state],
  );

  return (
    <PushNotificationsContext.Provider value={value}>
      {children}

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
            <Bell
              className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-brand-text">{message.title}</p>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                {message.body}
              </p>
              <Link
                href={message.url}
                onClick={() => setMessage(null)}
                className="mt-3 inline-flex min-h-10 items-center font-semibold text-brand-primary hover:underline"
              >
                {message.type === "admin.merchant.registered"
                  ? "فتح طلب الانضمام"
                  : "فتح الطلب"}
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
    </PushNotificationsContext.Provider>
  );
};

/** Reads the shared scoped Push lifecycle from a dashboard provider. */
export const usePushNotifications = (): PushNotificationsContextValue => {
  const value = useContext(PushNotificationsContext);
  if (!value) {
    throw new Error(
      "Push notification controls must be rendered inside PushNotificationsProvider",
    );
  }
  return value;
};

/** Mobile-only dashboard prompt displayed until this device is subscribed. */
export const MobilePushEnableButton = ({ className }: { className?: string }) => {
  const { enableNotifications, showMobileEnablePrompt, state } =
    usePushNotifications();

  if (!showMobileEnablePrompt) return null;

  return (
    <button
      type="button"
      onClick={() => void enableNotifications()}
      disabled={state === "busy"}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-brand-primary bg-white px-3 text-sm font-bold text-brand-primary shadow-sm transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 disabled:cursor-not-allowed disabled:opacity-60 lg:hidden",
        className,
      )}
    >
      {state === "busy" ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      ) : (
        <Bell className="h-5 w-5" aria-hidden="true" />
      )}
      تفعيل الإشعارات
    </button>
  );
};

/** Always-visible device-level Push management surface for dashboard settings. */
export const PushNotificationsSettingsCard = ({
  compact = false,
  className,
}: PushNotificationsSettingsCardProps) => {
  const { disableNotifications, enableNotifications, feedback, state } =
    usePushNotifications();
  const isBusy = state === "loading" || state === "busy";
  const isSubscribed = state === "subscribed";

  const status = {
    disabled: {
      title: "الإشعارات غير متاحة الآن",
      description: "لم يتم تفعيل إشعارات الطلبات من إدارة المنصة بعد.",
    },
    unsupported: {
      title: "هذا المتصفح لا يدعم الإشعارات",
      description: "جرّب متصفحًا حديثًا أو ثبّت التطبيق على جهاز يدعم الإشعارات.",
    },
    denied: {
      title: "الإشعارات محظورة",
      description:
        "فعّل الإشعارات من إعدادات الموقع في المتصفح، ثم ارجع إلى هذه الصفحة.",
    },
    subscribed: {
      title: "الإشعارات مفعّلة",
      description: "ستصل إشعارات الطلبات إلى هذا الجهاز فقط.",
    },
    loading: {
      title: "جارٍ التحقق من الإشعارات",
      description: "يتم تجهيز هذا الجهاز لاستقبال إشعارات الطلبات.",
    },
    busy: {
      title: "جارٍ تحديث الإشعارات",
      description: "انتظر لحظة حتى يكتمل التحديث على هذا الجهاز.",
    },
    available: {
      title: "فعّل إشعارات الطلبات",
      description: "استقبل تنبيهًا فوريًا عند وصول طلب جديد.",
    },
    error: {
      title: "تعذر تحديث الإشعارات",
      description: "يمكنك إعادة المحاولة من هذا الجهاز.",
    },
  }[state];

  return (
    <section
      className={cn(
        "rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm",
        !compact && "sm:p-6",
        className,
      )}
      dir="rtl"
    >
      <div className={cn("flex gap-3", !compact && "sm:items-start")}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-primary">
          {isSubscribed ? (
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          ) : state === "denied" ? (
            <BellOff className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Smartphone className="h-5 w-5" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={cn("font-bold text-brand-text", !compact && "text-lg")}>
            إشعارات الطلبات
          </h2>
          <p className="mt-1 text-sm font-semibold text-gray-800">
            {status.title}
          </p>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            {status.description}
          </p>
          {feedback ? (
            <p className="mt-2 text-sm font-medium text-brand-primary" role="status">
              {feedback}
            </p>
          ) : null}
        </div>
      </div>

      {state !== "disabled" && state !== "unsupported" && state !== "denied" ? (
        <button
          type="button"
          onClick={() =>
            void (isSubscribed ? disableNotifications() : enableNotifications())
          }
          disabled={isBusy}
          className={cn(
            "mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 disabled:cursor-not-allowed disabled:opacity-60",
            isSubscribed
              ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
              : "bg-brand-primary text-white hover:bg-brand-primary-hover",
          )}
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isSubscribed ? "إيقاف الإشعارات" : "تفعيل الإشعارات"}
        </button>
      ) : null}
    </section>
  );
};
