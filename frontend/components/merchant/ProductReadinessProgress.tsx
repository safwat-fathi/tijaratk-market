import Link from "next/link";
import { CheckCircle2, PackagePlus, ShieldAlert, Trophy } from "lucide-react";
import { formatArabicInteger, formatArabicNumber } from "@/lib/utils/number";
import type {
  ProductReadinessMetric,
  ProductReadinessStatus,
} from "@/types/services/merchant-dashboard";

type ProductReadinessProgressProps = {
  readiness: ProductReadinessMetric;
  variant?: "banner" | "compact";
  showCta?: boolean;
};

function formatInteger(value: number) {
  return formatArabicInteger(value) || String(value);
}

function formatScore(value: number) {
  const formatted = formatArabicNumber(value, {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  });

  return formatted || String(value);
}

function resolveReadinessStatus(
  activeProductsCount: number,
  requiredProductsCount: number,
): ProductReadinessStatus {
  if (activeProductsCount >= requiredProductsCount) {
    return "ready_for_orders";
  }

  if (activeProductsCount > 0) {
    return "add_products";
  }

  return "not_ready_for_orders";
}

function resolveStatusLabel(status: ProductReadinessStatus) {
  if (status === "ready_for_orders") {
    return "جاهز لاستقبال الطلبات";
  }

  if (status === "add_products") {
    return "أضف منتجات";
  }

  return "غير جاهز للطلبات";
}

function resolveStatusStyles(status: ProductReadinessStatus) {
  if (status === "ready_for_orders") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "add_products") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  return "border-rose-200 bg-rose-50 text-rose-800";
}

export function ProductReadinessBadge({
  status,
}: {
  status: ProductReadinessStatus;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${resolveStatusStyles(status)}`}
    >
      {resolveStatusLabel(status)}
    </span>
  );
}

export function buildProductReadinessFromCount(
  activeProductsCount: number,
  storeType?: string,
): ProductReadinessMetric {
  const requiresFullCatalog =
    storeType === "grocery" || storeType === "pharmacy";
  const requiredProductsCount = requiresFullCatalog ? 100 : 50;
  const milestones = requiresFullCatalog ? [25, 50, 75, 100] : [10, 25, 50];
  const safeActiveProductsCount = Math.max(0, Math.floor(activeProductsCount));
  const remainingProductsCount = Math.max(
    0,
    requiredProductsCount - safeActiveProductsCount,
  );
  const completionPercentage = Math.min(
    100,
    Math.round((safeActiveProductsCount / requiredProductsCount) * 1000) / 10,
  );

  return {
    active_products_count: safeActiveProductsCount,
    required_products_count: requiredProductsCount,
    remaining_products_count: remainingProductsCount,
    completion_percentage: completionPercentage,
    status: resolveReadinessStatus(
      safeActiveProductsCount,
      requiredProductsCount,
    ),
    milestones,
  };
}

export default function ProductReadinessProgress({
  readiness,
  variant = "banner",
  showCta = true,
}: ProductReadinessProgressProps) {
  const isReady = readiness.status === "ready_for_orders";
  const progressWidth = `${Math.min(
    100,
    Math.max(0, readiness.completion_percentage),
  )}%`;
  const Icon = isReady ? CheckCircle2 : ShieldAlert;

  if (variant === "compact") {
    const compactTone = isReady
      ? "bg-emerald-50 text-emerald-950"
      : "bg-amber-50 text-amber-950";

    return (
      <div className={`rounded-md px-3 py-2.5 ${compactTone}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold">مؤشر إكتمال المنتجات</p>
            <p className="mt-0.5 text-xs font-medium opacity-80">
              {isReady
                ? "متجرك جاهز لاستقبال الطلبات"
                : `متبقي ${formatInteger(readiness.remaining_products_count)} منتج للوصول إلى ${formatInteger(readiness.required_products_count)}`}
            </p>
          </div>
          <ProductReadinessBadge status={readiness.status} />
        </div>
        <ProgressBar value={progressWidth} ready={isReady} />
      </div>
    );
  }

  return (
    <section
      className={`overflow-hidden rounded-lg border p-4 shadow-sm ${
        isReady
          ? "border-emerald-200 bg-emerald-50 text-emerald-950"
          : "border-amber-200 bg-amber-50 text-amber-950"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              isReady
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold tracking-tight">
                {isReady
                  ? "متجرك جاهز لاستقبال الطلبات"
                  : "متجرك لن يستقبل طلبات حتى تكمل المنتجات"}
              </h2>
              <ProductReadinessBadge status={readiness.status} />
            </div>
            <p className="mt-1 text-sm font-medium leading-6 opacity-90">
              {isReady
                ? `لديك ${formatInteger(readiness.active_products_count)} منتج نشط. حافظ على تحديث الأسعار والتوفر.`
                : `أضف ${formatInteger(readiness.remaining_products_count)} منتج آخر ليصل متجرك إلى ${formatInteger(readiness.required_products_count)} منتج نشط ويبدأ استقبال الطلبات.`}
            </p>
          </div>
        </div>

        {showCta ? (
          <Link
            href="/merchant/products/new"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gray-950 px-4 text-sm font-bold text-white transition hover:bg-gray-800 sm:w-auto"
          >
            <PackagePlus className="h-4 w-4" aria-hidden="true" />
            إضافة منتجات
          </Link>
        ) : null}
      </div>

      <div className="mt-4 rounded-lg border border-white/70 bg-white/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">مؤشر إكتمال المنتجات</p>
            <p className="mt-0.5 text-xs font-medium text-gray-600">
              {formatInteger(readiness.active_products_count)} /{" "}
              {formatInteger(readiness.required_products_count)} منتج نشط
            </p>
          </div>
          <span className="text-2xl font-black tracking-tight">
            {formatScore(readiness.completion_percentage)}%
          </span>
        </div>

        <ProgressBar value={progressWidth} ready={isReady} />
        <Milestones readiness={readiness} />
      </div>
    </section>
  );
}

function ProgressBar({ value, ready }: { value: string; ready: boolean }) {
  return (
    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-black/5">
      <div
        className={`h-full rounded-full transition-all ${
          ready ? "bg-emerald-500" : "bg-amber-500"
        }`}
        style={{ width: value }}
      />
    </div>
  );
}

function Milestones({ readiness }: { readiness: ProductReadinessMetric }) {
  return (
    <div className="mt-3 flex w-full gap-2">
      {readiness.milestones.map((milestone) => {
        const achieved = readiness.active_products_count >= milestone;
        return (
          <div
            key={milestone}
            className={`flex flex-1 min-w-0 items-center justify-center gap-1 rounded-md border px-1.5 py-1.5 text-[11px] font-bold ${
              achieved
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-gray-200 bg-white text-gray-500"
            }`}
          >
            {achieved ? (
              <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : null}
            <span>{formatInteger(milestone)}</span>
          </div>
        );
      })}
    </div>
  );
}
