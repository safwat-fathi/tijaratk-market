"use client";


import { useMemo, useState } from "react";
import { Order } from "@/types/models/order";
import { OrderStatus } from "@/types/enums";
import OrderStats from "./OrderStats";
import StatusTabs from "./StatusTabs";
import OrderCard from "./OrderCard";
import { EmptyState } from "@/components/ui/EmptyState";

interface OrdersViewProps {
  initialOrders: Order[];
  selectedDate?: string;
  tenantId?: number | null;
}

export default function OrdersView({ initialOrders, selectedDate }: OrdersViewProps) {
  const [activeStatus, setActiveStatus] = useState<OrderStatus>(OrderStatus.DRAFT);


  // ⚡ Bolt: Removed redundant `orders` state and `useEffect` to prevent double re-renders.
  // Memoize filtered orders and counts directly from props (initialOrders)
  const { filteredOrders, statusCounts } = useMemo(() => {
    const counts: Record<string, number> = {
      [OrderStatus.DRAFT]: 0,
      [OrderStatus.CONFIRMED]: 0,
      [OrderStatus.OUT_FOR_DELIVERY]: 0,
      [OrderStatus.COMPLETED]: 0,
      [OrderStatus.CANCELLED]: 0,
      [OrderStatus.REJECTED_BY_CUSTOMER]: 0,
    };

    const filtered: Order[] = [];

    initialOrders.forEach((order) => {
      // Count every order
      if (counts[order.status] !== undefined) {
        counts[order.status]++;
      } else {
        counts[order.status] = (counts[order.status] || 0) + 1;
      }

      // Filter for current view
      if (order.status === activeStatus) {
        filtered.push(order);
      }
    });

    return { filteredOrders: filtered, statusCounts: counts };
  }, [initialOrders, activeStatus]);

  // Total for the current view (based on initialOrders)
  const totalCount = initialOrders.length;

  const renderEmptyState = () => {
    switch (activeStatus) {
      case OrderStatus.DRAFT:
        return (
          <EmptyState title="لا توجد طلبات جديدة." description="ستظهر الطلبات هنا تلقائياً." />
        );
      case OrderStatus.COMPLETED:
        return (
          <EmptyState title="لا توجد طلبات مكتملة." description="ستظهر الطلبات المكتملة هنا." />
        );
      default:
        return (
          <EmptyState title="لا توجد طلبات في هذه الحالة." />
        );
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* 1. Sticky Header */}
      <OrderStats count={totalCount} selectedDate={selectedDate} />

      {/* 2. Status Tabs */}
      <div className="sticky top-[57px] z-10 bg-white shadow-soft mb-3">
        <StatusTabs 
          currentStatus={activeStatus} 
          counts={statusCounts} 
          onTabChange={setActiveStatus} 
        />
      </div>

      {/* 3. Orders List */}
      <div className="min-h-[calc(100vh-120px)] bg-background">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => (
            <OrderCard 
              key={order.id} 
              order={order} 
            />
          ))
        ) : (
          renderEmptyState()
        )}
      </div>
    </div>
  );
}
