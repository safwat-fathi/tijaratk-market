import { tenantsService } from "@/services/api/tenants.service";
import { merchantDirectoryService } from "@/services/api/stores-directory.service";
import SettingsForm from "./_components/SettingsForm";
import { createNoIndexMetadata } from "@/lib/marketing-seo";
import Link from "next/link";
import { PushNotificationsSettingsCard } from "@/components/pwa/PushNotificationsControl";

export const metadata = createNoIndexMetadata(
  "إعدادات المتجر",
  "قم بتحديث معلومات المتجر وإعدادات التوصيل",
);

export default async function SettingsPage() {
  const [tenantResponse, profileResponse, areasResponse] = await Promise.all([
    tenantsService.getMyTenant(),
    merchantDirectoryService.getProfile(),
    merchantDirectoryService.getActiveAreas(),
  ]);

  if (!tenantResponse.success || !tenantResponse.data) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 py-20 text-center">
        <p className="text-gray-500 mb-4">تعذر تحميل بيانات المتجر.</p>
        <PushNotificationsSettingsCard className="text-start" />
      </div>
    );
  }

  const tenant = tenantResponse.data;
  if (profileResponse.success && profileResponse.data) {
    tenant.directory_profile = profileResponse.data;
    tenant.tenant_delivery_areas =
      profileResponse.data.tenant?.tenant_delivery_areas ??
      profileResponse.data.delivery_areas ??
      [];
  }

  return (
    <div className="flex flex-col gap-6 pb-20 max-w-2xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          إعدادات المتجر
        </h1>
        <Link 
          href="/merchant/settings/security" 
          className="text-sm font-medium text-brand-primary hover:text-brand-primary/80 transition-colors"
        >
          إعدادات الأمان
        </Link>
      </div>

      <SettingsForm 
        tenant={tenant} 
        activeAreas={areasResponse.data || []} 
      />

      <PushNotificationsSettingsCard />
    </div>
  );
}
