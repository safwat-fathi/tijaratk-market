"use client";

import { useEffect } from "react";

/** Registers the root-scoped, network-first worker used by the customer PWA/TWA. */
export default function CustomerServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .register("/sw.js?app=customer", { scope: "/" })
      .catch(() => undefined);
  }, []);

  return null;
}
