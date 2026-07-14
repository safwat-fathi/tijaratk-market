import { redirect } from "next/navigation";
import {
  buildCustomerAnalyticsPageLocation,
  type CustomerAnalyticsSearchParams,
} from "@/lib/analytics/google-analytics";

type StoresRedirectSearchParams = CustomerAnalyticsSearchParams & {
  area?: string;
  category?: string;
};

type Props = {
  searchParams: Promise<StoresRedirectSearchParams>;
};

export default async function StoresQueryRedirectPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const { area, category } = resolvedSearchParams;
  const areaSlug = area?.trim();
  const categorySlug = category?.trim();
  const campaignSearchParams = {
    utm_source: resolvedSearchParams.utm_source,
    utm_medium: resolvedSearchParams.utm_medium,
    utm_campaign: resolvedSearchParams.utm_campaign,
    utm_content: resolvedSearchParams.utm_content,
  };

  if (areaSlug && categorySlug) {
    redirect(
      buildCustomerAnalyticsPageLocation(
        `/stores/${encodeURIComponent(areaSlug)}/${encodeURIComponent(categorySlug)}`,
        campaignSearchParams,
      ),
    );
  }

  redirect(buildCustomerAnalyticsPageLocation("/", campaignSearchParams));
}
