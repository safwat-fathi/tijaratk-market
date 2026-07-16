import Link from "next/link";
import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils/currency";
import type { TenantDeliverySettings } from "@/types/models/tenant";

type DeliverySettingsCardProps = {
  tenant?: TenantDeliverySettings;
};

export default function DeliverySettingsCard({
  tenant,
}: DeliverySettingsCardProps) {
  const deliveryAreas =
    tenant?.tenant_delivery_areas?.filter(
      (area) =>
        area.is_active !== false && area.area?.is_active !== false,
    ) || [];
  const deliveryAvailable =
    tenant?.delivery_available !== false && deliveryAreas.length > 0;
  const fees = deliveryAreas.map((area) => Number(area.delivery_fee));
  const feeRange =
    fees.length === 0
      ? "غير محدد"
      : Math.min(...fees) === Math.max(...fees)
        ? formatCurrency(Math.min(...fees))
        : `${formatCurrency(Math.min(...fees))} - ${formatCurrency(Math.max(...fees))}`;

  let deliveryTimeWindow = "طوال اليوم";
  if (tenant?.delivery_starts_at && tenant?.delivery_ends_at) {
    deliveryTimeWindow = `${tenant.delivery_starts_at} - ${tenant.delivery_ends_at}`;
  }

  return (
    <Card className="relative overflow-hidden bg-white p-0">
      <div className="pointer-events-none absolute -top-10 end-0 h-28 w-28 rounded-full bg-brand-primary/10 blur-2xl" />
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-brand-primary">التوصيل</p>
            <h2 className="mt-1 text-xl font-bold text-brand-text">
              مناطق ورسوم التوصيل
            </h2>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
              deliveryAvailable
                ? "bg-status-success/10 text-status-success"
                : "bg-status-error/10 text-status-error"
            }`}
          >
            {deliveryAvailable ? "متاح" : "متوقف"}
          </span>
        </div>

        <div className="rounded-lg border border-brand-border bg-brand-soft/40 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-brand-text">
            <MapPin className="h-5 w-5 text-brand-primary" aria-hidden="true" />
            {deliveryAreas.length} منطقة نشطة
          </p>
          <p className="mt-3 text-2xl font-black tabular-nums text-brand-text">
            {feeRange}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            مواعيد التوصيل: {deliveryTimeWindow}
          </p>
        </div>

        <Link
          href="/merchant/settings"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-brand-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 sm:w-auto"
        >
          إدارة المناطق والرسوم
        </Link>
      </div>
    </Card>
  );
}
