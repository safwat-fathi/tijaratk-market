"use client";

import { useEffect } from "react";
import {
  MARKETING_CONSENT_CHANGED_EVENT,
  readMarketingConsent,
} from "@/lib/analytics/marketing-consent";
import { sendMetaPixelEvent } from "@/lib/analytics/meta-pixel";

type MetaStorefrontViewProps = {
  contentId: string;
  storefrontType: "tenant" | "zone";
};

/** Reports one consented ViewContent event for a storefront visit. */
export default function MetaStorefrontView({
  contentId,
  storefrontType,
}: MetaStorefrontViewProps) {
  useEffect(() => {
    const reportView = () => {
      if (
        readMarketingConsent() !== "granted" ||
        new URLSearchParams(window.location.search).has("reorder")
      ) {
        return;
      }

      const viewKey = `${storefrontType}:${contentId}`;
      window.__tijaratkMetaViewedContent ??= new Set<string>();
      if (window.__tijaratkMetaViewedContent.has(viewKey)) {
        return;
      }

      const wasSent = sendMetaPixelEvent("ViewContent", {
        content_ids: [contentId],
        content_type: "product_group",
        content_category: "storefront",
        storefront_type: storefrontType,
      });
      if (wasSent) {
        window.__tijaratkMetaViewedContent.add(viewKey);
      }
    };

    reportView();
    window.addEventListener(MARKETING_CONSENT_CHANGED_EVENT, reportView);
    return () =>
      window.removeEventListener(MARKETING_CONSENT_CHANGED_EVENT, reportView);
  }, [contentId, storefrontType]);

  return null;
}
