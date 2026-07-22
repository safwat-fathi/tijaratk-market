/* eslint-disable @next/next/no-img-element */
import { AppHeader } from "@/components/layout/AppHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { createNoIndexMetadata } from "@/lib/marketing-seo";
import ManualOrderAction from "./_components/ManualOrderAction";

export const metadata = createNoIndexMetadata(
  "صيدلية الشفاء | نموذج متجر",
  "صفحة نموذجية غير مخصصة للفهرسة تعرض شكل واجهة متجر على تجارتك.",
);

export default function DummyStorefront() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f7faf5]" dir="rtl">
      <AppHeader
        title="صيدلية الشفاء"
        innerClassName="mx-auto flex max-w-7xl flex-col items-start gap-3 px-4 py-3 sm:px-6 lg:px-8"
      />
      <main className="flex-1 pb-32 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-4">
        <style dangerouslySetInnerHTML={{__html: `
          @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
          .bg-surface-container-lowest { background-color: #ffffff; }
          .bg-surface-container-low { background-color: #f2f4f0; }
          .bg-soft-mint { background-color: #E8F5ED; }
          .text-primary-dark { color: #0F5A3D; }
          .bg-primary-dark { background-color: #0F5A3D; }
          .text-accent-green { color: #27AE60; }
          .bg-accent-green { background-color: #27AE60; }
          .text-on-surface-variant { color: #404943; }
          .text-on-background { color: #191c1a; }
          .text-on-primary { color: #ffffff; }
          .bg-off-white { background-color: #F7F8F6; }
          .text-outline { color: #707972; }
          .border-outline-variant\\/20 { border-color: rgba(191, 201, 193, 0.2); }
          .border-outline-variant\\/30 { border-color: rgba(191, 201, 193, 0.3); }
          .border-outline-variant\\/50 { border-color: rgba(191, 201, 193, 0.5); }
          .border-primary-fixed\\/30 { border-color: rgba(171, 242, 203, 0.3); }
          .border-accent-green\\/30 { border-color: rgba(39, 174, 96, 0.3); }
          .bg-error { background-color: #ba1a1a; }
          .text-on-error { color: #ffffff; }
          .bg-secondary-container { background-color: #7bf8a1; }
          .text-on-secondary-container { color: #007239; }
          .text-primary-fixed { color: #abf2cb; }
        `}} />
        {/*  Search Bar  */}
<div className=" py-3">
<div className="relative">
<span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline">search</span>
<input className="w-full bg-off-white border border-outline-variant/50 rounded-full py-3 pr-12 pl-4 focus:ring-2 focus:ring-accent-green focus:border-transparent outline-none font-body-md-ar text-body-md-ar shadow-sm" placeholder="ابحث عن دواء أو منتج" type="text"/>
</div>
</div>
{/*  Info Row  */}
<div className=" py-2 flex gap-2 overflow-x-auto no-scrollbar">
<div className="flex items-center gap-1.5 bg-soft-mint px-3 py-1.5 rounded-full shrink-0 border border-primary-fixed/30">
<span className="material-symbols-outlined text-primary-dark text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>storefront</span>
<span className="font-label-sm-ar text-label-sm-ar text-primary-dark">مفتوح الآن</span>
</div>
<div className="flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-full shrink-0 border border-outline-variant/30">
<span className="material-symbols-outlined text-on-surface-variant text-sm">schedule</span>
<span className="font-label-sm-ar text-label-sm-ar text-on-surface-variant">التوصيل خلال 30-45 دقيقة</span>
</div>
<div className="flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-full shrink-0 border border-outline-variant/30">
<span className="material-symbols-outlined text-on-surface-variant text-sm">payments</span>
<span className="font-label-sm-ar text-label-sm-ar text-on-surface-variant">الدفع عند الاستلام</span>
</div>
</div>
{/*  عروض اليوم  */}
<section className="mt-6">
<div className=" mb-3 flex items-center justify-between">
<h3 className="font-title-sm-ar text-title-sm-ar text-on-background">عروض اليوم</h3>
<button className="text-accent-green font-label-sm-ar text-label-sm-ar">عرض الكل</button>
</div>
<div className="flex overflow-x-auto no-scrollbar gap-4  pb-4">
{/*  Product Card 1  */}
<div className="w-40 shrink-0 bg-surface-container-lowest rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-3 flex flex-col relative">
<div className="absolute top-2 right-2 bg-error text-on-error font-label-sm-ar text-[10px] px-2 py-0.5 rounded-full z-10 font-bold">
                    عرض
                </div>
<div className="w-full h-32 rounded-xl overflow-hidden mb-3 bg-off-white">
<img alt="فيتامين سي" className="w-full h-full object-cover mix-blend-multiply" data-alt="A clean, bright studio shot of a medical pill bottle and some loose capsules on a white surface. The lighting is soft and shadowless, conveying a clinical, trustworthy, and modern pharmaceutical aesthetic." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCmn5-KW9oJplLYh-puTn9nd0u63aubW37u5Y9_15kB0nTJCVZw73MLt-chwq4Py3xpQNhYwFy_UBsaTigpvF1cTLi5V7-OC4II5pONMbhFXot8zH6uGMiCKmeKNYfGtb3lL6rWcYhs-_Y6iOM4nYrjmSvvyDvqwRPC0WqDbvbRPp4F7sR8t3MtOL8dUozPur4sIzrt2GyZTHGb0xjwg4H_un0WbL_VJSwPh_vPA0WfjUDJJ6rzUWgIbw49wRrK8Sc3OcQLv30u_Cg"/>
</div>
<h4 className="font-label-sm-ar text-label-sm-ar text-on-background line-clamp-2 mb-1">فيتامين سي 1000 مجم أقراص فوارة</h4>
<div className="mt-auto flex items-end justify-between pt-2">
<div>
<p className="font-title-sm-ar text-sm font-bold text-primary-dark">45 ج.م</p>
<p className="font-label-sm-ar text-[10px] text-outline line-through">60 ج.م</p>
</div>
<button className="bg-accent-green text-on-primary w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform shadow-sm">
<span className="material-symbols-outlined text-sm">add</span>
</button>
</div>
</div>
{/*  Product Card 2 (Added State)  */}
<div className="w-40 shrink-0 bg-surface-container-lowest rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-3 flex flex-col relative border border-accent-green/30">
<div className="absolute top-2 right-2 bg-secondary-container text-on-secondary-container font-label-sm-ar text-[10px] px-2 py-0.5 rounded-full z-10 font-bold">
                    الأكثر طلباً
                </div>
<div className="w-full h-32 rounded-xl overflow-hidden mb-3 bg-off-white">
<img alt="كريم مرطب" className="w-full h-full object-cover mix-blend-multiply" data-alt="A pristine white tube of medical cream lying on a clean, light surface with a soft shadow. The lighting is bright and even, highlighting the product in a professional, modern health-care context." src="https://lh3.googleusercontent.com/aida-public/AB6AXuA6_mZxsZqU4rjSIATBSYuTlIChp309KviVK_so-x_91yrllgd_s0Nom6Bve_pJSEknmTAVKmAXQd3SINT43ZtQRP_4egNQJO626kZqOHWQ9LeAkdfumah9EiLDoExLqnbEO2ThrrgCEkOM1sq0ktDHwkEQujAohkEhANgLfnympUBxyG603w_9D2wueuxOjkdFh87bGA3NapTO9C6Ng48koIMvZppwi7-z2TJVZAnZRZmADunrgxWbhV77w9FS26y-jKG71f_zaKM"/>
</div>
<h4 className="font-label-sm-ar text-label-sm-ar text-on-background line-clamp-2 mb-1">كريم مرطب للبشرة الجافة والحساسة 50 مل</h4>
<div className="mt-auto pt-2">
<p className="font-title-sm-ar text-sm font-bold text-primary-dark mb-2">120 ج.م</p>
<div className="flex items-center justify-between bg-soft-mint rounded-lg px-2 py-1">
<button className="text-primary-dark p-1 active:scale-95 transition-transform">
<span className="material-symbols-outlined text-sm">remove</span>
</button>
<span className="font-label-sm-ar font-bold text-primary-dark">1</span>
<button className="text-primary-dark p-1 active:scale-95 transition-transform">
<span className="material-symbols-outlined text-sm">add</span>
</button>
</div>
</div>
</div>
</div>
</section>
{/*  Categories  */}
<section className="mt-2 mb-4">
<div className="flex overflow-x-auto no-scrollbar gap-2  pb-2">
<button className="bg-primary-dark text-on-primary font-label-sm-ar text-label-sm-ar px-4 py-2 rounded-full shrink-0 shadow-sm flex items-center gap-1.5">
  <span>الكل</span>
  <span className="bg-white/20 text-on-primary rounded-full px-1.5 py-0.5 text-[10px] font-bold">4</span>
</button>
<button className="bg-surface-container-lowest text-on-surface-variant font-label-sm-ar text-label-sm-ar px-4 py-2 rounded-full shrink-0 border border-outline-variant/30 hover:bg-surface-container-low transition-colors flex items-center gap-1.5">
  <span>أدوية</span>
  <span className="bg-surface-container-low text-on-surface-variant rounded-full px-1.5 py-0.5 text-[10px] font-bold">2</span>
</button>
<button className="bg-surface-container-lowest text-on-surface-variant font-label-sm-ar text-label-sm-ar px-4 py-2 rounded-full shrink-0 border border-outline-variant/30 hover:bg-surface-container-low transition-colors flex items-center gap-1.5">
  <span>عناية شخصية</span>
  <span className="bg-surface-container-low text-on-surface-variant rounded-full px-1.5 py-0.5 text-[10px] font-bold">1</span>
</button>
<button className="bg-surface-container-lowest text-on-surface-variant font-label-sm-ar text-label-sm-ar px-4 py-2 rounded-full shrink-0 border border-outline-variant/30 hover:bg-surface-container-low transition-colors flex items-center gap-1.5">
  <span>فيتامينات</span>
  <span className="bg-surface-container-low text-on-surface-variant rounded-full px-1.5 py-0.5 text-[10px] font-bold">1</span>
</button>
</div>
</section>
{/*  الأكثر طلباً List  */}
<section className="mt-4 ">
<h3 className="font-title-sm-ar text-title-sm-ar text-on-background mb-4">الأكثر طلباً</h3>
<div className="flex flex-col gap-4">
{/*  List Item 1  */}
<div className="bg-surface-container-lowest rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-3 flex gap-4">
<div className="w-24 h-24 rounded-xl overflow-hidden bg-off-white shrink-0">
<img alt="بنادول" className="w-full h-full object-cover mix-blend-multiply" data-alt="Close up of paracetamol or generic painkiller blister packs on a clean white background. High key lighting, sharp focus, medical aesthetic." src="https://lh3.googleusercontent.com/aida-public/AB6AXuBz7s1ZCOxifZauuYD6RjZPUfP59YPLD_fC_2gbg_p9lAMDBXzEY7TRHl3GAzecNnQLGoV68J_bbV6xmHsCRLHHxuqRTnocUikp9JxyzLBawDn7JTcI0I8Z90_ggQW4SMInOLwvi2oLe0w8KsufCZ4h6txnQ1E4IDvjK79SLrAyG8BlsnvJ6VMfJNt0NYvvkaHOR3Pqg9QPLyTwrFdyRT9RIyGVAesfSVM-ZkX3WcmnD8Q65RvgCsgiq0sgIdpUib2kqzxRO8CY7sI"/>
</div>
<div className="flex flex-col flex-1 py-1">
<h4 className="font-body-md-ar text-body-md-ar text-on-background line-clamp-2">بنادول ادفانس 500 مجم 24 قرص</h4>
<p className="font-label-sm-ar text-[12px] text-outline mt-1">بالعلبة</p>
<div className="mt-auto flex items-center justify-between">
<p className="font-title-sm-ar text-title-sm-ar font-bold text-primary-dark">29 ج.م</p>
<button className="bg-accent-green text-on-primary w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform shadow-sm">
<span className="material-symbols-outlined text-sm">add</span>
</button>
</div>
</div>
</div>
{/*  List Item 2  */}
<div className="bg-surface-container-lowest rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-3 flex gap-4">
<div className="w-24 h-24 rounded-xl overflow-hidden bg-off-white shrink-0">
<img alt="بيتادين" className="w-full h-full object-cover mix-blend-multiply" data-alt="A clean, minimalist shot of an antiseptic bottle or medical alcohol with a blue label on a bright white surface. Soft lighting, professional healthcare vibe." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDhstDN5cr0kohNyCRneZI6Fpi_HNJbQ7oRJrK7T_JYMI1et9OvtHv62pZ0alXnMF5o1YTAVJFHNKAZLJ7kLHydvyL_GsaYHABK60hLEuDJ6wxAL21--LFFX3Il_xsFyKTG9CZtwwZaf9uGuTMbLHR4awuNGhr_vhwhA4aiwf1h_7e8xRu6SNpReLAlpXewBazP3N6rv7jCpCwpKcqly6Unhu2G73YUljIc-w9WV49xOEg96FMeDgRLQoRvJwzX0rUKuqGPrO1HzQA"/>
</div>
<div className="flex flex-col flex-1 py-1">
<h4 className="font-body-md-ar text-body-md-ar text-on-background line-clamp-2">بيتادين مطهر جروح 10% محلول 120 مل</h4>
<p className="font-label-sm-ar text-[12px] text-outline mt-1">بالعلبة</p>
<div className="mt-auto flex items-center justify-between">
<p className="font-title-sm-ar text-title-sm-ar font-bold text-primary-dark">65 ج.م</p>
<button className="bg-accent-green text-on-primary w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform shadow-sm">
<span className="material-symbols-outlined text-sm">add</span>
</button>
</div>
</div>
</div>
</div>
</section>
{/*  Manual Order Footer Section  */}
<section className="mt-8 ">
<div className="bg-soft-mint rounded-2xl p-4 flex items-center justify-between shadow-sm">
<div>
<h4 className="font-title-sm-ar text-title-sm-ar text-primary-dark mb-1">مش لاقي المنتج؟ اطلبه من هنا</h4>
<p className="font-body-md-ar text-sm text-on-surface-variant">صور الروشتة أو اكتب طلبك</p>
</div>
<ManualOrderAction />
</div>
</section>
{/*  Sticky Cart Bar  */}
<div className="fixed bottom-6 left-0 w-full z-40 px-4 sm:px-6 lg:px-8 flex justify-center">
<div className="bg-primary-dark text-on-primary rounded-2xl shadow-lg p-3 flex items-center justify-between w-full max-w-7xl">
<div className="flex flex-col">
<span className="font-label-sm-ar text-xs text-primary-fixed">الإجمالي (شامل الضريبة)</span>
<span className="font-title-sm-ar font-bold">1 عنصر • 29 ج.م</span>
</div>
<button className="bg-accent-green text-on-primary font-title-sm-ar text-sm px-6 py-2 rounded-xl font-medium active:scale-95 transition-transform shadow-sm flex items-center gap-2">
                عرض الطلب
                <span className="material-symbols-outlined text-sm">shopping_cart</span>
</button>
</div>
</div>

      </main>
      <PublicFooter />
    </div>
  );
}
