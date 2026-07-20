import { redirect } from "next/navigation";
import { adminService } from "@/services/api/admin.service";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import MissingDeliveryAreaRequestsManager from "./_components/MissingDeliveryAreaRequestsManager";

export const dynamic = "force-dynamic";

export default async function MissingDeliveryAreaRequestsPage() {
  try {
    const [requestsResponse, areasResponse] = await Promise.all([
      adminService.getMissingDeliveryAreaRequests(),
      adminService.getDirectoryAreas(),
    ]);
    if (!requestsResponse.success && requestsResponse.message === "Unauthorized") redirect("/admin/login");
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">طلبات المناطق الناقصة</h1>
          <p className="mt-1 text-sm text-gray-500">أضف المنطقة الفرعية أولاً من إدارة المناطق، ثم اربطها بالطلب هنا.</p>
        </div>
        <MissingDeliveryAreaRequestsManager initialRequests={requestsResponse.data ?? []} areas={areasResponse.data ?? []} />
      </div>
    );
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    return <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">تعذر تحميل طلبات المناطق.</p>;
  }
}
