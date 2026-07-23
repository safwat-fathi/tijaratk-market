"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const MarketingTrackingRuntime = dynamic(
  () => import("./MarketingTrackingRuntime"),
  { ssr: false },
);

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

/** Loads marketing providers only on public pages that are allowed to use them. */
export default function MarketingTracking() {
  const pathname = usePathname();

  if (!isAllowlistedPublicPath(pathname)) return null;

  return <MarketingTrackingRuntime pathname={pathname} />;
}
