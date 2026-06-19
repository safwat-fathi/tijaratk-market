import Link from "next/link";
import type { ReactNode } from "react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatArabicInteger, formatArabicNumber } from "@/lib/utils/number";
import {
  DashboardPeriod,
  MerchantDashboardMeasurements,
  OrdersBySourceMetric,
} from "@/types/services/merchant-dashboard";

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: "اليوم",
  "7d": "آخر ٧ أيام",
  "30d": "آخر ٣٠ يوم",
};

const SOURCE_LABELS: Record<OrdersBySourceMetric["source"], string> = {
  qr_code: "QR Code",
  stores_directory: "دليل المتاجر",
  whatsapp: "واتساب",
  manual: "يدوي",
  storefront: "رابط المتجر",
};

function formatInteger(value: number) {
  return formatArabicInteger(value) || String(value);
}

function formatPercent(value: number) {
  const formatted = formatArabicNumber(value, {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  });

  return `${formatted || value}%`;
}

function formatDelta(value: number | null) {
  if (value === null) {
    return "لا توجد فترة سابقة";
  }

  if (value === 0) {
    return "بدون تغيير";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${formatPercent(value)} مقابل الفترة السابقة`;
}

function MetricCard({
  title,
  value,
  helper,
  tone = "neutral",
  href,
}: {
  title: string;
  value: string;
  helper?: string;
  tone?: "neutral" | "good" | "warning" | "sales";
  href?: string;
}) {
  const toneClass = {
    neutral: "border-gray-200 bg-white",
    good: "border-emerald-200 bg-emerald-50",
    warning: "border-rose-200 bg-rose-50",
    sales: "border-primary/20 bg-primary/5",
  }[tone];

  const content = (
    <div className={`rounded-lg border p-4 shadow-sm ${toneClass}`}>
      <p className="text-sm font-semibold text-gray-600">{title}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-gray-950">
        {value}
      </p>
      {helper ? (
        <p className="mt-1 text-xs font-medium text-gray-500">{helper}</p>
      ) : null}
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block transition hover:-translate-y-0.5">
      {content}
    </Link>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold tracking-tight text-gray-950">
        {title}
      </h2>
      {children}
    </section>
  );
}

function PeriodFilter({ activePeriod }: { activePeriod: DashboardPeriod }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(PERIOD_LABELS) as DashboardPeriod[]).map((period) => {
        const isActive = period === activePeriod;
        return (
          <Link
            key={period}
            href={
              period === "today" ? "/merchant" : `/merchant?period=${period}`
            }
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-gray-200 bg-white text-gray-700 hover:border-primary/40"
            }`}
          >
            {PERIOD_LABELS[period]}
          </Link>
        );
      })}
    </div>
  );
}

function TopSellingProducts({
  products,
}: {
  products: MerchantDashboardMeasurements["top_selling_products"];
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-950">أكثر المنتجات مبيعًا</h3>
      {products.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-gray-200 px-3 py-2 text-sm text-gray-500">
          لا توجد مبيعات مكتملة في الفترة المحددة.
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {products.map((product, index) => (
            <li
              key={product.name}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700">
                  {formatInteger(index + 1)}
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {product.name}
                </span>
              </div>
              <span className="text-sm font-bold text-gray-700">
                {formatInteger(product.orders_count)} طلب
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function OrdersBySource({
  sources,
}: {
  sources: MerchantDashboardMeasurements["orders_by_source"];
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-950">الطلبات حسب المصدر</h3>
      {sources.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-gray-200 px-3 py-2 text-sm text-gray-500">
          لا توجد طلبات في الفترة المحددة.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {sources.map((source) => (
            <div key={source.source} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-gray-800">
                  {SOURCE_LABELS[source.source] || source.label}
                </span>
                <span className="font-bold text-gray-700">
                  {formatPercent(source.percentage)} ·{" "}
                  {formatInteger(source.orders_count)} طلب
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${Math.min(100, Math.max(0, source.percentage))}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MeasurementsDashboard({
  measurements,
}: {
  measurements: MerchantDashboardMeasurements;
}) {
  const completed = measurements.completed_orders_rate;
  const cancelled = measurements.cancelled_orders_rate;
  const returning = measurements.returning_customers_rate;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950">
            لوحة القياسات
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            أهم ١٠ مؤشرات مرتبطة بقرارات البيع والتشغيل.
          </p>
        </div>
        <PeriodFilter activePeriod={measurements.period} />
      </div>

      <Section title="المبيعات والطلبات">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            title="إجمالي المبيعات"
            value={formatCurrency(measurements.total_sales.value) || "0"}
            helper={formatDelta(measurements.total_sales.change_percentage)}
            tone="sales"
          />
          <MetricCard
            title="إجمالي الطلبات"
            value={formatInteger(measurements.total_orders.value)}
            helper={formatDelta(measurements.total_orders.change_percentage)}
          />
          <MetricCard
            title="معدل الطلبات المكتملة"
            value={formatPercent(completed.percentage)}
            helper={`${formatInteger(completed.completed_orders || 0)} / ${formatInteger(completed.total_orders)} طلب`}
            tone="good"
          />
          <MetricCard
            title="معدل الإلغاء"
            value={formatPercent(cancelled.percentage)}
            helper={`${formatInteger(cancelled.cancelled_orders || 0)} طلب ملغي`}
            tone="warning"
            href="/merchant/orders"
          />
          <MetricCard
            title="متوسط قيمة الطلب"
            value={formatCurrency(measurements.average_order_value) || "0"}
            helper="من الطلبات المكتملة فقط"
          />
        </div>
        <TopSellingProducts products={measurements.top_selling_products} />
      </Section>

      <Section title="العملاء">
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricCard
            title="عملاء جدد"
            value={formatInteger(measurements.new_customers)}
            helper={PERIOD_LABELS[measurements.period]}
          />
          <MetricCard
            title="معدل العملاء العائدين"
            value={formatPercent(returning.percentage)}
            helper={`${formatInteger(returning.returning_customers)} / ${formatInteger(returning.active_customers)} عميل نشط`}
            tone="good"
          />
        </div>
      </Section>

      <Section title="توفر المنتجات">
        <MetricCard
          title="طلبات توفير المنتجات"
          value={formatInteger(measurements.availability_requests)}
          helper="منتجات طلبها العملاء ولم تكن متاحة"
          href="/merchant/availability-requests"
          tone="warning"
        />
      </Section>

      <Section title="مصادر النمو">
        <OrdersBySource sources={measurements.orders_by_source} />
      </Section>
    </div>
  );
}
