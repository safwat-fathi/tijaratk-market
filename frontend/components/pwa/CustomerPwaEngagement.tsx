"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  CheckCircle2,
  Download,
  Loader2,
  PackageCheck,
  Share2,
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
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  disableCustomerPushSubscriptionAction,
  syncCustomerPushSubscriptionAction,
} from "@/actions/customer-push-notification-actions";
import { usePwaStandalone } from "@/hooks/usePwaStandalone";
import { runAfterLoadAndIdle } from "@/lib/browser/run-after-load-and-idle";
import { cn } from "@/lib/utils";
import BottomSheet from "@/components/ui/BottomSheet";
import type {
  BrowserPushSubscriptionPayload,
  PushNotificationMessage,
  PushNotificationsConfig,
} from "@/types/services/push-notifications";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type CustomerPushState =
  | "loading"
  | "unsupported"
  | "disabled"
  | "denied"
  | "available"
  | "subscribed"
  | "busy"
  | "error";

type CustomerPushContextValue = {
  state: CustomerPushState;
  feedback: string | null;
  isStandalone: boolean;
  enableNotifications: () => Promise<void>;
  disableNotifications: () => Promise<void>;
};

type CustomerPwaEngagementProps = {
  config: PushNotificationsConfig;
  children: ReactNode;
};

const INSTALL_VIEWS_KEY = "tijaratk_customer_install_views_v1";
const INSTALL_NEXT_PROMPT_KEY = "tijaratk_customer_install_next_prompt_v1";
const PUSH_NEXT_PROMPT_KEY = "tijaratk_customer_push_next_prompt_v1";
const PUSH_OS_DENIED_KEY = "tijaratk_customer_push_os_denied_v1";
const PUSH_LAST_SYNC_KEY = "tijaratk_customer_push_last_sync_v1";
const REPROMPT_DELAY_MS = 7 * 24 * 60 * 60 * 1000;
const PASSIVE_SYNC_DELAY_MS = 60 * 1000;

const RESERVED_SINGLE_SEGMENT_PATHS = new Set([
  "about",
  "admin",
  "api",
  "auth",
  "dummy-storefront",
  "features",
  "install",
  "market",
  "merchant",
  "offline",
  "privacy",
  "stores",
  "track-order",
  "track-orders",
]);

const CUSTOMER_MESSAGE_TYPES = new Set<PushNotificationMessage["type"]>([
  "customer.order.status_changed",
  "customer.order.replacement_requested",
]);

const CustomerPushContext = createContext<CustomerPushContextValue | null>(
  null,
);

const readStorageNumber = (
  storage: Storage,
  key: string,
  fallback = 0,
): number => {
  try {
    const value = Number(storage.getItem(key));
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
};

const writeStorageNumber = (storage: Storage, key: string, value: number) => {
  try {
    storage.setItem(key, String(value));
  } catch {
    // Storage may be unavailable in private browsing modes.
  }
};

const isBeforeInstallPromptEvent = (
  event: Event,
): event is BeforeInstallPromptEvent =>
  "prompt" in event && "userChoice" in event;

const isIosDevice = () => {
  const userAgent = navigator.userAgent || navigator.vendor;
  return (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

const isPhoneViewport = () =>
  window.matchMedia("(max-width: 767px)").matches &&
  (window.matchMedia("(pointer: coarse)").matches ||
    /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent));

const isCustomerRoute = (pathname: string) =>
  !pathname.startsWith("/admin") && !pathname.startsWith("/merchant");

const isEligibleShoppingPath = (pathname: string) => {
  if (pathname === "/") return true;
  if (pathname.startsWith("/stores/")) return true;
  if (pathname.startsWith("/market/")) {
    return !/(?:^|\/)(?:checkout|success)(?:\/|$)/.test(pathname);
  }

  const segments = pathname.split("/").filter(Boolean);
  return (
    segments.length === 1 &&
    !RESERVED_SINGLE_SEGMENT_PATHS.has(segments[0].toLowerCase())
  );
};

const hasCompetingDialog = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>(
      '[role="dialog"], .react-joyride__overlay, [data-tour-active="true"]',
    ),
  ).some(
    (element) =>
      element.getAttribute("aria-hidden") !== "true" &&
      element.getClientRects().length > 0,
  );

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

const isCustomerPushMessage = (
  value: unknown,
): value is PushNotificationMessage => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<PushNotificationMessage>;
  return (
    candidate.version === 1 &&
    typeof candidate.type === "string" &&
    CUSTOMER_MESSAGE_TYPES.has(
      candidate.type as PushNotificationMessage["type"],
    ) &&
    typeof candidate.eventId === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.body === "string" &&
    typeof candidate.url === "string" &&
    candidate.url.startsWith("/") &&
    !candidate.url.startsWith("//") &&
    typeof candidate.tag === "string" &&
    typeof candidate.createdAt === "string"
  );
};

/** Owns customer-only install promotion and installed-app Push lifecycle. */
export default function CustomerPwaEngagement({
  config,
  children,
}: CustomerPwaEngagementProps) {
  const pathname = usePathname();
  const customerRoute = isCustomerRoute(pathname);
  const router = useRouter();
  const isStandalone = usePwaStandalone();
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallSheetOpen, setInstallSheetOpen] = useState(false);
  const [isPushSheetOpen, setPushSheetOpen] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [pushState, setPushState] = useState<CustomerPushState>("loading");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [foregroundMessage, setForegroundMessage] =
    useState<PushNotificationMessage | null>(null);
  const lastInstallPath = useRef<string | null>(null);

  const registerCustomerWorker = useCallback(
    () =>
      navigator.serviceWorker.register("/sw.js?app=customer", {
        scope: "/",
        updateViaCache: "none",
      }),
    [],
  );

  useEffect(() => {
    if (!customerRoute || !("serviceWorker" in navigator)) return;
    return runAfterLoadAndIdle(() => {
      void registerCustomerWorker().catch(() => undefined);
    });
  }, [customerRoute, registerCustomerWorker]);

  useEffect(() => {
    setIsIos(isIosDevice());
    const globalEvent = (
      window as Window & { __installPromptEvent?: Event | null }
    ).__installPromptEvent;
    if (globalEvent && isBeforeInstallPromptEvent(globalEvent)) {
      setInstallPrompt(globalEvent);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (isBeforeInstallPromptEvent(event)) setInstallPrompt(event);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setInstallSheetOpen(false);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (
      isStandalone ||
      !customerRoute ||
      !isEligibleShoppingPath(pathname) ||
      !isPhoneViewport() ||
      !window.isSecureContext ||
      lastInstallPath.current === pathname
    ) {
      return;
    }
    lastInstallPath.current = pathname;

    const views = readStorageNumber(localStorage, INSTALL_VIEWS_KEY) + 1;
    writeStorageNumber(localStorage, INSTALL_VIEWS_KEY, views);
    const nextPromptAt = readStorageNumber(
      localStorage,
      INSTALL_NEXT_PROMPT_KEY,
    );
    if (views < 2 || nextPromptAt > Date.now()) return;

    let attempts = 0;
    const openWhenClear = () => {
      attempts += 1;
      if (hasCompetingDialog() && attempts < 60) return;
      if (!hasCompetingDialog()) setInstallSheetOpen(true);
      window.clearInterval(interval);
    };
    const interval = window.setInterval(openWhenClear, 1000);
    openWhenClear();
    return () => window.clearInterval(interval);
  }, [customerRoute, isStandalone, pathname]);

  const dismissInstallSheet = useCallback(() => {
    writeStorageNumber(
      localStorage,
      INSTALL_NEXT_PROMPT_KEY,
      Date.now() + REPROMPT_DELAY_MS,
    );
    setInstallSheetOpen(false);
  }, []);

  const requestInstall = useCallback(async () => {
    if (!installPrompt) {
      dismissInstallSheet();
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    setInstallSheetOpen(false);
    if (choice.outcome === "dismissed") {
      writeStorageNumber(
        localStorage,
        INSTALL_NEXT_PROMPT_KEY,
        Date.now() + REPROMPT_DELAY_MS,
      );
    }
  }, [dismissInstallSheet, installPrompt]);

  const syncExistingSubscription = useCallback(
    async (force = false) => {
      if (
        !isStandalone ||
        !config.enabled ||
        !config.publicKey ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window) ||
        Notification.permission !== "granted"
      ) {
        return false;
      }

      const lastSyncAt = readStorageNumber(
        sessionStorage,
        PUSH_LAST_SYNC_KEY,
      );
      if (!force && Date.now() - lastSyncAt < PASSIVE_SYNC_DELAY_MS) {
        return true;
      }

      const registration = await registerCustomerWorker();
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return false;
      const payload = serializeSubscription(subscription);
      if (!payload) return false;
      const result = await syncCustomerPushSubscriptionAction(payload);
      if (!result.success) {
        setFeedback(result.message || "تعذر مزامنة إشعارات هذا الجهاز.");
        return false;
      }
      writeStorageNumber(sessionStorage, PUSH_LAST_SYNC_KEY, Date.now());
      setPushState("subscribed");
      return true;
    },
    [config.enabled, config.publicKey, isStandalone, registerCustomerWorker],
  );

  useEffect(() => {
    if (!customerRoute || !isStandalone) {
      if (!isStandalone) setPushState("available");
      return;
    }
    if (!config.enabled || !config.publicKey) {
      setPushState("disabled");
      return;
    }
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setPushState("unsupported");
      return;
    }

    let cancelled = false;
    const initialize = async () => {
      try {
        if (Notification.permission === "denied") {
          setPushState("denied");
          return;
        }
        const synced = await syncExistingSubscription(true);
        if (cancelled || synced) return;
        setPushState("available");

        const nextPromptAt = readStorageNumber(
          localStorage,
          PUSH_NEXT_PROMPT_KEY,
        );
        const wasDenied = readStorageNumber(
          localStorage,
          PUSH_OS_DENIED_KEY,
        );
        if (wasDenied || nextPromptAt > Date.now()) return;

        let attempts = 0;
        const openWhenClear = () => {
          attempts += 1;
          if (hasCompetingDialog() && attempts < 60) return;
          if (!hasCompetingDialog()) setPushSheetOpen(true);
          window.clearInterval(interval);
        };
        const interval = window.setInterval(openWhenClear, 1000);
        openWhenClear();
      } catch {
        if (!cancelled) {
          setPushState("error");
          setFeedback("تعذر تجهيز إشعارات هذا الجهاز.");
        }
      }
    };

    const cancelInitialization = runAfterLoadAndIdle(() => {
      void initialize();
    }, 2_000);
    return () => {
      cancelled = true;
      cancelInitialization();
    };
  }, [
    config.enabled,
    config.publicKey,
    isStandalone,
    customerRoute,
    syncExistingSubscription,
  ]);

  useEffect(() => {
    if (
      !isStandalone ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) {
      return;
    }
    void syncExistingSubscription(pathname.includes("/success"));
  }, [isStandalone, pathname, syncExistingSubscription]);

  useEffect(() => {
    const handleIdentityChange = () => {
      void syncExistingSubscription(true);
    };
    window.addEventListener(
      "customer-push-identities-changed",
      handleIdentityChange,
    );
    return () => {
      window.removeEventListener(
        "customer-push-identities-changed",
        handleIdentityChange,
      );
    };
  }, [syncExistingSubscription]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (!isCustomerPushMessage(event.data)) return;
      setForegroundMessage(event.data);
      startTransition(() => router.refresh());
    };
    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [router]);

  const enableNotifications = useCallback(async () => {
    if (
      !isStandalone ||
      !config.publicKey ||
      !("Notification" in window)
    ) {
      setFeedback("ثبّت التطبيق أولاً لتفعيل إشعارات الطلبات.");
      return;
    }
    if (Notification.permission === "denied") {
      setPushState("denied");
      setFeedback(
        "الإشعارات محظورة. فعّلها من إعدادات التطبيق في الهاتف ثم أعد المحاولة.",
      );
      return;
    }

    setPushState("busy");
    setFeedback(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        const denied = permission === "denied";
        setPushState(denied ? "denied" : "available");
        if (denied) {
          writeStorageNumber(localStorage, PUSH_OS_DENIED_KEY, Date.now());
        }
        setPushSheetOpen(false);
        return;
      }

      const registration = await registerCustomerWorker();
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toApplicationServerKey(config.publicKey),
        }));
      const payload = serializeSubscription(subscription);
      if (!payload) throw new Error("Invalid browser subscription");
      const result = await syncCustomerPushSubscriptionAction(payload);
      if (!result.success) {
        throw new Error(result.message || "Unable to save subscription");
      }

      writeStorageNumber(sessionStorage, PUSH_LAST_SYNC_KEY, Date.now());
      setPushState("subscribed");
      setPushSheetOpen(false);
      setFeedback("تم تفعيل تحديثات الطلبات على هذا الجهاز.");
    } catch {
      setPushState("error");
      setFeedback("تعذر تفعيل الإشعارات الآن. أعد المحاولة بعد قليل.");
    }
  }, [config.publicKey, isStandalone, registerCustomerWorker]);

  const disableNotifications = useCallback(async () => {
    setPushState("busy");
    setFeedback(null);
    try {
      const result = await disableCustomerPushSubscriptionAction();
      if (!result.success) {
        throw new Error(result.message || "Unable to remove subscription");
      }
      const registration = await registerCustomerWorker();
      const subscription = await registration.pushManager.getSubscription();
      await subscription?.unsubscribe();
      setPushState(
        Notification.permission === "denied" ? "denied" : "available",
      );
      setFeedback("تم إيقاف إشعارات الطلبات على هذا الجهاز.");
    } catch {
      setPushState("error");
      setFeedback("تعذر إيقاف الإشعارات على هذا الجهاز.");
    }
  }, [registerCustomerWorker]);

  const dismissPushSheet = useCallback(() => {
    writeStorageNumber(
      localStorage,
      PUSH_NEXT_PROMPT_KEY,
      Date.now() + REPROMPT_DELAY_MS,
    );
    setPushSheetOpen(false);
  }, []);

  const contextValue = useMemo<CustomerPushContextValue>(
    () => ({
      state: pushState,
      feedback,
      isStandalone,
      enableNotifications,
      disableNotifications,
    }),
    [
      disableNotifications,
      enableNotifications,
      feedback,
      isStandalone,
      pushState,
    ],
  );

  return (
    <CustomerPushContext.Provider value={contextValue}>
      {children}

      <BottomSheet
        isOpen={isInstallSheetOpen}
        title="خلّي تجارتك على موبايلك"
        closeLabel="ليس الآن"
        onClose={dismissInstallSheet}
        footer={
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => void requestInstall()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
            >
              <Download className="h-5 w-5" aria-hidden="true" />
              {installPrompt ? "تثبيت التطبيق" : "حسنًا، فهمت"}
            </button>
            <button
              type="button"
              onClick={dismissInstallSheet}
              className="min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-soft"
            >
              ذكّرني لاحقًا
            </button>
          </div>
        }
      >
        <div className="rounded-2xl bg-brand-soft/60 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-primary shadow-sm">
              <Smartphone className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="font-bold text-brand-text">
                أسرع في الوصول ومتابعة الطلب
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                افتح المتاجر من الشاشة الرئيسية واستقبل تحديثات طلباتك بعد
                تفعيلها.
              </p>
            </div>
          </div>
        </div>

        {!installPrompt ? (
          <ol className="mt-4 space-y-3 text-sm leading-6 text-brand-text">
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
                ١
              </span>
              {isIos ? (
                <span className="flex items-center gap-2">
                  اضغط زر المشاركة
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  في Safari.
                </span>
              ) : (
                <span>افتح قائمة المتصفح من زر النقاط الثلاث.</span>
              )}
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
                ٢
              </span>
              <span>اختر «إضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق».</span>
            </li>
          </ol>
        ) : null}
      </BottomSheet>

      <BottomSheet
        isOpen={isPushSheetOpen}
        title="تابع طلبك لحظة بلحظة"
        closeLabel="ليس الآن"
        onClose={dismissPushSheet}
        footer={
          <div className="grid gap-2">
            <button
              type="button"
              disabled={pushState === "busy"}
              onClick={() => void enableNotifications()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 disabled:opacity-60"
            >
              {pushState === "busy" ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <Bell className="h-5 w-5" aria-hidden="true" />
              )}
              تفعيل تحديثات الطلبات
            </button>
            <button
              type="button"
              onClick={dismissPushSheet}
              className="min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-soft"
            >
              ربما لاحقًا
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex gap-3 rounded-2xl border border-brand-border bg-brand-soft/30 p-4">
            <PackageCheck
              className="mt-0.5 h-6 w-6 shrink-0 text-brand-primary"
              aria-hidden="true"
            />
            <div>
              <p className="font-bold text-brand-text">
                تحديثات مهمة فقط
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                التأكيد، خروج الطلب للتوصيل، اكتماله، إلغاؤه، أو وجود بديل
                يحتاج موافقتك.
              </p>
            </div>
          </div>
          <p className="px-1 text-xs leading-5 text-muted-foreground">
            لن نعرض عنوانك أو رقم هاتفك أو تفاصيل المنتجات على شاشة القفل.
            يمكنك إيقاف الإشعارات في أي وقت من صفحة «طلباتي».
          </p>
        </div>
      </BottomSheet>

      {feedback ? (
        <p
          className="fixed end-4 top-16 z-[110] max-w-sm rounded-xl border border-brand-border bg-white px-4 py-3 text-sm leading-6 text-brand-text shadow-lg"
          role="status"
          aria-live="polite"
          dir="rtl"
        >
          {feedback}
        </p>
      ) : null}

      {foregroundMessage ? (
        <div
          className="fixed bottom-4 end-4 z-[110] w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-brand-border bg-white p-4 text-right shadow-xl"
          role="status"
          aria-live="polite"
          dir="rtl"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-primary">
              <Bell className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-brand-text">
                {foregroundMessage.title}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {foregroundMessage.body}
              </p>
              <Link
                href={foregroundMessage.url}
                onClick={() => setForegroundMessage(null)}
                className="mt-3 inline-flex min-h-10 items-center font-bold text-brand-primary hover:underline"
              >
                فتح الطلب
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setForegroundMessage(null)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-brand-soft"
              aria-label="إغلاق التحديث"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </CustomerPushContext.Provider>
  );
}

/** Returns the customer notification lifecycle owned by the root provider. */
export function useCustomerPushNotifications(): CustomerPushContextValue {
  const value = useContext(CustomerPushContext);
  if (!value) {
    throw new Error(
      "Customer notification controls require CustomerPwaEngagement",
    );
  }
  return value;
}

/** Device-level notification setting shown on the customer orders page. */
export function CustomerPushNotificationsSettingsCard({
  className,
}: {
  className?: string;
}) {
  const {
    state,
    feedback,
    isStandalone,
    enableNotifications,
    disableNotifications,
  } = useCustomerPushNotifications();
  const isBusy = state === "loading" || state === "busy";
  const isSubscribed = state === "subscribed";

  if (!isStandalone) return null;

  const status = {
    loading: ["جارٍ التحقق", "نتأكد من حالة الإشعارات على هذا الجهاز."],
    busy: ["جارٍ التحديث", "انتظر لحظة حتى يكتمل تحديث الإعداد."],
    disabled: ["غير متاحة الآن", "لم يتم تشغيل خدمة الإشعارات على المنصة."],
    unsupported: [
      "غير مدعومة على هذا الجهاز",
      "استخدم متصفحًا حديثًا وثبّت التطبيق أولاً.",
    ],
    denied: [
      "الإشعارات محظورة",
      "فعّلها من إعدادات التطبيق أو الموقع في هاتفك.",
    ],
    available: [
      isStandalone ? "الإشعارات متوقفة" : "ثبّت التطبيق أولاً",
      isStandalone
        ? "فعّلها لتصلك تحديثات الطلبات المهمة."
        : "إشعارات العملاء متاحة من التطبيق المثبت فقط.",
    ],
    subscribed: [
      "الإشعارات مفعّلة",
      "ستصلك تحديثات الطلبات المرتبطة بهذا الجهاز.",
    ],
    error: ["تعذر تحديث الإعداد", "يمكنك إعادة المحاولة الآن."],
  }[state];

  return (
    <section
      className={cn(
        "mt-6 rounded-2xl border border-brand-border bg-white p-5 shadow-sm",
        className,
      )}
      aria-labelledby="customer-push-settings-title"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-primary">
          {isSubscribed ? (
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          ) : state === "denied" ? (
            <BellOff className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Bell className="h-5 w-5" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="customer-push-settings-title"
            className="font-black text-brand-text"
          >
            إشعارات الطلبات
          </h2>
          <p className="mt-1 text-sm font-bold text-brand-text">{status[0]}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {status[1]}
          </p>
          {feedback ? (
            <p className="mt-2 text-sm font-medium text-brand-primary">
              {feedback}
            </p>
          ) : null}
        </div>
      </div>

      {state !== "disabled" &&
      state !== "unsupported" &&
      state !== "denied" &&
      isStandalone ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() =>
            void (isSubscribed
              ? disableNotifications()
              : enableNotifications())
          }
          className={cn(
            "mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 disabled:opacity-60",
            isSubscribed
              ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
              : "bg-brand-primary text-white hover:bg-brand-primary-hover",
          )}
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          {isSubscribed ? "إيقاف الإشعارات" : "تفعيل الإشعارات"}
        </button>
      ) : null}
    </section>
  );
}
