import Link from "next/link";
import { notFound } from "next/navigation";
import { assignZoneDispatchAction, cancelZoneDispatchAction } from "@/actions/admin-server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminService } from "@/services/api/admin.service";

export const dynamic = "force-dynamic";

type DispatchDetailPageProps = { params: Promise<{ zoneId: string; dispatchId: string }> };

export default async function DispatchDetailPage({ params }: DispatchDetailPageProps) {
  const values = await params;
  const zoneId = Number(values.zoneId);
  const dispatchId = Number(values.dispatchId);
  if (!Number.isInteger(zoneId) || !Number.isInteger(dispatchId)) notFound();
  const sessionResponse = await adminService.getCurrentManagementSession();
  const session = sessionResponse.data;
  if (!session) notFound();
  const [contextResponse, dispatchResponse] = await Promise.all([
    adminService.getManagedZoneDispatchContext(session.tenant_id),
    adminService.getManagedZoneDispatch(session.tenant_id, dispatchId),
  ]);
  const context = contextResponse.data;
  if (!context || context.zone.id !== zoneId) notFound();
  const zone = context.zone;
  if (!dispatchResponse.data) notFound();
  const dispatch = dispatchResponse.data;
  const merchants = context.eligible_merchants;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/zones/${zone.id}/dispatches`} className="text-sm text-brand-primary hover:underline">الرجوع إلى قائمة التوزيع</Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">طلب #{dispatch.order.id}</h1>
        <p className="text-sm text-gray-500">نسخة التوزيع {dispatch.version} · الحالة {dispatch.status}</p>
      </div>
      <Card className="p-5">
        <h2 className="font-bold text-gray-900">بيانات التنفيذ</h2>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <p>العميل: {dispatch.order.customer_name}</p><p>الهاتف: {dispatch.order.customer_phone}</p>
          <p>منطقة التوصيل: {dispatch.order.delivery_area?.name_ar || "غير مسجلة"}</p>
          <p>رسوم التوصيل: {Number(dispatch.order.delivery_fee || 0).toLocaleString("ar-EG")} ج.م</p>
          <p className="sm:col-span-2">العنوان: {dispatch.order.delivery_address}</p>
          {dispatch.order.scheduled_delivery_date ? (
            <p className="sm:col-span-2 font-semibold text-amber-800">
              موعد التوصيل المجدول: {dispatch.order.delivery_time_window_snapshot}
            </p>
          ) : null}
          <p>الإجمالي: {Number(dispatch.order.total || 0).toLocaleString("ar-EG")} ج.م</p>
        </div>
        <div className="mt-4 space-y-2">
          {dispatch.order.order_items?.map((item) => <div key={item.id} className="flex justify-between rounded-md bg-gray-50 p-2 text-sm"><span>{item.name_snapshot} · {item.quantity}</span><span>{Number(item.total_price || 0).toLocaleString("ar-EG")} ج.م</span></div>)}
        </div>
      </Card>

      {dispatch.status !== "accepted" && dispatch.status !== "cancelled" ? (
        <Card className="p-5">
          <h2 className="font-bold text-gray-900">إسناد يدوي</h2>
          <form action={assignZoneDispatchAction.bind(null, zone.id, zone.operator_tenant.id, dispatch.id)} className="mt-3 grid gap-3 md:grid-cols-3">
            <select name="target_tenant_id" required className="rounded-md border border-gray-300 bg-white px-3 py-2 md:col-span-2"><option value="">اختر المتجر</option>{merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.name} · أولوية {merchant.membership?.priority}</option>)}</select>
            <input type="hidden" name="expected_version" value={dispatch.version} />
            <input name="internal_notes" maxLength={500} className="rounded-md border border-gray-300 px-3 py-2 md:col-span-2" placeholder="ملاحظة داخلية اختيارية" />
            <Button type="submit">{dispatch.status === "awaiting_merchant" ? "إعادة الإسناد" : "إسناد الطلب"}</Button>
          </form>
        </Card>
      ) : null}

      {dispatch.status !== "cancelled" ? (
        <Card className="border-red-200 p-5">
          <h2 className="font-bold text-red-900">إلغاء تشغيلي</h2>
          <form action={cancelZoneDispatchAction.bind(null, zone.id, zone.operator_tenant.id, dispatch.id)} className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="expected_version" value={dispatch.version} />
            <input name="reason" required minLength={3} maxLength={500} className="flex-1 rounded-md border border-red-300 px-3 py-2" placeholder="سبب الإلغاء" />
            <Button type="submit" variant="outline">إلغاء الطلب والتوزيع</Button>
          </form>
        </Card>
      ) : null}

      <Card className="p-5">
        <h2 className="font-bold text-gray-900">سجل محاولات الإسناد</h2>
        <div className="mt-3 space-y-2">{dispatch.assignments.map((assignment) => <div key={assignment.id} className="rounded-md border border-gray-200 p-3 text-sm"><strong>{assignment.target_tenant?.name}</strong> · {assignment.status}<p className="text-xs text-gray-500">{assignment.reason || assignment.internal_notes || "بدون ملاحظات"}</p></div>)}</div>
      </Card>
    </div>
  );
}
