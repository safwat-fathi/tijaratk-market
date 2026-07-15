export const META_MARKETING_CONSENT_COOKIE =
  "tijaratk_marketing_consent";
export const META_CONSENT_CHANGED_EVENT =
  "tijaratk:meta-consent-changed";
export const META_CONSENT_SETTINGS_EVENT =
  "tijaratk:open-meta-consent-settings";

export type MetaMarketingConsent = "granted" | "denied" | null;

const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

const isTijaratkDomain = () =>
  window.location.hostname === "tijaratk.com" ||
  window.location.hostname.endsWith(".tijaratk.com");

export const readMetaMarketingConsent = (): MetaMarketingConsent => {
  if (typeof document === "undefined") return null;

  const cookiePrefix = `${META_MARKETING_CONSENT_COOKIE}=`;
  const value = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(cookiePrefix))
    ?.slice(cookiePrefix.length);

  return value === "granted" || value === "denied" ? value : null;
};

export const writeMetaMarketingConsent = (
  consent: Exclude<MetaMarketingConsent, null>,
) => {
  const domain = isTijaratkDomain() ? "; Domain=.tijaratk.com" : "";
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${META_MARKETING_CONSENT_COOKIE}=${consent}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${domain}${secure}`;
  window.dispatchEvent(
    new CustomEvent(META_CONSENT_CHANGED_EVENT, { detail: consent }),
  );
};

const expireCookie = (name: string, domain = "") => {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain}`;
};

export const removeMetaBrowserCookies = () => {
  expireCookie("_fbp");
  expireCookie("_fbc");
  if (isTijaratkDomain()) {
    expireCookie("_fbp", "; Domain=.tijaratk.com");
    expireCookie("_fbc", "; Domain=.tijaratk.com");
  }
};

export const openMetaConsentSettings = () => {
  window.dispatchEvent(new Event(META_CONSENT_SETTINGS_EVENT));
};

