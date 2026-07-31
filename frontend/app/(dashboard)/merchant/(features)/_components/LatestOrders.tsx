import { LatestOrder } from "./dashboard.types";
import Link from "next/link";
import { OrderStatus } from "@/types/enums";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";

interface LatestOrdersProps {
  orders: LatestOrder[];
}

const getStatusBadgeClasses = (status: string) => {
  if (status === OrderStatus.COMPLETED) {
    return "border-transparent bg-green-500/15 text-green-700 dark:text-green-400";
  }

  if (status === OrderStatus.CANCELLED) {
    return "border-transparent bg-red-500/15 text-red-700 dark:text-red-400";
  }

  return "border-transparent bg-secondary text-secondary-foreground";
};

export default function LatestOrders({ orders }: LatestOrdersProps) {
  if (!orders || orders.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
         <h2 className="text-lg font-semibold tracking-tight">أحدث الطلبات</h2>
         <Link href="/merchant/orders" className="text-sm font-medium text-primary flex items-center hover:underline group">
            عرض الكل 
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ms-1 rtl:rotate-180 group-hover:-translate-x-1 transition-transform"><path d="m9 18 6-6-6-6"/></svg>
         </Link>
      </div>

      <div className="bg-card text-card-foreground rounded-2xl border shadow-sm overflow-hidden">
        <ul className="divide-y divide-border/50">
          {orders.map((order) => (
            <li key={order.id} className="group">
              <Link href={`/merchant/orders/${order.id}`} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3">
                     <div className="p-2 rounded-full bg-secondary text-secondary-foreground">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                     </div>
                     <div>
                        <p className="font-semibold text-sm text-foreground">{order.customerName || "عميل زائر"}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className={cn(
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                                getStatusBadgeClasses(order.status)
                            )}>
                                {order.status}
                            </span>
                             <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                {order.timeAgo}
                             </span>
                        </div>
                     </div>
                </div>
                
                <div className="text-end">
                   <p className="font-bold text-foreground tabular-nums">{formatCurrency(order.totalPrice) || "غير محدد"}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
