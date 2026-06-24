"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Tenant } from "@/types/models/tenant";
import Link from "next/link";
import { CheckCircle2, ArrowUpRight } from "lucide-react";

export default function ReviewProductsStep({
  tenant,
  setTenant,
  onNext,
}: {
  tenant: Tenant;
  setTenant: (t: Tenant) => void;
  onNext: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    setLoading(true);
    try {
      await onNext();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="bg-brand-soft rounded-2xl p-6 text-center space-y-4">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle2 className="w-8 h-8 text-brand-primary" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">أنت الآن جاهز لاستقبال الطلبات!</h3>
          <p className="text-sm text-gray-600 max-w-sm mx-auto leading-relaxed">
            لقد قمنا بإضافة التشكيلة الأساسية لمتجرك بنجاح. جميع المنتجات مضافة بأسعار استرشادية للبدء فوراً.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4 shadow-sm">
        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">١</span>
          راجع الأسعار
        </h4>
        <p className="text-sm text-gray-600 pr-8">
          يفضل مراجعة أسعار المنتجات المضافة وتعديلها لتطابق أسعار متجرك الفعلية.
        </p>

        <h4 className="font-semibold text-gray-900 flex items-center gap-2 mt-6">
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">٢</span>
          تحديث التوافر
        </h4>
        <p className="text-sm text-gray-600 pr-8">
          إذا كان هناك منتج غير متوفر حالياً في محلك، يمكنك إيقافه مؤقتاً من صفحة المنتجات.
        </p>
      </div>

      <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3 sm:justify-between items-center">
        <Link 
          href="/merchant/products" 
          target="_blank"
          className="text-brand-primary font-semibold text-sm flex items-center gap-1 hover:underline w-full sm:w-auto text-center justify-center"
        >
          فتح صفحة المنتجات في نافذة جديدة
          <ArrowUpRight className="w-4 h-4" />
        </Link>
        <Button onClick={handleFinish} disabled={loading} size="lg" className="w-full sm:w-auto px-10">
          {loading ? "جاري الإنهاء..." : "إنهاء الإعدادات"}
        </Button>
      </div>
    </div>
  );
}
