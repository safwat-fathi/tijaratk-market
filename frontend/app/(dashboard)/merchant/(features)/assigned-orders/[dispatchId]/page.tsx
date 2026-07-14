import Link from "next/link";
import { notFound } from "next/navigation";
import {
  acceptAssignedOrderAction,
  rejectAssignedOrderAction,
  resetAssignedReplacementAction,
  updateAssignedOrderStatusAction,
  updateAssignedQuoteAction,
  updateAssignedReplacementAction,
} from "@/actions/assigned-orders";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { assignedOrdersService } from "@/services/api/assigned-orders.service";

export const dynamic = "force-dynamic";

type AssignedOrderPageProps = { params: Promise<{ dispatchId: string }> };

export default async function AssignedOrderPage({ params }: AssignedOrderPageProps) {
  const dispatchId = Number((await params).dispatchId);
  if (!Number.isInteger(dispatchId) || dispatchId <= 0) notFound();
  const response = await assignedOrdersService.getAssignedOrder(dispatchId);
  if (!response.success || !response.data) notFound();
  const dispatch = response.data;
  const assignment = dispatch.assignments.find((item) => item.is_current);
  if (!assignment) notFound();
  const isPending = assignment.status === "pending";
  const isAccepted = assignment.status === "accepted";
  const canManageReplacements =
    isAccepted && dispatch.order.status === "confirmed";
  const replacementProductsResponse = canManageReplacements
    ? await assignedOrdersService.getReplacementProducts(dispatchId)
    : null;
  const replacementProducts = replacementProductsResponse?.data ?? [];
  const quoteByItem = new Map(assignment.quote_lines.map((line) => [line.order_item_id, line]));

  return (
    <div className="space-y-5 pb-12">
      <div>
        <Link href="/merchant/assigned-orders" className="text-sm text-brand-primary hover:underline">الرجوع إلى الطلبات المسندة</Link>
        <h1 className="mt-2 text-2xl font-bold text-brand-text">طلب #{dispatch.order.id}</h1>
        <p className="text-sm text-muted-foreground">{dispatch.zone_storefront?.name} · {isPending ? "بانتظار قبولك" : "مقبول للتنفيذ"}</p>
      </div>

      <Card className="p-5">
        <h2 className="font-bold text-brand-text">بيانات العميل للتنفيذ</h2>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <p>الاسم: {dispatch.order.customer_name || "عميل"}</p>
          <a href={`tel:${dispatch.order.customer_phone}`} className="text-brand-primary">الهاتف: {dispatch.order.customer_phone}</a>
          <p className="sm:col-span-2">العنوان: {dispatch.order.delivery_address}</p>
          {dispatch.order.delivery_time_window_snapshot ? <p className="sm:col-span-2">موعد التوصيل: {dispatch.order.delivery_time_window_snapshot}</p> : null}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-bold text-brand-text">الأصناف والأسعار</h2>
        <div className="mt-4 space-y-3">
          {dispatch.order.order_items?.map((item) => {
            const quote = quoteByItem.get(item.id);
            return (
              <div key={item.id} className="rounded-md border border-brand-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold text-brand-text">{item.name_snapshot}</p><p className="text-xs text-muted-foreground">الكمية: {item.quantity}</p></div>
                  <span className="text-sm font-bold text-brand-text">{Number(quote?.total_price ?? item.total_price ?? 0).toLocaleString("ar-EG")} ج.م</span>
                </div>
                {isPending ? (
                  <form action={updateAssignedQuoteAction.bind(null, dispatch.id, item.id)} className="mt-3 flex gap-2">
                    <input type="hidden" name="expected_version" value={assignment.version} />
                    <input name="total_price" type="number" min="0.01" step="0.01" required defaultValue={Number(quote?.total_price ?? item.total_price ?? 0)} className="min-w-0 flex-1 rounded-md border border-brand-border px-3 py-2" aria-label={`السعر الإجمالي لـ ${item.name_snapshot}`} />
                    <Button type="submit" size="sm" variant="outline">حفظ السعر</Button>
                  </form>
                ) : null}

                {canManageReplacements ? (
                  <div className="mt-3 border-t border-brand-border pt-3">
                    {item.replacement_decision_status !== "none" ? (
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>حالة البديل: {item.replacement_decision_status}</span>
                        <form action={resetAssignedReplacementAction.bind(null, dispatch.id, item.id)}><Button type="submit" size="sm" variant="ghost">إعادة ضبط</Button></form>
                      </div>
                    ) : (
                      <form action={updateAssignedReplacementAction.bind(null, dispatch.id, item.id)} className="flex gap-2">
                        <select name="replacement_product_id" required className="min-w-0 flex-1 rounded-md border border-brand-border bg-white px-3 py-2">
                          <option value="">اختر البديل من الكتالوج المركزي</option>
                          {replacementProducts.filter((product) => product.id !== item.product_id).map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} · {Number(product.current_price || 0).toLocaleString("ar-EG")} ج.م
                            </option>
                          ))}
                        </select>
                        <Button type="submit" size="sm" variant="outline">اقتراح بديل</Button>
                      </form>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex justify-between border-t border-brand-border pt-3 font-bold text-brand-text"><span>الإجمالي الحالي</span><span>{Number(dispatch.order.total || 0).toLocaleString("ar-EG")} ج.م</span></div>
      </Card>

      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-bold text-brand-text">قبول الطلب</h2>
            <p className="mt-1 text-sm text-muted-foreground">يطبق عرض السعر ويثبت الإجمالي فوراً للعميل.</p>
            <form action={acceptAssignedOrderAction.bind(null, dispatch.id)} className="mt-3"><input type="hidden" name="expected_version" value={assignment.version} /><Button type="submit" className="w-full">قبول وتأكيد السعر</Button></form>
          </Card>
          <Card className="border-red-200 p-5">
            <h2 className="font-bold text-red-900">رفض الإسناد</h2>
            <form action={rejectAssignedOrderAction.bind(null, dispatch.id)} className="mt-3 space-y-3"><input type="hidden" name="expected_version" value={assignment.version} /><textarea name="reason" required minLength={3} maxLength={500} className="w-full rounded-md border border-red-300 px-3 py-2" placeholder="سبب الرفض المطلوب للعمليات" /><Button type="submit" variant="destructive" className="w-full">رفض وإعادة الطلب للعمليات</Button></form>
          </Card>
        </div>
      ) : null}

      {isAccepted ? (
        <Card className="p-5">
          <h2 className="font-bold text-brand-text">تقدم التنفيذ</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {dispatch.order.status === "confirmed" ? <form action={updateAssignedOrderStatusAction.bind(null, dispatch.id, "out_for_delivery")}><Button type="submit">خرج للتوصيل</Button></form> : null}
            {dispatch.order.status === "out_for_delivery" ? <form action={updateAssignedOrderStatusAction.bind(null, dispatch.id, "completed")}><Button type="submit">تم التوصيل</Button></form> : null}
            {dispatch.order.status === "completed" ? <span className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800">تم إكمال الطلب</span> : null}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">الإلغاء غير متاح للمتجر؛ تواصل مع عمليات المنطقة للتصعيد.</p>
        </Card>
      ) : null}
    </div>
  );
}
