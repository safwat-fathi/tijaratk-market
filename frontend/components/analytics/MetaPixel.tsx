"use client";

import Script from "next/script";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  META_CONSENT_CHANGED_EVENT,
  META_CONSENT_SETTINGS_EVENT,
  readMetaMarketingConsent,
  writeMetaMarketingConsent,
  type MetaMarketingConsent,
} from "@/lib/analytics/meta-consent";
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
 * Loads Meta Pixel and exposes marketing consent choices only on explicitly
 * allowlisted public pages. The script is never requested before consent.
 */
export default function MetaPixel() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<MetaMarketingConsent>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  const isAllowlistedPage = useMemo(
    () => isAllowlistedPublicPath(pathname),
    [pathname],
  );

  useEffect(() => {
    const currentConsent = readMetaMarketingConsent();
    setConsent(currentConsent);

    const handleConsentChanged = (event: Event) => {
      const nextConsent = (event as CustomEvent<MetaMarketingConsent>).detail;
      if (nextConsent === "granted" || nextConsent === "denied") {
        setConsent(nextConsent);
      }
    };
    const handleSettingsRequest = () => setPreferencesOpen(true);

    window.addEventListener(META_CONSENT_CHANGED_EVENT, handleConsentChanged);
    window.addEventListener(META_CONSENT_SETTINGS_EVENT, handleSettingsRequest);
    return () => {
      window.removeEventListener(
        META_CONSENT_CHANGED_EVENT,
        handleConsentChanged,
      );
      window.removeEventListener(
        META_CONSENT_SETTINGS_EVENT,
        handleSettingsRequest,
      );
    };
  }, []);

  useEffect(() => {
    if (isAllowlistedPage && readMetaMarketingConsent() === null) {
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
      !isAllowlistedPage ||
      !isSafeMetaBrowserLocation()
    ) {
      return;
    }

    const pageKey = `${window.location.pathname}${window.location.search}`;
    if (window.__tijaratkMetaLastPageLocation === pageKey) {
      return;
    }

    if (sendMetaPixelEvent("PageView")) {
      window.__tijaratkMetaLastPageLocation = pageKey;
    }
  }, [consent, isAllowlistedPage, pathname]);

  useEffect(() => {
    if (preferencesOpen) {
      dialogRef.current?.focus();
    }
  }, [preferencesOpen]);

  if (!META_PIXEL_ID || (!isAllowlistedPage && !preferencesOpen)) {
    return null;
  }

  const allowMarketing = () => {
    writeMetaMarketingConsent("granted");
    setPreferencesOpen(false);
  };

  const useNecessaryOnly = () => {
    revokeMetaPixelConsent();
    writeMetaMarketingConsent("denied");
    setPreferencesOpen(false);
  };

  const canLoadScript =
    consent === "granted" &&
    isAllowlistedPage &&
    typeof window !== "undefined" &&
    isSafeMetaBrowserLocation();

  return (
    <>
      {canLoadScript && (
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
          aria-labelledby="meta-consent-title"
          aria-describedby="meta-consent-description"
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
              id="meta-consent-title"
              className="text-lg font-bold text-brand-text flex items-center gap-2"
            >
              <span className="text-xl">🍪</span> نحن نهتم بخصوصيتك
            </h2>
            <p
              id="meta-consent-description"
              className="text-sm leading-6 text-muted-foreground"
            >
              لكي نقدم لك أفضل تجربة وعروضاً تناسب اهتماماتك، نطلب إذنك لاستخدام
              أدوات تتبع (مثل Meta). يساعدنا هذا في فهم كيفية تفاعلك مع متجرنا،
              وتوجيه إعلاناتنا بشكل أفضل. يمكنك دائماً تغيير رأيك في أي وقت من أسفل
              الصفحة. اقرأ المزيد في{" "}
              <Link
                href="/privacy"
                className="font-semibold text-brand-primary underline underline-offset-4"
              >
                سياسة الخصوصية
              </Link>
              .
            </p>
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
              السماح بالتسويق
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
