import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { adminService } from "@/services/api/admin.service";
import { DispatchRefresh } from "./_components/DispatchRefresh";

export const dynamic = "force-dynamic";

type DispatchQueuePageProps = {
  params: Promise<{ zoneId: string }>;
  searchParams: Promise<{ status?: string }>;
};

const statusLabels: Record<string, string> = {
  pending: "بانتظار الإسناد",
  awaiting_merchant: "بانتظار المتجر",
  accepted: "مقبول",
  cancelled: "ملغي",
};

export default async function DispatchQueuePage({ params, searchParams }: DispatchQueuePageProps) {
  const zoneId = Number((await params).zoneId);
  const { status } = await searchParams;
  if (!Number.isInteger(zoneId) || zoneId <= 0) notFound();
  const sessionResponse = await adminService.getCurrentManagementSession();
  const session = sessionResponse.data;
  if (!session) {
    const target = encodeURIComponent("/admin/zones");
    redirect(`/api/auth/admin/managed-session/revoke?redirect=${target}`);
  }
  const [contextResponse, dispatchesResponse] = await Promise.all([
    adminService.getManagedZoneDispatchContext(session.tenant_id),
    adminService.getManagedZoneDispatches(session.tenant_id, status),
  ]);
  const context = contextResponse.data;
  if (!context || context.zone.id !== zoneId) notFound();
  const zone = context.zone;
  const dispatches = dispatchesResponse.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/zones" className="text-sm text-brand-primary hover:underline">الرجوع إلى المناطق</Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">توزيع طلبات {zone.name}</h1>
          <DispatchRefresh />
        </div>
        <div className="flex flex-wrap gap-2">
          {["", "pending", "awaiting_merchant", "accepted", "cancelled"].map((value) => (
            <Link key={value || "all"} href={value ? `?status=${value}` : "?"} className={`rounded-full px-3 py-1.5 text-sm ${status === value || (!status && !value) ? "bg-brand-primary text-white" : "bg-white text-gray-700"}`}>{value ? statusLabels[value] : "الكل"}</Link>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {dispatches.map((dispatch) => (
          <Card key={dispatch.id} className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-gray-900">طلب #{dispatch.order.id} · {dispatch.order.customer_name || "عميل"}</p>
                <p className="text-sm text-gray-500">
                  {dispatch.order.delivery_area?.name_ar || "منطقة غير مسجلة"} ·{" "}
                  {dispatch.order.delivery_address || "العنوان غير مسجل"} ·{" "}
                  {Number(dispatch.order.total || 0).toLocaleString("ar-EG")} ج.م
                </p>
                <p className="mt-1 text-xs text-gray-500">{dispatch.assignments[0]?.target_tenant?.name || "لم يُسند بعد"}</p>
                {dispatch.order.scheduled_delivery_date ? (
                  <p className="mt-1 text-sm font-semibold text-amber-800">
                    توصيل مجدول: {dispatch.order.delivery_time_window_snapshot}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold">{statusLabels[dispatch.status]}</span>
                <Link href={`/admin/zones/${zone.id}/dispatches/${dispatch.id}`} className="text-sm font-semibold text-brand-primary hover:underline">التفاصيل والإسناد</Link>
              </div>
            </div>
          </Card>
        ))}
        {dispatches.length === 0 ? <Card className="p-8 text-center text-gray-500">لا توجد طلبات بهذه الحالة.</Card> : null}
      </div>
    </div>
  );
}
