import type { ActivityLog } from "@/types/models/activity-log";
import { ActivityTimelineItem } from "./ActivityTimelineItem";

type ActivityTimelineProps = {
  items: ActivityLog[];
  emptyMessage?: string;
};

export function ActivityTimeline({
  items,
  emptyMessage = "لا يوجد نشاط مسجل حتى الآن",
}: ActivityTimelineProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-brand-border bg-white p-4 text-sm text-muted-foreground shadow-soft">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ActivityTimelineItem key={item.id} item={item} />
      ))}
    </div>
  );
}
