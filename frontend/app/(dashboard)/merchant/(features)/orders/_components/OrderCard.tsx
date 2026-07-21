"use client";

import { OrderStatus } from "@/types/enums";
import { Order } from "@/types/models/order";
import Link from "next/link";
import { updateOrderStatus } from "@/actions/order-actions";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils/currency";
import { formatRtlQuantityLabel } from "@/lib/utils/number";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  formatPrescriptionUnavailabilityAction,
} from "@/lib/orders/prescription-unavailability";
import { formatUnavailableItemAction } from "@/lib/orders/unavailable-item-action";

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

interface OrderCardProps {
  order: Order;
  onAction?: (order: Order) => void;
  isHighlighted?: boolean;
}

export default function OrderCard({ order, isHighlighted }: OrderCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Determine primary action label based on status
  const getActionLabel = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.DRAFT:
        return "تأكيد الطلب";
      case OrderStatus.CONFIRMED:
        return "للتوصيل";
      case OrderStatus.OUT_FOR_DELIVERY:
        return "إكمال";
      default:
        return "عرض التفاصيل";
    }
  };

  const getNextStatus = (status: OrderStatus): OrderStatus | null => {
    switch (status) {
      case OrderStatus.DRAFT:
        return OrderStatus.CONFIRMED;
      case OrderStatus.CONFIRMED:
        return OrderStatus.OUT_FOR_DELIVERY;
      case OrderStatus.OUT_FOR_DELIVERY:
        return OrderStatus.COMPLETED;
      default:
        return null;
    }
  };

  const isCompleted = order.status === OrderStatus.COMPLETED;
  const isCancelled = order.status === OrderStatus.CANCELLED;
  const isRejectedByCustomer =
    order.status === OrderStatus.REJECTED_BY_CUSTOMER;
  const nextStatus = getNextStatus(order.status);
  const isActionable =
    !isCompleted && !isCancelled && !isRejectedByCustomer && nextStatus !== null;
  
  // Safe customer access
  const customerName = order.customer?.name || "عميل جديد";
  const deliveryAreaLabel =
    order.delivery_area?.name_ar || order.delivery_area?.name_en || null;
  const prescriptionUnavailabilityLabel =
    formatPrescriptionUnavailabilityAction(
      order.prescription_unavailability_action,
    );
  const unavailableItemActionLabel = formatUnavailableItemAction(
    order.unavailable_item_action,
  );

  // Handle action click
  const handleAction = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation();

    if (!nextStatus || isLoading) return;

    setIsLoading(true);
    try {
      await updateOrderStatus(order.id, nextStatus);
      // Optional: Refresh triggers re-fetch in server components, might need manual update if fully client
      // But page.tsx passes initialOrders, so router.refresh() should re-run page.tsx data fetching?
      // Yes, in Next.js App Router, router.refresh() re-fetches server components.
      router.refresh(); 
    } catch (error) {
      console.error("Action failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderItemsContent = () => {
    if (order.items && order.items.length > 0) {
      return order.items
        .map((item) => {
          const itemName = item.replaced_by_product?.name || item.name_snapshot;
          return formatRtlQuantityLabel(itemName, item.quantity);
        })
        .join(", ");
    }
    
    // Check for free text payload
    if (order.free_text_payload?.text) {
       return <span className="text-gray-900 font-medium">&quot;{order.free_text_payload.text}&quot;</span>;
    }

    if (order.prescription_file_url) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft/50 px-2.5 py-0.5 text-xs font-semibold text-brand-primary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          وصفة طبية مرفقة
        </span>
      );
    }

    return <span className="italic text-gray-400">لا يوجد عناصر</span>;
  };

  if (!order.id) {
    return (
        <div className="border-b border-status-error/20 bg-status-error/10 p-4">
            <p className="font-bold text-status-error">طلب غير صالح (رقم المعرف مفقود)</p>
            <pre className="text-xs">{JSON.stringify(order, null, 2)}</pre>
        </div>
    );
  }

  return (
    <Card className={`relative mb-3 p-4 ${isHighlighted ? "animate-pulse-soft bg-status-new/10" : ""}`}>
          {isHighlighted && (
             <div className="absolute bottom-0 start-0 top-0 w-1 animate-pulse bg-status-new"></div>
          )}
        {/* Top Row: Customer & Total */}
        <Link href={`/merchant/orders/${order.id}`} className="block rounded-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20">
          <div className="mb-2 flex items-start justify-between">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-brand-text">
                {customerName}
              </h3>
              <span className="text-xs text-muted-foreground">{formatDate(order.created_at)}</span>
            </div>
            <div className="shrink-0 text-end">
              <span className="block text-lg font-bold text-brand-text">
                {formatCurrency(order.total) || "غير محدد"}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {order.pricing_mode === "manual" ? "يدوي" : "نقدي"}
              </span>
            </div>
          </div>

        {/* Middle: Items Preview */}
          <div className="mb-3">
          {order.scheduled_delivery_date &&
          order.delivery_time_window_snapshot ? (
            <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
              معاد التوصيل المحدد: {order.delivery_time_window_snapshot}
            </div>
          ) : null}
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {deliveryAreaLabel && (
              <span className="mb-1 block text-xs font-semibold text-brand-primary">
                المنطقة: {deliveryAreaLabel}
              </span>
            )}
            {renderItemsContent()}
            {order.notes && (
               <span className="mt-1 block text-xs font-medium text-amber-700">
                  ملاحظة: {order.notes}
               </span>
            )}
            {order.card_on_delivery_requested && (
              <span className="mt-1 block text-xs font-bold text-brand-primary">
                طلب الدفع بالكارت مع التوصيل
              </span>
            )}
            {order.prescription_file_url ? (
              prescriptionUnavailabilityLabel && (
                <span className="mt-1 block text-xs font-semibold text-brand-primary">
                  في حالة عدم التوفر: {prescriptionUnavailabilityLabel}
                </span>
              )
            ) : (
              unavailableItemActionLabel && (
                <span className="mt-1 block text-xs font-semibold text-brand-primary">
                  عند عدم توفر منتج: {unavailableItemActionLabel}
                </span>
              )
            )}
            {order.merchant_cancellation_reason && (
              <span className="mt-1 block text-xs font-semibold text-status-error">
                سبب الإلغاء: {order.merchant_cancellation_reason}
              </span>
            )}
            {order.customer_rejection_reason && (
              <span className="mt-1 block text-xs font-semibold text-status-error">
                سبب رفض العميل: {order.customer_rejection_reason}
              </span>
            )}
          </p>
        </div>
        </Link>

        {/* Bottom: Action Button (if actionable) */}
        {isActionable && (
          <div className="mt-2">
            <Button
              variant={order.status === OrderStatus.DRAFT ? "primary" : "secondary"}
              className="w-full"
              onClick={handleAction}
              disabled={isLoading}
            >
              {isLoading ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : (
                getActionLabel(order.status)
              )}
            </Button>
          </div>
        )}
      </Card>
  );
}
