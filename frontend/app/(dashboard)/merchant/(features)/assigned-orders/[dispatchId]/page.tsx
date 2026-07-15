import Link from "next/link";
import { notFound } from "next/navigation";
import {
  acceptAssignedOrderAction,
  rejectAssignedOrderAction,
  updateAssignedOrderStatusAction,
} from "@/actions/assigned-orders";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { assignedOrdersService } from "@/services/api/assigned-orders.service";
import AssignedOrderItems from "./_components/AssignedOrderItems";

export const dynamic = "force-dynamic";

type AssignedOrderPageProps = { params: Promise<{ dispatchId: string }> };

export default async function AssignedOrderPage({
  params,
}: AssignedOrderPageProps) {
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
  const quoteByItem = new Map(
    assignment.quote_lines.map((line) => [line.order_item_id, line]),
  );
  const quoteSubtotal = (dispatch.order.order_items ?? []).reduce(
    (sum, item) =>
      item.is_out_of_stock
        ? sum
        : sum +
          Number(
            quoteByItem.get(item.id)?.total_price ?? item.total_price ?? 0,
          ),
    0,
  );
  const quotedTotal =
    Math.round(
      (quoteSubtotal +
        Number(dispatch.order.delivery_fee || 0) +
        Number.EPSILON) *
        100,
    ) / 100;
  const displayedTotal = isPending
    ? quotedTotal
    : Number(dispatch.order.total || 0);

  return (
    <div className="space-y-5 pb-12">
      <div>
        <Link
          href="/merchant/orders?tab=assigned"
          className="text-sm text-brand-primary hover:underline"
        >
          الرجوع إلى الطلبات المسندة
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-brand-text">
          طلب #{dispatch.order.id}
        </h1>
        <p className="text-sm text-muted-foreground">
          {dispatch.zone_storefront?.name} ·{" "}
          {isPending ? "بانتظار قبولك" : "مقبول للتنفيذ"}
        </p>
      </div>

      <Card className="p-5">
        <h2 className="font-bold text-brand-text">بيانات العميل للتنفيذ</h2>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <p>الاسم: {dispatch.order.customer_name || "عميل"}</p>
          <a
            href={`tel:${dispatch.order.customer_phone}`}
            className="text-brand-primary"
          >
            الهاتف: {dispatch.order.customer_phone}
          </a>
          <p className="sm:col-span-2">
            العنوان: {dispatch.order.delivery_address}
          </p>
          {dispatch.order.delivery_time_window_snapshot ? (
            <p className="sm:col-span-2">
              موعد التوصيل: {dispatch.order.delivery_time_window_snapshot}
            </p>
          ) : null}
        </div>
      </Card>

      <AssignedOrderItems
        dispatchId={dispatch.id}
        assignment={assignment}
        orderStatus={dispatch.order.status}
        initialItems={dispatch.order.order_items ?? []}
        replacementProducts={replacementProducts}
      />

      <Card className="p-4">
        <div className="flex justify-between font-bold text-brand-text">
          <span>
            {isPending ? "إجمالي عرض السعر الحالي" : "الإجمالي الحالي"}
          </span>
          <span>{displayedTotal.toLocaleString("ar-EG")} ج.م</span>
        </div>
      </Card>

      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-bold text-brand-text">قبول الطلب</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              يطبق عرض السعر ويثبت الإجمالي فوراً للعميل.
            </p>
            <form
              action={acceptAssignedOrderAction.bind(null, dispatch.id)}
              className="mt-3"
            >
              <input
                type="hidden"
                name="expected_version"
                value={assignment.version}
              />
              <Button type="submit" className="w-full">
                قبول وتأكيد السعر
              </Button>
            </form>
          </Card>
          <Card className="border-red-200 p-5">
            <h2 className="font-bold text-red-900">رفض الإسناد</h2>
            <form
              action={rejectAssignedOrderAction.bind(null, dispatch.id)}
              className="mt-3 space-y-3"
            >
              <input
                type="hidden"
                name="expected_version"
                value={assignment.version}
              />
              <textarea
                name="reason"
                required
                minLength={3}
                maxLength={500}
                className="w-full rounded-md border border-red-300 px-3 py-2"
                placeholder="سبب الرفض المطلوب للعمليات"
              />
              <Button type="submit" variant="destructive" className="w-full">
                رفض وإعادة الطلب للعمليات
              </Button>
            </form>
          </Card>
        </div>
      ) : null}

      {isAccepted ? (
        <Card className="p-5">
          <h2 className="font-bold text-brand-text">تقدم التنفيذ</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {dispatch.order.status === "confirmed" ? (
              <form
                action={updateAssignedOrderStatusAction.bind(
                  null,
                  dispatch.id,
                  "out_for_delivery",
                )}
              >
                <Button type="submit">خرج للتوصيل</Button>
              </form>
            ) : null}
            {dispatch.order.status === "out_for_delivery" ? (
              <form
                action={updateAssignedOrderStatusAction.bind(
                  null,
                  dispatch.id,
                  "completed",
                )}
              >
                <Button type="submit">تم التوصيل</Button>
              </form>
            ) : null}
            {dispatch.order.status === "completed" ? (
              <span className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800">
                تم إكمال الطلب
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            الإلغاء غير متاح للمتجر؛ تواصل مع عمليات المنطقة للتصعيد.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
