import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { ZoneOrderDispatch } from "@/types/models/zone-storefront";

const assignmentStatusLabels: Record<string, string> = {
  pending: "يحتاج ردك",
  accepted: "مقبول للتنفيذ",
};

const fulfillmentStatusLabels: Record<string, string> = {
  confirmed: "قيد التجهيز",
  out_for_delivery: "خرج للتوصيل",
  completed: "تم التوصيل",
};

type AssignedOrderCardProps = {
  dispatch: ZoneOrderDispatch;
};

export default function AssignedOrderCard({ dispatch }: AssignedOrderCardProps) {
  const assignment = dispatch.assignments.find((item) => item.is_current);
  const statusLabel = assignment
    ? assignment.status === "accepted"
      ? fulfillmentStatusLabels[dispatch.order.status] ||
        assignmentStatusLabels[assignment.status]
      : assignmentStatusLabels[assignment.status]
    : dispatch.status;

  return (
    <Card className="mb-3 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-brand-text">
              طلب #{dispatch.order.id} · {dispatch.zone_storefront?.name}
            </p>
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-primary">
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {dispatch.order.delivery_address || "العنوان غير مسجل"}
          </p>
        </div>
        <Link
          href={`/merchant/assigned-orders/${dispatch.id}`}
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand-primary px-4 text-sm font-semibold text-white hover:bg-brand-primary-hover"
        >
          فتح الطلب
        </Link>
      </div>
    </Card>
  );
}
