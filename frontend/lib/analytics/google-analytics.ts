import {
  readMarketingConsent,
  removeBrowserCookies,
} from "@/lib/analytics/marketing-consent";

const GOOGLE_ANALYTICS_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;
const configuredMeasurementId =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim().toUpperCase();

export const GOOGLE_ANALYTICS_MEASUREMENT_ID =
  configuredMeasurementId &&
  GOOGLE_ANALYTICS_MEASUREMENT_ID_PATTERN.test(configuredMeasurementId)
    ? configuredMeasurementId
    : undefined;

type GoogleAnalyticsParameters = Record<
  string,
  string | number | boolean | undefined
>;

type GoogleTag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GoogleTag;
    __tijaratkGoogleAnalyticsInitialized?: boolean;
    __tijaratkGoogleAnalyticsConsentGranted?: boolean;
  }
}

const ensureGoogleTag = (): GoogleTag | null => {
  if (typeof window === "undefined" || !GOOGLE_ANALYTICS_MEASUREMENT_ID) {
    return null;
  }

  window.dataLayer ??= [];
  window.gtag ??= function queuedGoogleTag() {
    window.dataLayer?.push(arguments);
  };

  return window.gtag;
};

export const initializeGoogleAnalytics = (): GoogleTag | null => {
  if (readMarketingConsent() !== "granted") return null;

  const googleTag = ensureGoogleTag();
  if (!googleTag) return null;

  if (!window.__tijaratkGoogleAnalyticsInitialized) {
    googleTag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    googleTag("js", new Date());
    window.__tijaratkGoogleAnalyticsInitialized = true;
  }

  if (!window.__tijaratkGoogleAnalyticsConsentGranted) {
    googleTag("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.__tijaratkGoogleAnalyticsConsentGranted = true;
  }

  return googleTag;
};

export const sendCustomerAnalyticsEvent = (
  eventName: string,
  parameters: GoogleAnalyticsParameters = {},
) => {
  const googleTag = initializeGoogleAnalytics();
  if (!googleTag || !GOOGLE_ANALYTICS_MEASUREMENT_ID) return false;

  try {
    googleTag("event", eventName, {
      ...parameters,
      send_to: GOOGLE_ANALYTICS_MEASUREMENT_ID,
    });
    return true;
  } catch {
    // Marketing analytics must never interrupt the customer journey.
    return false;
  }
};

export const configureCustomerAnalyticsPage = (
  parameters: GoogleAnalyticsParameters,
) => {
  const googleTag = initializeGoogleAnalytics();
  if (!googleTag || !GOOGLE_ANALYTICS_MEASUREMENT_ID) return false;

  try {
    googleTag("config", GOOGLE_ANALYTICS_MEASUREMENT_ID, {
      ...parameters,
      send_page_view: false,
    });
    return true;
  } catch {
    // Marketing analytics must never interrupt the customer journey.
    return false;
  }
};

export const revokeGoogleAnalyticsConsent = () => {
  if (typeof window === "undefined") return;

  try {
    window.gtag?.("consent", "update", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  } catch {
    // Consent withdrawal still clears local identifiers below.
  }

  window.__tijaratkGoogleAnalyticsConsentGranted = false;
  const googleCookieNames = document.cookie
    .split(";")
    .map((item) => item.trim().split("=", 1)[0])
    .filter(
      (cookieName) =>
        cookieName === "_ga" ||
        cookieName === "_gid" ||
        cookieName === "_gat" ||
        cookieName.startsWith("_ga_"),
    );
  removeBrowserCookies(googleCookieNames);
};
