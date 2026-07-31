import { redirect } from "next/navigation";
import { createNoIndexMetadata } from "@/lib/marketing-seo";
import { getMyTenantCached } from "@/lib/server/dashboard-request-cache";
import OnboardingWizard from "./_components/OnboardingWizard";

export const metadata = createNoIndexMetadata(
  "إعداد المتجر",
  "أكمل خطوات إعداد متجرك على تجارتك.",
);

export const dynamic = "force-dynamic";

export default async function MerchantOnboardingPage() {
  const response = await getMyTenantCached();

  if (!response.success || !response.data) {
    redirect("/merchant/login");
  }

  if (response.data.onboarding_completed) {
    redirect("/merchant");
  }

  return <OnboardingWizard initialTenant={response.data} />;
}
