import Link from "next/link";

export default function QuickActions() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">إجراءات سريعة</h2>
      <div className="grid grid-cols-2 gap-3">
        <Link 
          href="/merchant/products/new"
          className="group flex flex-col items-center justify-center p-6 gap-3 bg-card border rounded-2xl transition-all hover:bg-primary/5 hover:border-primary/50 relative overflow-hidden"
        >
            <div className="p-3 bg-primary/10 rounded-full text-primary group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            </div>
            <span className="text-sm font-semibold text-foreground">إضافة منتج</span>
        </Link>
        
        <Link 
          href="/merchant/orders/new"
          className="group flex flex-col items-center justify-center p-6 gap-3 bg-card border rounded-2xl transition-all hover:bg-primary/5 hover:border-primary/50 relative overflow-hidden"
        >
            <div className="p-3 bg-primary/10 rounded-full text-primary group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="12" x2="12" y1="18" y2="12"/><line x1="9" x2="15" y1="15" y2="15"/></svg>
            </div>
            <span className="text-sm font-semibold text-foreground">طلب يدوي</span>
        </Link>
      </div>
    </div>
  );
}
