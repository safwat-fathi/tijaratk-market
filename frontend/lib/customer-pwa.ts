import type { Metadata } from "next";

export const CUSTOMER_PWA = {
  name: "تجارتك",
  manifestPath: "/pwa/customer/manifest",
  id: "/pwa/customer",
  startUrl: "/?src=pwa-customer",
} as const;

export const CUSTOMER_PWA_METADATA = {
  manifest: CUSTOMER_PWA.manifestPath,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: CUSTOMER_PWA.name,
  },
} satisfies Metadata;
