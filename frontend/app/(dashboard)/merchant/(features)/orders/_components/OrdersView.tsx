"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Order } from "@/types/models/order";
import { OrderStatus } from "@/types/enums";
import type { MerchantOrderInboxSummary } from "@/types/services/orders";
import OrderStats from "./OrderStats";
import StatusTabs, { type OrdersTab } from "./StatusTabs";
import OrderCard from "./OrderCard";
import { EmptyState } from "@/components/ui/EmptyState";

interface OrdersViewProps {
  initialOrders: Order[];
  inboxSummary: MerchantOrderInboxSummary;
  initialTab: OrdersTab;
  selectedDate?: string;
}

export default function OrdersView({
  initialOrders,
  inboxSummary,
  initialTab,
  selectedDate,
}: OrdersViewProps) {
  const router = useRouter();
  const [activeStatus, setActiveStatus] = useState<OrdersTab>(initialTab);
  const filteredOrders = useMemo(
    () => initialOrders.filter((order) => order.status === activeStatus),
    [initialOrders, activeStatus],
  );
  const statusCounts = inboxSummary.owned_status_counts;
  const visibleCount = Object.values(statusCounts).reduce(
    (sum, count) => sum + count,
    0,
  );

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
      />

      {/* 2. Status Tabs */}
      <div className="sticky top-[57px] z-10 bg-white shadow-soft mb-3">
        <StatusTabs
          currentStatus={activeStatus}
          counts={statusCounts}
          onTabChange={handleTabChange}
        />
      </div>

      {/* 3. Orders List */}
      <div className="min-h-[calc(100vh-120px)] bg-background">
        {filteredOrders.length > 0 ? (
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
