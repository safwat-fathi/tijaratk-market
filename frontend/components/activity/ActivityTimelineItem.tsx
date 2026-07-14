import type { ActivityLog, ActivitySource } from "@/types/models/activity-log";
import { Card } from "@/components/ui/Card";

const sourceLabels: Record<ActivitySource, string> = {
  dashboard: "لوحة التحكم",
  storefront: "واجهة العميل",
  admin: "الإدارة",
  system: "النظام",
  whatsapp: "واتساب",
  csv_import: "استيراد ملف",
};

const adminRoleLabels = {
  platform_admin: "مسؤول المنصة",
  operations_admin: "مسؤول العمليات",
} as const;

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

type ActivityTimelineItemProps = {
  item: ActivityLog;
};

export function ActivityTimelineItem({ item }: ActivityTimelineItemProps) {
  const sourceLabel = sourceLabels[item.source] || item.source;
  const actorRole =
    item.actor.type === "admin" ? adminRoleLabels[item.actor.role] : null;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-brand-text">{item.title}</h3>
          {item.description ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {item.description}
            </p>
          ) : null}
        </div>
        <span className="rounded-full bg-brand-soft px-2 py-1 text-xs font-medium text-brand-primary">
          {sourceLabel}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>
          بواسطة {item.actor.name}
          {actorRole ? ` · ${actorRole}` : ""}
        </span>
        <span aria-hidden="true">·</span>
        <time dateTime={item.created_at}>{formatDateTime(item.created_at)}</time>
      </div>
    </Card>
  );
}
