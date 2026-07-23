"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Order } from "@/types/models/order";
import { OrderStatus } from "@/types/enums";
import type { ZoneOrderDispatch } from "@/types/models/zone-storefront";
import type { MerchantOrderInboxSummary } from "@/types/services/orders";
import OrderStats from "./OrderStats";
import StatusTabs, { type OrdersTab } from "./StatusTabs";
import OrderCard from "./OrderCard";
import AssignedOrderCard from "./AssignedOrderCard";
import { EmptyState } from "@/components/ui/EmptyState";

interface OrdersViewProps {
  initialOrders: Order[];
  initialAssignedOrders: ZoneOrderDispatch[];
  inboxSummary: MerchantOrderInboxSummary;
  initialTab: OrdersTab;
  selectedDate?: string;
  zoneStorefrontsEnabled: boolean;
}

export default function OrdersView({
  initialOrders,
  initialAssignedOrders,
  inboxSummary,
  initialTab,
  selectedDate,
  zoneStorefrontsEnabled,
}: OrdersViewProps) {
  const router = useRouter();
  const [activeStatus, setActiveStatus] = useState<OrdersTab>(initialTab);
  const filteredOrders = useMemo(
    () =>
      activeStatus === "assigned"
        ? []
        : initialOrders.filter((order) => order.status === activeStatus),
    [initialOrders, activeStatus],
  );
  const statusCounts: Record<OrdersTab, number> = {
    ...inboxSummary.owned_status_counts,
    assigned: inboxSummary.assigned_counts.total,
  };
  const ownedOrdersCount = Object.values(
    inboxSummary.owned_status_counts,
  ).reduce((sum, count) => sum + count, 0);
  const visibleCount =
    activeStatus === "assigned"
      ? inboxSummary.assigned_counts.total
      : ownedOrdersCount;

  const handleTabChange = (status: OrdersTab) => {
    setActiveStatus(status);
    const query = new URLSearchParams();
    if (selectedDate) query.set("date", selectedDate);
    if (status !== OrderStatus.DRAFT) query.set("tab", status);
    const queryString = query.toString();
    router.replace(`/merchant/orders${queryString ? `?${queryString}` : ""}`, {
      scroll: false,
    });
  };

  const renderEmptyState = () => {
    switch (activeStatus) {
      case OrderStatus.DRAFT:
        return (
          <EmptyState
            title="لا توجد طلبات جديدة."
            description="ستظهر الطلبات هنا تلقائياً."
          />
        );
      case OrderStatus.COMPLETED:
        return (
          <EmptyState
            title="لا توجد طلبات مكتملة."
            description="ستظهر الطلبات المكتملة هنا."
          />
        );
      case "assigned":
        return (
          <EmptyState
            title="لا توجد طلبات مسندة حالياً."
            description="ستظهر هنا الطلبات التي تسندها عمليات المنطقة لمتجرك."
          />
        );
      default:
        return <EmptyState title="لا توجد طلبات في هذه الحالة." />;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* 1. Sticky Header */}
      <OrderStats
        count={visibleCount}
        selectedDate={selectedDate}
        selectedTab={activeStatus}
        dateFilterEnabled={activeStatus !== "assigned"}
      />

      {/* 2. Status Tabs */}
      <div className="sticky top-[57px] z-10 bg-white shadow-soft mb-3">
        <StatusTabs
          currentStatus={activeStatus}
          counts={statusCounts}
          onTabChange={handleTabChange}
          zoneStorefrontsEnabled={zoneStorefrontsEnabled}
        />
      </div>

      {/* 3. Orders List */}
      <div className="min-h-[calc(100vh-120px)] bg-background">
        {activeStatus === "assigned" && initialAssignedOrders.length > 0 ? (
          initialAssignedOrders.map((dispatch) => (
            <AssignedOrderCard key={dispatch.id} dispatch={dispatch} />
          ))
        ) : filteredOrders.length > 0 ? (
          filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))
        ) : (
          renderEmptyState()
        )}
      </div>
    </div>
  );
}
