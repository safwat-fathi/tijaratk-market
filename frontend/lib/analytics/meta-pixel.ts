import {
  readMarketingConsent,
  removeBrowserCookies,
} from "@/lib/analytics/marketing-consent";

const configuredPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();

const SENSITIVE_META_QUERY_KEYS = new Set([
  "access_code",
  "accesscode",
  "customer_code",
  "customercode",
  "public_token",
  "reorder",
  "token",
  "tracking_token",
]);

export const META_PIXEL_ID =
  configuredPixelId && /^\d+$/.test(configuredPixelId)
    ? configuredPixelId
    : undefined;

export type MetaStandardEventName =
  | "PageView"
  | "ViewContent"
  | "Search"
  | "AddToCart"
  | "InitiateCheckout"
  | "Purchase";

export type MetaPixelParameters = Record<
  string,
  string | number | boolean | string[] | Array<Record<string, unknown>> | undefined
>;

type MetaPixelFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  loaded: boolean;
  version: string;
  push: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    fbq?: MetaPixelFunction;
    _fbq?: MetaPixelFunction;
    __tijaratkMetaPixelIds?: Set<string>;
    __tijaratkMetaLastPageLocation?: string;
    __tijaratkMetaViewedContent?: Set<string>;
  }
}

export const isSafeMetaBrowserLocation = () => {
  if (typeof window === "undefined") return false;
  const searchParams = new URLSearchParams(window.location.search);
  return !Array.from(searchParams.keys()).some((key) =>
    SENSITIVE_META_QUERY_KEYS.has(key.toLowerCase()),
  );
};

const ensureMetaPixelFunction = (): MetaPixelFunction | null => {
  if (typeof window === "undefined" || !META_PIXEL_ID) return null;
  if (window.fbq) return window.fbq;

  const pixelFunction = function metaPixelQueue(...args: unknown[]) {
    if (pixelFunction.callMethod) {
      pixelFunction.callMethod(...args);
      return;
    }
    pixelFunction.queue.push(args);
  } as MetaPixelFunction;
  pixelFunction.queue = [];
  pixelFunction.loaded = true;
  pixelFunction.version = "2.0";
  pixelFunction.push = (...args: unknown[]) => pixelFunction(...args);
  window.fbq = pixelFunction;
  window._fbq = pixelFunction;
  return pixelFunction;
};

export const initializeMetaPixel = (): MetaPixelFunction | null => {
  if (
    readMarketingConsent() !== "granted" ||
    !META_PIXEL_ID ||
    !isSafeMetaBrowserLocation()
  ) {
    return null;
  }

  const pixelFunction = ensureMetaPixelFunction();
  if (!pixelFunction) return null;

  window.__tijaratkMetaPixelIds ??= new Set<string>();
  if (!window.__tijaratkMetaPixelIds.has(META_PIXEL_ID)) {
    pixelFunction("consent", "grant");
    pixelFunction("init", META_PIXEL_ID);
    window.__tijaratkMetaPixelIds.add(META_PIXEL_ID);
  }

  return pixelFunction;
};

export const sendMetaPixelEvent = (
  eventName: MetaStandardEventName,
  parameters: MetaPixelParameters = {},
  eventId?: string,
) => {
  const pixelFunction = initializeMetaPixel();
  if (!pixelFunction || !META_PIXEL_ID) return false;

  try {
    pixelFunction(
      "trackSingle",
      META_PIXEL_ID,
      eventName,
      parameters,
      ...(eventId ? [{ eventID: eventId }] : []),
    );
    return true;
  } catch {
    // Marketing analytics must never interrupt the customer journey.
    return false;
  }
};

export const revokeMetaPixelConsent = () => {
  if (typeof window === "undefined") return;

  try {
    window.fbq?.("consent", "revoke");
  } catch {
    // Consent withdrawal still clears local identifiers below.
  }
  removeBrowserCookies(["_fbp", "_fbc"]);
  window.__tijaratkMetaLastPageLocation = undefined;
  window.__tijaratkMetaViewedContent?.clear();
};
