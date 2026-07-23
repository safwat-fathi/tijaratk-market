"use client";

import { useEffect, useRef } from "react";
import {
  MARKETING_CONSENT_CHANGED_EVENT,
  readMarketingConsent,
} from "@/lib/analytics/marketing-consent";
import {
  trackStoreView,
  type StorefrontAnalyticsContext,
} from "@/lib/analytics/storefront-ga4";

type StorefrontViewTrackingProps = {
  store: StorefrontAnalyticsContext;
};

/** Sends one consented storefront view for the mounted direct-store page. */
export default function StorefrontViewTracking({
  store,
}: StorefrontViewTrackingProps) {
  const hasReported = useRef(false);

  useEffect(() => {
    const report = () => {
      if (
        hasReported.current ||
        readMarketingConsent() !== "granted"
      ) {
        return;
      }
      if (trackStoreView(store)) {
        hasReported.current = true;
      }
    };

    report();
    window.addEventListener(MARKETING_CONSENT_CHANGED_EVENT, report);
    return () =>
      window.removeEventListener(MARKETING_CONSENT_CHANGED_EVENT, report);
  }, [store]);

  return null;
}
