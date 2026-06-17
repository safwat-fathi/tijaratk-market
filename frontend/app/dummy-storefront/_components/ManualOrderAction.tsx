"use client";

import { useState } from "react";
import BottomSheet from "@/components/ui/BottomSheet";

export default function ManualOrderAction() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-primary-dark text-on-primary font-label-sm-ar text-label-sm-ar px-4 py-2 rounded-xl flex items-center gap-2 active:scale-95 transition-transform shadow-md shrink-0 whitespace-nowrap"
      >
        <span className="material-symbols-outlined text-sm">edit_document</span>
        اكتب طلبك يدوي
      </button>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="طلب خاص"
        className="font-body-md-ar"
        footer={
          <div className="pb-2 w-full" dir="rtl">
            <button className="w-full bg-primary-dark text-on-primary font-title-sm-ar text-base py-3.5 rounded-xl shadow-md active:scale-95 transition-transform flex justify-center items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">send</span>
              إرسال الطلب
            </button>
          </div>
        }
      >
        <div className="space-y-6 pb-6 pt-2" dir="rtl">
          {/* Manual Order Card */}
          <div className="rounded-2xl border border-outline-variant/30 p-4 shadow-sm bg-white relative overflow-hidden">
            <div className="flex items-start justify-between mb-4">
               <div>
                  <h3 className="font-title-sm-ar font-bold text-brand-text text-lg">طلب يدوي</h3>
                  <p className="font-body-md-ar text-sm text-on-surface-variant mt-1 leading-relaxed">مش لاقي اللي انت عايزه؟ اكتبه هنا وإحنا هنوفره لو متاح</p>
               </div>
               <div className="w-12 h-12 rounded-2xl bg-[#FDF6EA] text-[#D48C29] flex items-center justify-center shrink-0 mr-4">
                 <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 0" }}>edit_square</span>
               </div>
            </div>
            
            <textarea 
              className="w-full bg-[#F7F8F6] border border-outline-variant/30 rounded-xl p-3 font-body-md-ar text-sm resize-none focus:ring-2 focus:ring-accent-green focus:border-transparent outline-none h-24 placeholder:text-outline"
              placeholder="شريط كاتفلام أو كريم شعر"
            ></textarea>

            <p className="font-label-sm-ar text-xs text-on-surface-variant mt-3 text-center">
              ملاحظات: المتجر هيتواصل معاك لتأكيد السعر والتوفر قبل التنفيذ
            </p>
          </div>

          {/* Prescription Card */}
          <div className="rounded-2xl border border-outline-variant/30 p-4 shadow-sm bg-white relative overflow-hidden">
             <div className="absolute top-4 left-4">
               <span className="material-symbols-outlined text-brand-text font-bold">expand_less</span>
             </div>
            <div className="flex items-start justify-between mb-6">
               <div className="pr-1">
                  <h3 className="font-title-sm-ar font-bold text-brand-text text-lg">اطلب بالروشتة</h3>
                  <p className="font-body-md-ar text-sm text-on-surface-variant mt-1 leading-relaxed">صور الروشتة وارفعها وهنجهزلك طلبك</p>
               </div>
               <div className="w-12 h-12 rounded-2xl bg-[#E8F5ED] text-primary-dark flex items-center justify-center shrink-0 mr-4">
                 <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 0" }}>receipt_long</span>
               </div>
            </div>

            <div className="space-y-5 border-t border-outline-variant/20 pt-5">
               <div>
                 <label className="block font-label-sm-ar text-sm mb-2 text-brand-text font-bold">في حالة عدم التوفر</label>
                 <div className="relative">
                    <select className="w-full bg-[#f7faf5] border-none rounded-xl p-3.5 font-body-md-ar text-sm appearance-none outline-none focus:ring-2 focus:ring-accent-green">
                       <option>اتصل بي للاستشارة</option>
                       <option>أرسل البديل المتاح</option>
                       <option>إلغاء المنتج</option>
                    </select>
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-sm">expand_more</span>
                 </div>
               </div>

               <div>
                 <label className="block font-label-sm-ar text-sm mb-2 text-brand-text font-bold">تحميل الوصفة الطبية</label>
                 <div className="border-2 border-dashed border-[#b1d8c1] rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-white cursor-pointer hover:bg-soft-mint/30 transition-colors">
                    <div className="w-16 h-16 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.05)] bg-white border border-outline-variant/10 flex items-center justify-center text-accent-green mb-4">
                       <span className="material-symbols-outlined text-[32px]">cloud_upload</span>
                    </div>
                    <h4 className="font-title-sm-ar font-bold text-brand-text mb-1">اضغط لالتقاط صورة أو تحميل ملف</h4>
                    <p className="font-body-md-ar text-xs text-outline">استخدم كاميرا الهاتف أو ارفع صورة (JPG, PNG) أو PDF</p>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
