"use client";

import { useEffect } from "react";
import { runAfterLoadAndIdle } from "@/lib/browser/run-after-load-and-idle";

/** Registers the root-scoped, network-first worker used by the customer PWA/TWA. */
export default function CustomerServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (
      window.location.pathname.startsWith("/admin") ||
      window.location.pathname.startsWith("/merchant")
    ) {
      return;
    }

    return runAfterLoadAndIdle(() => {
      void navigator.serviceWorker
        .register("/sw.js?app=customer", { scope: "/" })
        .catch(() => undefined);
    });
  }, []);

  return null;
}
