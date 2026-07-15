"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import {
  MARKETING_CONSENT_CHANGED_EVENT,
  readMarketingConsent,
  type MarketingConsent,
} from "@/lib/analytics/marketing-consent";
import {
  configureCustomerAnalyticsPage,
  GOOGLE_ANALYTICS_MEASUREMENT_ID,
  initializeGoogleAnalytics,
  sendCustomerAnalyticsEvent,
} from "@/lib/analytics/google-analytics";

type CustomerAnalyticsProps = {
  pageLocation: string;
  pageTitle?: string;
};

export default function CustomerAnalytics({
  pageLocation,
  pageTitle,
}: CustomerAnalyticsProps) {
  const [consent, setConsent] = useState<MarketingConsent>(null);
  const [isReady, setIsReady] = useState(false);
  const lastReportedLocationRef = useRef<string | null>(null);

  useEffect(() => {
    const applyConsent = (nextConsent: MarketingConsent) => {
      setConsent(nextConsent);
      setIsReady(false);
      lastReportedLocationRef.current = null;
      if (nextConsent === "granted") {
        initializeGoogleAnalytics();
      }
    };

    applyConsent(readMarketingConsent());
    const handleConsentChanged = (event: Event) => {
      applyConsent((event as CustomEvent<MarketingConsent>).detail);
    };
    window.addEventListener(
      MARKETING_CONSENT_CHANGED_EVENT,
      handleConsentChanged,
    );
    return () =>
      window.removeEventListener(
        MARKETING_CONSENT_CHANGED_EVENT,
        handleConsentChanged,
      );
  }, []);

  useEffect(() => {
    if (
      consent !== "granted" ||
      !isReady ||
      lastReportedLocationRef.current === pageLocation
    ) {
      return;
    }

    const absolutePageLocation = new URL(
      pageLocation,
      window.location.origin,
    ).toString();

    const configured = configureCustomerAnalyticsPage({
      page_location: absolutePageLocation,
      page_path: pageLocation,
      page_title: pageTitle || document.title,
    });
    const reported = sendCustomerAnalyticsEvent("page_view", {
      page_location: absolutePageLocation,
      page_path: pageLocation,
      page_title: pageTitle || document.title,
    });
    if (configured && reported) {
      lastReportedLocationRef.current = pageLocation;
    }
  }, [consent, isReady, pageLocation, pageTitle]);

  if (!GOOGLE_ANALYTICS_MEASUREMENT_ID || consent !== "granted") {
    return null;
  }

  return (
    <Script
      id="tijaratk-google-analytics-loader"
      src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_ANALYTICS_MEASUREMENT_ID)}`}
      strategy="afterInteractive"
      onReady={() => {
        initializeGoogleAnalytics();
        setIsReady(true);
      }}
    />
  );
}
