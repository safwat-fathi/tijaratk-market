import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import {
  getManagedSessionRevokePath,
  getManagedStoreFallbackPath,
  hasManagedSectionAccess,
  isManagedPermissionFailure,
  isManagedSessionFailure,
} from "@/lib/admin-managed-access";
import { adminService } from "@/services/api/admin.service";

export const metadata = { title: "طلبات المتجر" };

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  draft: "جديد",
  confirmed: "مؤكد",
  out_for_delivery: "خرج للتوصيل",
  completed: "مكتمل",
  cancelled: "ملغي",
  rejected_by_customer: "مرفوض من العميل",
};

export default async function ManagedOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { tenantId: tenantIdValue } = await params;
  const { date } = await searchParams;
  const tenantId = Number(tenantIdValue);
  const sessionResponse = await adminService.getCurrentManagementSession();
  if (!sessionResponse.success) {
    if (isManagedSessionFailure(sessionResponse)) {
      redirect(getManagedSessionRevokePath(tenantId));
    }
    throw new Error(
      sessionResponse.message || "تعذر التحقق من جلسة إدارة المتجر",
    );
  }
  const session = sessionResponse.data;
  if (!session || session.tenant_id !== tenantId) {
    redirect(getManagedSessionRevokePath(tenantId));
  }
  if (!hasManagedSectionAccess(session.permissions, "orders")) {
    redirect(getManagedStoreFallbackPath(session));
  }

  const response = await adminService.getManagedOrders(tenantId, date);
  if (!response.success) {
    if (isManagedSessionFailure(response)) {
      redirect(getManagedSessionRevokePath(tenantId));
    }
    if (isManagedPermissionFailure(response)) {
      redirect(`/admin/merchants/${tenantId}/manage`);
    }
    throw new Error(response.message || "تعذر تحميل طلبات المتجر");
  }
  const orders = response.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">طلبات المتجر</h1>
          <p className="text-sm text-gray-500">تعرض بيانات العميل المطلوبة لتنفيذ كل طلب فقط.</p>
        </div>
        <form className="flex items-end gap-2" method="get">
          <label className="text-sm font-semibold text-gray-700">
            التاريخ
            <input type="date" name="date" defaultValue={date} className="mt-1 block rounded-md border border-gray-300 px-3 py-2" />
          </label>
          <button type="submit" className="min-h-10 rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold">تصفية</button>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {orders.map((order) => (
          <a key={order.id} href={`/admin/merchants/${tenantId}/manage/orders/${order.id}`} className="block">
            <Card className="h-full space-y-3 p-5 transition hover:border-brand-primary hover:shadow-md">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-gray-900">طلب #{order.id}</h2>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                  {statusLabels[order.status] || order.status}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                <p>{order.customer?.name || "عميل"}</p>
                <p>{order.customer?.phone || "بدون رقم"}</p>
              </div>
              <div className="flex justify-between text-sm">
                <span>{new Date(order.created_at).toLocaleString("ar-EG")}</span>
                <strong>{String(order.total ?? 0)} ج.م</strong>
              </div>
            </Card>
          </a>
        ))}
        {orders.length === 0 ? <Card className="p-10 text-center text-gray-500">لا توجد طلبات.</Card> : null}
      </div>
    </div>
  );
}
