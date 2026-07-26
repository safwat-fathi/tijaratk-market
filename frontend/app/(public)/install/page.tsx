import type { Metadata } from "next";
import CustomerAnalytics from "@/components/analytics/CustomerAnalytics";
import CustomerPwaInstallTracking from "@/components/analytics/CustomerPwaInstallTracking";
import { CUSTOMER_PWA_INSTALL_SURFACES } from "@/lib/analytics/storefront-ga4";
import InstallGuide from "./_components/InstallGuide";

export const metadata: Metadata = {
  title: "تثبيت التطبيق - تجارتك",
  description: "دليل تثبيت تطبيق تجارتك على جهازك بخطوات بسيطة.",
};

export default function InstallPage() {
  return (
    <>
      <CustomerAnalytics
        pageLocation="/install"
        pageTitle="تثبيت التطبيق - تجارتك"
      />
      <CustomerPwaInstallTracking
        installSurface={CUSTOMER_PWA_INSTALL_SURFACES.INSTALL_GUIDE}
      />
      <InstallGuide />
    </>
  );
}
