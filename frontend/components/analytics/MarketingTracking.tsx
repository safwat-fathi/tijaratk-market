"use client";

import Script from "next/script";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MARKETING_CONSENT_CHANGED_EVENT,
  MARKETING_CONSENT_SETTINGS_EVENT,
  readMarketingConsent,
  writeMarketingConsent,
  type MarketingConsent,
} from "@/lib/analytics/marketing-consent";
import {
  GOOGLE_ANALYTICS_MEASUREMENT_ID,
  revokeGoogleAnalyticsConsent,
} from "@/lib/analytics/google-analytics";
import {
  initializeMetaPixel,
  isSafeMetaBrowserLocation,
  META_PIXEL_ID,
  revokeMetaPixelConsent,
  sendMetaPixelEvent,
} from "@/lib/analytics/meta-pixel";

const PUBLIC_MARKETING_PATHS = new Set([
  "/",
  "/about",
  "/privacy",
  "/return-policy",
  "/terms",
]);

const RESERVED_TOP_LEVEL_PATHS = new Set([
  "admin",
  "api",
  "dummy-storefront",
  "merchant",
  "stores",
  "track-order",
  "track-orders",
]);

const isAllowlistedPublicPath = (pathname: string) => {
  if (PUBLIC_MARKETING_PATHS.has(pathname) || pathname.startsWith("/stores")) {
    return true;
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 2 && segments[0] === "market") {
    return true;
  }

  return (
    segments.length === 1 && !RESERVED_TOP_LEVEL_PATHS.has(segments[0] || "")
  );
};

/**
 * Coordinates consent for configured browser marketing providers. Provider
 * scripts are never requested before consent.
 */
export default function MarketingTracking() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<MarketingConsent>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  const isAllowlistedPage = useMemo(
    () => isAllowlistedPublicPath(pathname),
    [pathname],
  );
  const hasConfiguredProvider = Boolean(
    META_PIXEL_ID || GOOGLE_ANALYTICS_MEASUREMENT_ID,
  );

  useEffect(() => {
    const currentConsent = readMarketingConsent();
    setConsent(currentConsent);

    const handleConsentChanged = (event: Event) => {
      const nextConsent = (event as CustomEvent<MarketingConsent>).detail;
      if (nextConsent === "granted" || nextConsent === "denied") {
        setConsent(nextConsent);
      }
    };
    const handleSettingsRequest = () => setPreferencesOpen(true);

    window.addEventListener(
      MARKETING_CONSENT_CHANGED_EVENT,
      handleConsentChanged,
    );
    window.addEventListener(
      MARKETING_CONSENT_SETTINGS_EVENT,
      handleSettingsRequest,
    );
    return () => {
      window.removeEventListener(
        MARKETING_CONSENT_CHANGED_EVENT,
        handleConsentChanged,
      );
      window.removeEventListener(
        MARKETING_CONSENT_SETTINGS_EVENT,
        handleSettingsRequest,
      );
    };
  }, []);

  useEffect(() => {
    if (isAllowlistedPage && readMarketingConsent() === null) {
      setPreferencesOpen(true);
      return;
    }
    if (!isAllowlistedPage) {
      setPreferencesOpen(false);
    }
  }, [isAllowlistedPage]);

  useEffect(() => {
    if (
      consent !== "granted" ||
      !META_PIXEL_ID ||
      !isAllowlistedPage ||
      !isSafeMetaBrowserLocation()
    ) {
      return;
    }

    const pageKey = `${window.location.pathname}${window.location.search}`;
    if (window.__tijaratkMetaLastPageLocation === pageKey) return;

    if (sendMetaPixelEvent("PageView")) {
      window.__tijaratkMetaLastPageLocation = pageKey;
    }
  }, [consent, isAllowlistedPage, pathname]);

  useEffect(() => {
    if (preferencesOpen) {
      dialogRef.current?.focus();
    }
  }, [preferencesOpen]);

  if (!hasConfiguredProvider || (!isAllowlistedPage && !preferencesOpen)) {
    return null;
  }

  const allowMarketing = () => {
    writeMarketingConsent("granted");
    setPreferencesOpen(false);
  };

  const useNecessaryOnly = () => {
    revokeMetaPixelConsent();
    revokeGoogleAnalyticsConsent();
    writeMarketingConsent("denied");
    setPreferencesOpen(false);
  };

  const canLoadMetaScript =
    Boolean(META_PIXEL_ID) &&
    consent === "granted" &&
    isAllowlistedPage &&
    typeof window !== "undefined" &&
    isSafeMetaBrowserLocation();

  return (
    <>
      {canLoadMetaScript && (
        <Script
          id="tijaratk-meta-pixel"
          src="https://connect.facebook.net/en_US/fbevents.js"
          strategy="afterInteractive"
          onLoad={() => initializeMetaPixel()}
        />
      )}

      {preferencesOpen && (
        <section
          ref={dialogRef}
          role="dialog"
          aria-modal="false"
          aria-live="polite"
          aria-labelledby="marketing-consent-title"
          aria-describedby="marketing-consent-description"
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "Escape" && consent !== null) {
              setPreferencesOpen(false);
            }
          }}
          dir="rtl"
          className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-2xl rounded-2xl border border-brand-border bg-white p-5 text-right shadow-2xl sm:bottom-6 sm:p-6"
        >
          <div className="space-y-3">
            <h2
              id="marketing-consent-title"
              className="flex items-center gap-2 text-lg font-bold text-brand-text"
            >
              نستخدم ملفات تعريف الارتباط لتحسين تجربتك <span className="text-xl">🍪</span>
            </h2>
            <div
              id="marketing-consent-description"
              className="text-sm leading-6 text-muted-foreground space-y-2"
            >
              <p>
                نستخدم ملفات ضرورية لتشغيل الموقع، وملفات اختيارية تساعدنا على فهم طريقة استخدام الموقع، تحسين الخدمة، وقياس أداء الحملات الإعلانية.
              </p>
              <p>
                يمكنك الموافقة على جميع الملفات أو الاكتفاء بالملفات الضرورية، وتغيير اختيارك لاحقًا من إعدادات الخصوصية.{" "}
                <Link
                  href="/privacy"
                  className="font-semibold text-brand-primary underline underline-offset-4"
                >
                  إدارة التفضيلات أو معرفة المزيد عن الخصوصية
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={useNecessaryOnly}
              className="min-h-11 rounded-full border border-brand-border bg-white px-5 py-2 text-sm font-bold text-brand-text transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
            >
              الضرورية فقط
            </button>
            <button
              type="button"
              onClick={allowMarketing}
              className="min-h-11 rounded-full bg-brand-primary px-5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/30"
            >
              موافقة على الكل
            </button>
          </div>

          {consent !== null && (
            <button
              type="button"
              onClick={() => setPreferencesOpen(false)}
              className="absolute left-3 top-3 rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
              aria-label="إغلاق إعدادات ملفات تعريف الارتباط"
            >
              إغلاق
            </button>
          )}
        </section>
      )}
    </>
  );
}
