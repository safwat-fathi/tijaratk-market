import { formatArabicInteger } from "@/lib/utils/number";
import { OrderStatus } from "@/types/enums";
import { ScrollableTabList, TabButton } from "@/components/ui/ScrollableTabs";

export type OrdersTab = OrderStatus | "assigned";

interface StatusTabsProps {
  currentStatus: OrdersTab;
  counts: Record<OrdersTab, number>;
  onTabChange: (status: OrdersTab) => void;
  zoneStorefrontsEnabled: boolean;
}

export default function StatusTabs({
  currentStatus,
  counts,
  onTabChange,
  zoneStorefrontsEnabled,
}: StatusTabsProps) {
  const tabs: {
    id: OrdersTab;
    label: string;
    color: string;
  }[] = [
    {
      id: OrderStatus.DRAFT,
      label: "جديد",
      color: "text-status-new bg-status-new/15",
    },
    {
      id: OrderStatus.CONFIRMED,
      label: "مؤكد",
      color: "text-status-confirmed bg-status-confirmed/15",
    },
    {
      id: OrderStatus.OUT_FOR_DELIVERY,
      label: "التوصيل",
      color: "text-amber-800 bg-status-delivery/25",
    },
    {
      id: OrderStatus.COMPLETED,
      label: "اكتمل",
      color: "text-status-completed bg-status-completed/15",
    },
    {
      id: OrderStatus.CANCELLED,
      label: "ملغي",
      color: "text-status-cancelled bg-status-cancelled/15",
    },
    {
      id: OrderStatus.REJECTED_BY_CUSTOMER,
      label: "رفض العميل",
      color: "text-status-cancelled bg-status-cancelled/15",
    },
    {
      id: "assigned",
      label: "الطلبات المسندة",
      color: "text-brand-primary bg-brand-soft",
    },
  ].filter((tab) => zoneStorefrontsEnabled || tab.id !== "assigned");

  return (
    <div className="border-b border-brand-border bg-white">
      <ScrollableTabList className="px-4 py-2">
        {tabs.map((tab) => {
          const isActive = currentStatus === tab.id;
          const count = counts[tab.id] || 0;

          return (
            <TabButton
              key={tab.id}
              variant="pill"
              isActive={isActive}
              className={isActive ? tab.color : ""}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
              <span
                className={`
                  text-xs px-1.5 py-0.5 rounded-full
                  ${isActive ? "bg-white/50" : "bg-brand-soft text-muted-foreground"}
                `}
              >
                {formatArabicInteger(count) || count}
              </span>
            </TabButton>
          );
        })}
      </ScrollableTabList>
    </div>
  );
}
