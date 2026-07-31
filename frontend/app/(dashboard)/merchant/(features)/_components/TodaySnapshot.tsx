import { DashboardStats } from "./dashboard.types";
import { formatCurrency } from "@/lib/utils/currency";
import { formatArabicInteger } from "@/lib/utils/number";

interface TodaySnapshotProps {
  stats: DashboardStats;
}

export default function TodaySnapshot({ stats }: TodaySnapshotProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">ملخص اليوم</h2>
      
      <div className="bg-gradient-to-br from-primary to-primary/90 rounded-2xl p-6 text-primary-foreground shadow-lg shadow-primary/20 relative overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-black/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-8">
            <div>
              <p className="text-primary-foreground/80 font-medium mb-1">إجمالي المبيعات</p>
              <h3 className="text-4xl font-bold tracking-tight">
                {formatCurrency(stats.totalEgp) || "غير محدد"}
              </h3>
            </div>
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-md">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/70"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                <p className="text-xs font-medium text-white/70">الطلبات</p>
              </div>
              <p className="text-xl font-bold">
                {formatArabicInteger(stats.ordersCount) || stats.ordersCount}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10 relative overflow-hidden group">
               {stats.pendingOrdersCount > 0 && (
                   <div className="absolute inset-0 bg-orange-500/20 group-hover:bg-orange-500/30 transition-colors" />
               )}
              <div className="flex items-center gap-2 mb-1 relative z-10">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${stats.pendingOrdersCount > 0 ? "text-orange-200" : "text-white/70"}`}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <p className={`text-xs font-medium ${stats.pendingOrdersCount > 0 ? "text-orange-100" : "text-white/70"}`}>معلق</p>
              </div>
              <p className="text-xl font-bold relative z-10">
                {formatArabicInteger(stats.pendingOrdersCount) || stats.pendingOrdersCount}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/70"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
                <p className="text-xs font-medium text-white/70">توصيل</p>
              </div>
              <p className="text-xl font-bold">{formatCurrency(stats.deliveryFees) || "غير محدد"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
