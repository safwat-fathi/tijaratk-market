import { getCookieAction } from "@/app/actions/cookie-store";
import { STORAGE_KEYS } from "@/constants";
import { tenantsService } from "@/services/api/tenants.service";
import { ordersService } from "@/services/api/orders.service";
import { merchantDashboardService } from "@/services/api/merchant-dashboard.service";
import { DashboardPeriod } from "@/types/services/merchant-dashboard";
import EndOfDayTeaser from "./_components/EndOfDayTeaser";
import StorefrontLinkCard from "./_components/StorefrontLinkCard";
import DeliverySettingsCard from "./_components/DeliverySettingsCard";
import MeasurementsDashboard from "./_components/MeasurementsDashboard";
import { createNoIndexMetadata } from "@/lib/marketing-seo";
import type { CancellationPolicyMetric } from "@/types/services/merchant-dashboard";

export const metadata = createNoIndexMetadata(
  "لوحة التحكم",
  "نظرة عامة على نشاط متجرك، الطلبات اليومية، وحالة المبيعات.",
);

export const dynamic = "force-dynamic";

const PERIODS = new Set<DashboardPeriod>(["today", "7d", "30d"]);

function normalizePeriod(value?: string | string[]): DashboardPeriod {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue && PERIODS.has(rawValue as DashboardPeriod)
    ? (rawValue as DashboardPeriod)
    : "today";
}

function CancellationPolicyBanner({
  policy,
}: {
  policy?: CancellationPolicyMetric;
}) {
  if (!policy || policy.status === "ok") {
    return null;
  }

  if (policy.status === "suspended") {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-sm">
        تم إيقاف المتجر مؤقتًا بسبب كثرة إلغاء الطلبات. لن يستطيع العملاء إرسال
        طلبات جديدة حتى يعيد المسؤول تفعيل الحساب.
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 shadow-sm">
      وصلت إلى {policy.count} طلبات ملغاة هذا الشهر. إلغاء{" "}
      {policy.remaining_before_suspension} طلبات أخرى قد يؤدي إلى إيقاف الحساب
      مؤقتًا.
    </section>
  );
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string | string[] }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const period = normalizePeriod(resolvedSearchParams.period);
  const userCookie = await getCookieAction(STORAGE_KEYS.USER);
  const user = userCookie ? JSON.parse(userCookie) : null;
  const name = user?.name || "تاجر";

  const [measurementsResponse, tenantResponse, dayCloseStatusResponse] =
    await Promise.all([
      merchantDashboardService.getMeasurements(period),
      tenantsService.getMyTenant(),
      ordersService.getTodayDayCloseStatus(),
    ]);

  const tenantSlug =
    tenantResponse.success && tenantResponse.data
      ? tenantResponse.data.slug
      : undefined;
  const tenant = tenantResponse.success ? tenantResponse.data : undefined;

  const dayCloseStatus =
    dayCloseStatusResponse.success && dayCloseStatusResponse.data
      ? dayCloseStatusResponse.data
      : null;

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {new Date().getHours() < 12 ? "صباح الخير" : "مساء الخير"} {name}
        </h1>
      </div>
      <StorefrontLinkCard
        slug={tenantSlug}
        status={tenant?.status}
        deliveryAvailable={tenant?.delivery_available}
      />

      {measurementsResponse.success && measurementsResponse.data ? (
        <>
          <CancellationPolicyBanner
            policy={measurementsResponse.data.cancellation_policy}
          />
          <MeasurementsDashboard measurements={measurementsResponse.data} />
        </>
      ) : (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          تعذر تحميل قياسات لوحة التحكم.
        </section>
      )}

      <DeliverySettingsCard tenant={tenant} />
      {dayCloseStatus ? (
        <EndOfDayTeaser initialStatus={dayCloseStatus} />
      ) : null}
    </div>
  );
}
