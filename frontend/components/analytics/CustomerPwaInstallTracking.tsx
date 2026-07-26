"use client";

import { useEffect, useRef } from "react";
import {
  trackCustomerPwaInstall,
  type CustomerPwaInstallTrackingContext,
} from "@/lib/analytics/storefront-ga4";

/**
 * Reports a confirmed, consented customer PWA installation for the mounted
 * customer surface. Browsers without `appinstalled` are intentionally omitted.
 */
const CustomerPwaInstallTracking = (
  trackingContext: CustomerPwaInstallTrackingContext,
) => {
  const hasReported = useRef(false);

  useEffect(() => {
    const handleAppInstalled = () => {
      if (hasReported.current) return;

      if (trackCustomerPwaInstall(trackingContext)) {
        hasReported.current = true;
      }
    };

    window.addEventListener("appinstalled", handleAppInstalled);
    return () =>
      window.removeEventListener("appinstalled", handleAppInstalled);
  }, [trackingContext]);

  return null;
};

export default CustomerPwaInstallTracking;
