"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import {
  configureCustomerAnalyticsPage,
  GOOGLE_ANALYTICS_MEASUREMENT_ID,
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
  const [isReady, setIsReady] = useState(false);
  const lastReportedLocationRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isReady || lastReportedLocationRef.current === pageLocation) {
      return;
    }

    const absolutePageLocation = new URL(
      pageLocation,
      window.location.origin,
    ).toString();

    lastReportedLocationRef.current = pageLocation;
    configureCustomerAnalyticsPage({
      page_location: absolutePageLocation,
      page_path: pageLocation,
      page_title: pageTitle || document.title,
    });
    sendCustomerAnalyticsEvent("page_view", {
      page_location: absolutePageLocation,
      page_path: pageLocation,
      page_title: pageTitle || document.title,
    });
  }, [isReady, pageLocation, pageTitle]);

  if (!GOOGLE_ANALYTICS_MEASUREMENT_ID) {
    return null;
  }

  return (
    <>
      <Script
        id="tijaratk-google-analytics-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_ANALYTICS_MEASUREMENT_ID)}`}
        strategy="afterInteractive"
      />
      <Script
        id="tijaratk-google-analytics-init"
        strategy="afterInteractive"
        onReady={() => setIsReady(true)}
      >
        {/* GA4 Enhanced Measurement history pageviews must also be disabled in the web stream. */}
        {`window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};window.gtag('js',new Date());`}
      </Script>
    </>
  );
}
