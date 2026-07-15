import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { tenantsService } from "@/services/api/tenants.service";
import { ordersService } from "@/services/api/orders.service";
import MerchantLayoutClient from "./ClientLayout";

export const metadata: Metadata = {
  manifest: "/pwa/merchant/manifest",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function MerchantFeaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [tenantResponse, inboxSummaryResponse] = await Promise.all([
    tenantsService.getMyTenant(),
    ordersService.getInboxSummary(),
  ]);
  
  if (tenantResponse.success && tenantResponse.data) {
    if (!tenantResponse.data.onboarding_completed) {
      redirect("/merchant/onboarding");
    }
  } else {
    // If we can't fetch the tenant (e.g. not logged in), redirect to login
    redirect("/merchant/login");
  }

  const tenant = tenantResponse.data;
  const merchantAppName = tenant.directory_profile?.display_name || tenant.name;
  const newOrdersCount =
    inboxSummaryResponse.success && inboxSummaryResponse.data
      ? inboxSummaryResponse.data.new_orders_count
      : 0;

  return (
    <MerchantLayoutClient
      merchantAppName={merchantAppName}
      newOrdersCount={newOrdersCount}
    >
      {children}
    </MerchantLayoutClient>
  );
}
