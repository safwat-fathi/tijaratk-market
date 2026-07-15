"use client";

import { openMarketingConsentSettings } from "@/lib/analytics/marketing-consent";
import { GOOGLE_ANALYTICS_MEASUREMENT_ID } from "@/lib/analytics/google-analytics";
import { META_PIXEL_ID } from "@/lib/analytics/meta-pixel";

/** Reopens the marketing consent dialog for withdrawal or re-consent. */
export default function MarketingPrivacySettingsButton() {
  if (!META_PIXEL_ID && !GOOGLE_ANALYTICS_MEASUREMENT_ID) {
    return null;
  }

  return (
    <>
      <span className="hidden text-[#222B2E]/20 sm:inline" aria-hidden="true">
        •
      </span>
      <button
        type="button"
        onClick={openMarketingConsentSettings}
        className="cursor-pointer text-sm font-bold text-brand-primary transition-colors hover:text-[#27AE60] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
      >
        إعدادات ملفات التسويق
      </button>
      <span className="hidden text-[#222B2E]/20 sm:inline" aria-hidden="true">
        •
      </span>
    </>
  );
}
