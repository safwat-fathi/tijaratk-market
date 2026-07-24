import UpdatePasswordForm from "../_components/UpdatePasswordForm";
import ChangePhoneForm from "../_components/ChangePhoneForm";
import { createNoIndexMetadata } from "@/lib/marketing-seo";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { tenantsService } from "@/services/api/tenants.service";
import { getCookieAction } from "@/app/actions/cookie-store";
import { STORAGE_KEYS } from "@/constants";

export const metadata = createNoIndexMetadata(
  "إعدادات الأمان",
  "تغيير كلمة المرور ورقم الهاتف الخاصين بحسابك",
);

export default async function SecuritySettingsPage() {
  const [tenantResponse, userCookie] = await Promise.all([
    tenantsService.getMyTenant(),
    getCookieAction(STORAGE_KEYS.USER),
  ]);
  const currentPhone = tenantResponse.data?.phone || "";
  let userRole: string | undefined;
  if (userCookie) {
    try {
      userRole = (JSON.parse(userCookie) as { role?: string }).role;
    } catch {
      userRole = undefined;
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-20 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Link 
          href="/merchant/settings" 
          className="text-gray-500 hover:text-gray-900 transition-colors p-2 rounded-full hover:bg-gray-100"
          aria-label="العودة للإعدادات"
        >
          <ArrowRight className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          إعدادات الأمان
        </h1>
      </div>

      <UpdatePasswordForm />
      {currentPhone && userRole === "owner" ? (
        <ChangePhoneForm currentPhone={currentPhone} />
      ) : null}
    </div>
  );
}
