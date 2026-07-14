import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { assignedOrdersService } from "@/services/api/assigned-orders.service";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  pending: "يحتاج ردك",
  accepted: "مقبول للتنفيذ",
  awaiting_merchant: "بانتظار ردك",
};

export default async function AssignedOrdersPage() {
  const response = await assignedOrdersService.getAssignedOrders();
  const dispatches = response.data?.filter(Boolean) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text">الطلبات المسندة</h1>
        <p className="mt-1 text-sm text-muted-foreground">طلبات منفصلة عن مبيعات متجرك وتقارير الإغلاق اليومية.</p>
      </div>
      <div className="space-y-3">
        {dispatches.map((dispatch) => {
          const assignment = dispatch.assignments.find((item) => item.is_current);
          return (
            <Card key={dispatch.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-brand-text">طلب #{dispatch.order.id} · {dispatch.zone_storefront?.name}</p>
                  <p className="text-sm text-muted-foreground">{dispatch.order.delivery_address || "العنوان غير مسجل"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{assignment ? statusLabels[assignment.status] || assignment.status : statusLabels[dispatch.status]}</p>
                </div>
                <Link href={`/merchant/assigned-orders/${dispatch.id}`} className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand-primary px-4 text-sm font-semibold text-white hover:bg-brand-primary-hover">فتح الطلب</Link>
              </div>
            </Card>
          );
        })}
        {dispatches.length === 0 ? <Card className="p-8 text-center text-muted-foreground">لا توجد طلبات مسندة حالياً.</Card> : null}
      </div>
    </div>
  );
}
