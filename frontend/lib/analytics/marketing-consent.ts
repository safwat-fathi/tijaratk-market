export const MARKETING_CONSENT_COOKIE = "tijaratk_marketing_consent";
export const MARKETING_CONSENT_CHANGED_EVENT =
  "tijaratk:marketing-consent-changed";
export const MARKETING_CONSENT_SETTINGS_EVENT =
  "tijaratk:open-marketing-consent-settings";

export type MarketingConsent = "granted" | "denied" | null;

const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

const isTijaratkDomain = () =>
  window.location.hostname === "tijaratk.com" ||
  window.location.hostname.endsWith(".tijaratk.com");

export const readMarketingConsent = (): MarketingConsent => {
  if (typeof document === "undefined") return null;

  const cookiePrefix = `${MARKETING_CONSENT_COOKIE}=`;
  const value = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(cookiePrefix))
    ?.slice(cookiePrefix.length);

  return value === "granted" || value === "denied" ? value : null;
};

export const writeMarketingConsent = (
  consent: Exclude<MarketingConsent, null>,
) => {
  const domain = isTijaratkDomain() ? "; Domain=.tijaratk.com" : "";
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${MARKETING_CONSENT_COOKIE}=${consent}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${domain}${secure}`;
  window.dispatchEvent(
    new CustomEvent(MARKETING_CONSENT_CHANGED_EVENT, { detail: consent }),
  );
};

const expireCookie = (name: string, domain = "") => {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain}`;
};

export const removeBrowserCookies = (cookieNames: Iterable<string>) => {
  if (typeof document === "undefined") return;

  for (const cookieName of new Set(cookieNames)) {
    expireCookie(cookieName);
    if (isTijaratkDomain()) {
      expireCookie(cookieName, "; Domain=.tijaratk.com");
    }
  }
};

export const openMarketingConsentSettings = () => {
  window.dispatchEvent(new Event(MARKETING_CONSENT_SETTINGS_EVENT));
};
