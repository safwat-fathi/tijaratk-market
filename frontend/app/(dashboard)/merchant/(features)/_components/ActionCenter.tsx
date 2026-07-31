import { ActionItem } from "./dashboard.types";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatArabicInteger } from "@/lib/utils/number";

interface ActionCenterProps {
  items: ActionItem[];
}

const getIconContainerClasses = (type: ActionItem["type"]) => {
  if (type === "late_order") {
    return "bg-destructive/10 text-destructive";
  }

  if (type === "out_for_delivery") {
    return "bg-brand-soft text-brand-primary dark:bg-brand-soft dark:text-brand-primary";
  }

  return "bg-primary/10 text-primary";
};

const renderActionIcon = (type: ActionItem["type"]) => {
  if (type === "late_order") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
    );
  }

  if (type === "out_for_delivery") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
    );
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  );
};

export default function ActionCenter({ items }: ActionCenterProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-semibold tracking-tight">إجراءات مطلوبة</h2>
        <span className="bg-destructive/10 text-destructive text-xs font-bold px-2.5 py-1 rounded-full animate-pulse-soft">
           {formatArabicInteger(items.length) || items.length} إجراء
        </span>
      </div>
      
      <div className="space-y-3">
        {items.map((item) => {
             const isUrgent = item.type === "late_order";
             const isDelivery = item.type === "out_for_delivery";
             
             return (
              <div 
                key={item.orderId} 
                className={cn(
                    "relative group bg-card rounded-xl border p-4 shadow-sm transition-all hover:shadow-md",
                    isUrgent && "border-destructive/30 bg-destructive/5",
                    isDelivery && "border-brand-primary/30 bg-brand-soft/50 dark:bg-brand-soft/20"
                )}
              >
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-start gap-3">
                        <div className={cn(
                            "p-2.5 rounded-full shrink-0",
                            getIconContainerClasses(item.type)
                        )}>
                            {renderActionIcon(item.type)}
                        </div>
                        <div>
                             <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-base">طلب #{item.orderId}</h3>
                                {item.timeAgo && <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">{item.timeAgo}</span>}
                             </div>
                             <p className="text-sm text-muted-foreground font-medium">{item.customerName}</p>
                        </div>
                    </div>
                    <div className="text-end">
                       <p className="font-bold text-lg tabular-nums tracking-tight">{formatCurrency(item.totalAmount) || "غير محدد"}</p>
                    </div>
                </div>

                <div className="grid grid-cols-[1fr,auto,auto] gap-2">
                    <Link 
                      href={`/merchant/orders/${item.orderId}`}
                      className={cn(
                          "inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-colors h-10 px-4",
                          isUrgent ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : 
                          "bg-primary text-primary-foreground hover:bg-primary/90"
                      )}
                    >
                         {item.type === "new_order" ? "تأكيد الطلب" : "تفاصيل الطلب"}
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ms-1 rtl:rotate-180"><path d="m9 18 6-6-6-6"/></svg>
                    </Link>
                    
                    <button className="inline-flex items-center justify-center rounded-lg border bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10 transition-colors" aria-label="Call Customer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    </button>
                    
                     <button className="inline-flex items-center justify-center rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 h-10 w-10 transition-colors" aria-label="WhatsApp">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                    </button>
                </div>
              </div>
            );
        })}
      </div>
    </div>
  );
}
