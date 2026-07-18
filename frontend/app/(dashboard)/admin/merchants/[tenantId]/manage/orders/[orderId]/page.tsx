import { redirect } from "next/navigation";
import {
  updateManagedOrderItemAction,
  updateManagedOrderStatusAction,
  updateManagedOrderTotalAction,
} from "@/actions/admin-server";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminService } from "@/services/api/admin.service";
import ManagedOutOfStockAction from "./ManagedOutOfStockAction";

export const dynamic = "force-dynamic";

export default async function ManagedOrderDetailsPage({
  params,
}: {
  params: Promise<{ tenantId: string; orderId: string }>;
}) {
  const { tenantId: tenantIdValue, orderId: orderIdValue } = await params;
  const tenantId = Number(tenantIdValue);
  const orderId = Number(orderIdValue);
  const sessionResponse = await adminService.getCurrentManagementSession();
  const session = sessionResponse.data;
  if (!session || session.tenant_id !== tenantId) {
    redirect(`/api/auth/admin/managed-session/revoke?redirect=${encodeURIComponent(`/admin/merchants/${tenantId}`)}`);
  }

  const permissions = new Set(session.permissions);
  const [orderResponse, productsResponse, activityResponse] = await Promise.all([
    adminService.getManagedOrder(tenantId, orderId),
    permissions.has("products.read")
      ? adminService.getManagedProducts(tenantId)
      : Promise.resolve(null),
    permissions.has("activity_logs.read")
      ? adminService.getManagedActivityLogs(tenantId, {
          entity_type: "order",
          entity_id: orderId,
          limit: 20,
        })
      : Promise.resolve(null),
  ]);
  if (!orderResponse.data) {
    redirect(`/api/auth/admin/managed-session/revoke?redirect=${encodeURIComponent(`/admin/merchants/${tenantId}`)}`);
  }

  const order = orderResponse.data;
  const products = productsResponse?.success 
    ? (Array.isArray(productsResponse.data) ? productsResponse.data : productsResponse.data?.data || []) 
    : [];
  const activity = activityResponse?.success ? activityResponse.data?.items || [] : [];
  const canMarkItemsOutOfStock =
    order.status === "draft" || order.status === "confirmed";
  const deliverableItemCount = order.items.filter(
    (item) => !item.is_out_of_stock,
  ).length;

  return (
    <div className="space-y-5">
      <div>
        <a href={`/admin/merchants/${tenantId}/manage/orders`} className="text-sm text-brand-primary hover:underline">الرجوع إلى الطلبات</a>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">الطلب #{order.id}</h1>
        <p className="text-sm text-gray-500">الحالة الحالية: {order.status}</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-1">
          <h2 className="font-bold text-gray-900">بيانات تنفيذ الطلب</h2>
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            <p><strong>العميل:</strong> {order.customer?.name || "-"}</p>
            <p><strong>الهاتف:</strong> <a className="text-brand-primary" href={`tel:${order.customer?.phone || ""}`}>{order.customer?.phone || "-"}</a></p>
            <p><strong>العنوان:</strong> {order.customer?.address || "-"}</p>
            <p><strong>الإجمالي:</strong> {String(order.total ?? 0)} ج.م</p>
          </div>
        </Card>

        <Card className="space-y-4 p-5 xl:col-span-2">
          <h2 className="font-bold text-gray-900">إجراءات الطلب</h2>
          {permissions.has("orders.update_status") ? (
            <form action={updateManagedOrderStatusAction.bind(null, tenantId, orderId)} className="grid gap-3 sm:grid-cols-3">
              <select name="status" defaultValue={order.status} className="rounded-md border border-gray-300 bg-white px-3 py-2">
                <option value="draft">جديد</option>
                <option value="confirmed">مؤكد</option>
                <option value="out_for_delivery">خرج للتوصيل</option>
                <option value="completed">مكتمل</option>
                <option value="cancelled">ملغي</option>
              </select>
              <input name="cancellation_reason" maxLength={500} placeholder="سبب الإلغاء عند الحاجة" className="rounded-md border border-gray-300 px-3 py-2" />
              <Button type="submit">تحديث الحالة</Button>
            </form>
          ) : null}
          {permissions.has("orders.update_pricing") ? (
            <form action={updateManagedOrderTotalAction.bind(null, tenantId, orderId)} className="flex flex-wrap gap-2">
              <input name="total" type="number" min="0" step="0.01" required defaultValue={String(order.total ?? 0)} className="rounded-md border border-gray-300 px-3 py-2" />
              <Button type="submit" variant="outline">تحديث الإجمالي</Button>
            </form>
          ) : null}
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900">منتجات الطلب</h2>
        {order.items.map((item) => (
          <Card key={item.id} className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-gray-900">{item.name_snapshot}</h3>
                <p className="text-sm text-gray-500">الكمية: {item.quantity} · السعر: {String(item.total_price ?? 0)} ج.م</p>
                {item.is_out_of_stock ? <p className="mt-1 text-sm font-semibold text-red-700">غير متوفر</p> : null}
              </div>
              <span className="text-xs text-gray-500">قرار البديل: {item.replacement_decision_status || "none"}</span>
            </div>

            <div className="flex flex-wrap gap-3">
              {permissions.has("orders.update_pricing") ? (
                <form action={updateManagedOrderItemAction.bind(null, tenantId, orderId, item.id, "price")} className="flex gap-2">
                  <input name="total_price" type="number" min="0.01" step="0.01" required defaultValue={String(item.total_price ?? "")} className="w-28 rounded-md border border-gray-300 px-2 py-1" />
                  <Button type="submit" size="sm" variant="outline">حفظ السعر</Button>
                </form>
              ) : null}
              {permissions.has("orders.update_pricing") && permissions.has("products.update_availability") && canMarkItemsOutOfStock && !item.is_out_of_stock ? (
                <ManagedOutOfStockAction
                  tenantId={tenantId}
                  orderId={orderId}
                  itemId={item.id}
                  itemName={item.name_snapshot}
                  requiresCancellationConfirmation={deliverableItemCount === 1}
                />
              ) : null}
            </div>

            {permissions.has("orders.manage_replacements") && permissions.has("products.read") ? (
              <div className="flex flex-wrap gap-2">
                <form action={updateManagedOrderItemAction.bind(null, tenantId, orderId, item.id, "replacement")} className="flex flex-1 gap-2">
                  <select name="replaced_by_product_id" required className="min-w-48 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2">
                    <option value="">اختر بديلاً</option>
                    {products.filter((product) => product.id !== item.product_id && product.is_available).map((product) => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>
                  <Button type="submit" size="sm">اقتراح البديل</Button>
                </form>
                <form action={updateManagedOrderItemAction.bind(null, tenantId, orderId, item.id, "replacement-reset")}>
                  <Button type="submit" size="sm" variant="outline">إعادة ضبط</Button>
                </form>
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      {permissions.has("activity_logs.read") ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900">سجل الطلب</h2>
          <ActivityTimeline items={activity} />
        </section>
      ) : null}
    </div>
  );
}
