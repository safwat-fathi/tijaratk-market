import Link from "next/link";
import type { Metadata } from "next";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { Card } from "@/components/ui/Card";
import { activityLogsService } from "@/services/api/activity-logs.service";
import type { ActivityEntityType } from "@/types/models/activity-log";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "سجل النشاط",
  description: "متابعة آخر تغييرات الطلبات والمنتجات داخل المتجر.",
  robots: {
    index: false,
    follow: false,
  },
};

const filters: Array<{ label: string; entityType?: ActivityEntityType }> = [
  { label: "كل الأنشطة" },
  { label: "الطلبات", entityType: "order" },
  { label: "المنتجات", entityType: "product" },
];

const normalizeEntityType = (
  value: string | string[] | undefined,
): ActivityEntityType | undefined => {
  const entityType = Array.isArray(value) ? value[0] : value;
  return entityType === "order" || entityType === "product"
    ? entityType
    : undefined;
};

const normalizeCursor = (value: string | string[] | undefined) => {
  const rawCursor = Array.isArray(value) ? value[0] : value;
  const cursor = Number(rawCursor);
  return Number.isInteger(cursor) && cursor > 0 ? cursor : undefined;
};

const buildActivityHref = (input: {
  entityType?: ActivityEntityType;
  cursor?: number;
}) => {
  const params = new URLSearchParams();
  if (input.entityType) {
    params.set("entity_type", input.entityType);
  }
  if (input.cursor) {
    params.set("cursor", String(input.cursor));
  }

  const query = params.toString();
  return query ? `/merchant/activity?${query}` : "/merchant/activity";
};

export default async function MerchantActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    entity_type?: string | string[];
    cursor?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const entityType = normalizeEntityType(query.entity_type);
  const cursor = normalizeCursor(query.cursor);

  const logsResponse = await activityLogsService.getActivityLogs({
    entity_type: entityType,
    cursor,
    limit: 20,
  });

  const logs = logsResponse.success && logsResponse.data
    ? logsResponse.data
    : { items: [], next_cursor: null };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div>
        <p className="text-sm font-medium text-brand-primary">سجل النشاط</p>
        <h1 className="mt-1 text-2xl font-bold text-brand-text">
          آخر تغييرات المتجر
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          تابع التغييرات التي تمت على الطلبات والمنتجات من مكان واحد.
        </p>
      </div>

      <Card className="flex flex-wrap gap-2 p-3">
        {filters.map((filter) => {
          const isActive = filter.entityType === entityType;
          const isAllActive = !filter.entityType && !entityType;

          return (
            <Link
              key={filter.label}
              href={buildActivityHref({ entityType: filter.entityType })}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive || isAllActive
                  ? "bg-brand-primary text-white"
                  : "bg-brand-soft text-brand-text hover:bg-brand-soft/70"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </Card>

      {!logsResponse.success ? (
        <div className="rounded-lg border border-status-error/20 bg-status-error/10 p-4 text-sm text-status-error">
          {logsResponse.message || "تعذر تحميل سجل النشاط"}
        </div>
      ) : null}

      <ActivityTimeline items={logs.items} />

      {logs.next_cursor ? (
        <div className="flex justify-center">
          <Link
            href={buildActivityHref({
              entityType,
              cursor: logs.next_cursor,
            })}
            className="rounded-md border border-brand-border bg-white px-4 py-2 text-sm font-semibold text-brand-text shadow-soft transition hover:bg-brand-soft"
          >
            عرض المزيد
          </Link>
        </div>
      ) : null}
    </div>
  );
}
