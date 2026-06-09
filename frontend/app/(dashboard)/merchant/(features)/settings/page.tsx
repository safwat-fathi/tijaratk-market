import { tenantsService } from "@/services/api/tenants.service";
import SettingsForm from "./_components/SettingsForm";
import { createNoIndexMetadata } from "@/lib/marketing-seo";

export const metadata = createNoIndexMetadata(
  "إعدادات المتجر",
  "قم بتحديث معلومات المتجر وإعدادات التوصيل",
);

export default async function SettingsPage() {
  const tenantResponse = await tenantsService.getMyTenant();

  if (!tenantResponse.success || !tenantResponse.data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-gray-500 mb-4">تعذر تحميل بيانات المتجر.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-20 max-w-2xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          إعدادات المتجر
        </h1>
      </div>

      <SettingsForm tenant={tenantResponse.data} />
    </div>
  );
}
