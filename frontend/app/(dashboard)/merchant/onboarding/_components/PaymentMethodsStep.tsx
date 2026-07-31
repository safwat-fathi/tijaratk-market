"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Tenant } from "@/types/models/tenant";
import { Field, Input } from "@/components/ui/Field";
import { updatePaymentMethodsAction } from "@/actions/tenant-actions";

export default function PaymentMethodsStep({
  tenant,
  setTenant,
  onNext,
}: {
  tenant: Tenant;
  setTenant: (t: Tenant) => void;
  onNext: () => void;
}) {
  const [instapayName, setInstapayName] = useState(tenant.instapay_account_name || "");
  const [instapayNumber, setInstapayNumber] = useState(tenant.instapay_account_number || "");
  const [ewalletName, setEwalletName] = useState(tenant.ewallet_account_name || "");
  const [ewalletNumber, setEwalletNumber] = useState(tenant.ewallet_account_number || "");
  const [codAvailable, setCodAvailable] = useState(tenant.card_on_delivery_available || false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const response = await updatePaymentMethodsAction({
        name: tenant.name,
        category: tenant.category,
        instapay_account_name: instapayName,
        instapay_account_number: instapayNumber,
        ewallet_account_name: ewalletName,
        ewallet_account_number: ewalletNumber,
        card_on_delivery_available: codAvailable,
      });
      
      if (response.success && response.data) {
        setTenant(response.data);
        await onNext();
      } else {
        setError("حدث خطأ أثناء حفظ الإعدادات");
      }
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {error && (
        <div className="bg-red-50 text-red-800 p-4 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}
      <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 mb-4 border border-gray-100">
        هذه البيانات اختيارية ولكن يُفضل إضافتها لتسهيل الدفع على العملاء.
      </div>
      
      <div className="space-y-6">
        <div className="space-y-4 p-4 border border-gray-100 rounded-lg">
          <h3 className="font-semibold text-gray-900">حساب إنستاباي (InstaPay)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="اسم الحساب" htmlFor="instapayName">
              <Input 
                id="instapayName"
                placeholder="مثال: Ahmed Ali"
                value={instapayName}
                onChange={(e) => setInstapayName(e.target.value)}
              />
            </Field>
            <Field label="عنوان الدفع (IPA)" htmlFor="instapayNumber">
              <Input 
                id="instapayNumber"
                placeholder="مثال: ahmed@instapay"
                value={instapayNumber}
                onChange={(e) => setInstapayNumber(e.target.value)}
                dir="ltr"
              />
            </Field>
          </div>
        </div>

        <div className="space-y-4 p-4 border border-gray-100 rounded-lg">
          <h3 className="font-semibold text-gray-900">المحفظة الإلكترونية (فودافون كاش، إلخ)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="اسم صاحب المحفظة" htmlFor="ewalletName">
              <Input 
                id="ewalletName"
                placeholder="مثال: أحمد علي"
                value={ewalletName}
                onChange={(e) => setEwalletName(e.target.value)}
              />
            </Field>
            <Field label="رقم المحفظة" htmlFor="ewalletNumber">
              <Input 
                id="ewalletNumber"
                placeholder="مثال: 010xxxxxxxx"
                value={ewalletNumber}
                onChange={(e) => setEwalletNumber(e.target.value)}
                dir="ltr"
              />
            </Field>
          </div>
        </div>

        <label className="flex items-center gap-3 p-4 border border-gray-100 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <input 
            type="checkbox" 
            className="w-5 h-5 accent-brand-primary rounded"
            checked={codAvailable}
            onChange={(e) => setCodAvailable(e.target.checked)}
          />
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900">توفر ماكينة دفع عند الاستلام (POS)</span>
            <span className="text-xs text-gray-500">اختر هذا الخيار إذا كان مندوبك يحمل ماكينة دفع إلكتروني.</span>
          </div>
        </label>
      </div>

      <div className="pt-4 border-t border-gray-100 flex justify-end">
        <Button type="submit" disabled={loading} size="lg" className="w-full sm:w-auto px-8">
          {loading ? "جاري الحفظ..." : "حفظ ومتابعة"}
        </Button>
      </div>
    </form>
  );
}
