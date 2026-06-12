import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/layout/PublicFooter";
import SafeImage from "@/components/ui/SafeImage";

export const metadata: Metadata = {
  title: "دليل المتاجر - اكتشف المتاجر القريبة",
  description:
    "تصفح السوبر ماركت والصيدليات في منطقتك واطلب مباشرة من المتاجر المحلية.",
};

const popularAreas = [
  { name: "الشيخ زايد", stores: 24 },
  { name: "6 أكتوبر", stores: 18 },
  { name: "المعادي", stores: 30 },
  { name: "القاهرة الجديدة", stores: 42 },
];

const categories = [
  {
    name: "سوبر ماركت",
    stores: 150,
    color: "bg-[#E8F5ED]",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-[#0F5A3D] w-8 h-8"
      >
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    name: "صيدليات",
    stores: 85,
    color: "bg-red-50",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-red-500 w-8 h-8"
      >
        <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
        <path d="m8.5 8.5 7 7" />
      </svg>
    ),
  },
];

export default function StoresDirectoryPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8F6]" dir="rtl">
      {/* Custom Store Directory Header */}
      <div className="sticky top-0 z-50 rounded-b-xl border-b border-white/10 bg-brand-primary text-white shadow-soft backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Right: Branding */}
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-md border border-white/10 bg-white p-1 shadow-inner">
              <SafeImage
                src="/tijaratk-logo-suite/app-icon-green.png"
                alt="دليل المتاجر"
                width={40}
                height={40}
                className="rounded-lg object-contain"
                sizes="40px"
                loading="eager"
                fallback={<div className="h-10 w-10 rounded-lg bg-white/20" />}
              />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-lg font-bold tracking-tight leading-tight line-clamp-1">
                دليل المتاجر
              </h1>
            </div>
          </div>

          {/* Left: Actions */}
          <Link
            href="/track-orders"
            className="flex min-h-11 items-center justify-center rounded-md border border-white/30 bg-white/10 p-2.5 text-white backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
            aria-label="تتبع طلباتي"
          >
            تتبع طلباتي
          </Link>
        </div>
      </div>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-[#E8F5ED] to-[#F7F8F6] px-4 pt-16 pb-8 sm:py-24 text-center">
          <div className="mx-auto max-w-4xl">
            <h1 className="text-4xl font-bold leading-tight text-[#0F5A3D] sm:text-5xl lg:text-6xl mb-6">
              اطلب من سوبر ماركت وصيدليات في منطقتك
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-[#222B2E]/80">
              اختر منطقتك وشوف السوبر ماركت والصيدليات المتاحة للطلب والتوصيل
              مباشرة.
            </p>
          </div>
        </section>

        {/* Floating Search Area */}
        <section className="sticky top-16 z-40 bg-[#F7F8F6]/90 backdrop-blur-md border-b border-gray-200/50 shadow-sm transition-all py-6 px-4">
          <div className="mx-auto max-w-3xl">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6 text-gray-400"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="ابحث عن منطقتك..."
                className="w-full rounded-full border border-gray-300 bg-white py-4 pl-6 pr-14 text-lg font-medium text-[#222B2E] placeholder-gray-400 shadow-sm focus:border-[#27AE60] focus:outline-none focus:ring-2 focus:ring-[#27AE60]/20"
              />
            </div>

            {/* Most Searched Chips */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-sm font-semibold text-gray-500 ml-2">
                الأكثر بحثاً:
              </span>
              {["الشيخ زايد", "6 أكتوبر", "التجمع الخامس", "المعادي"].map(
                (chip) => (
                  <button
                    key={chip}
                    className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-[#0F5A3D] border border-gray-200 hover:bg-[#E8F5ED] hover:border-[#27AE60]/30 transition-colors"
                  >
                    {chip}
                  </button>
                ),
              )}
            </div>
          </div>
        </section>

        {/* Content Container */}
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 space-y-20">
          {/* Store Categories Section */}
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-[#222B2E]">
                تصنيفات المتاجر
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {categories.map((cat) => (
                <Link
                  key={cat.name}
                  href={`/stores/category/${cat.name.replace(/\s+/g, "-").toLowerCase()}`}
                  className="group flex items-center rounded-2xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-[#27AE60]/30 transition-all"
                >
                  <div
                    className={`flex h-20 w-20 flex-none items-center justify-center rounded-2xl ${cat.color} ml-6 group-hover:scale-105 transition-transform`}
                  >
                    {cat.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-[#222B2E] mb-2">
                      {cat.name}
                    </h3>
                    <p className="text-base font-medium text-gray-500">
                      {cat.stores} متجر متوفر
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-400 group-hover:bg-[#E8F5ED] group-hover:text-[#27AE60] transition-colors">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5"
                    >
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Popular Areas Section */}
          <section>
            <div className="flex flex-col gap-3 mb-4">
              <h2 className="text-3xl font-bold text-[#222B2E]">
                تصفح حسب المنطقة
              </h2>
              <Link
                href="#"
                className="group flex items-center gap-1 text-sm font-bold text-[#27AE60] hover:text-[#0F5A3D] transition-colors"
              >
                <span>عرض الكل</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 transition-transform group-hover:-translate-x-1"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-6">
              {popularAreas.map((area) => (
                <Link
                  key={area.name}
                  href={`/stores/${area.name.replace(/\s+/g, "-").toLowerCase()}`}
                  className="group flex flex-col items-center rounded-2xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-[#27AE60]/30 transition-all text-center"
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F7F8F6] text-[#0F5A3D] group-hover:bg-[#27AE60] group-hover:text-white transition-colors">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-6 h-6"
                    >
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-[#222B2E]">
                    {area.name}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-gray-500">
                    {area.stores} متجر
                  </p>
                </Link>
              ))}
            </div>
          </section>

          {/* Browse by Area Section */}
          {/* <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-[#222B2E]">
                تصفح حسب المنطقة
              </h2>
            </div>

            <div className="flex flex-wrap gap-3">
              {[
                "المهندسين",
                "الدقي",
                "مدينة نصر",
                "مصر الجديدة",
                "الشروق",
                "العبور",
                "الهرم",
                "فيصل",
                "الزمالك",
                "المقطم",
              ].map((area) => (
                <Link
                  key={area}
                  href={`/stores/${area.replace(/\s+/g, "-").toLowerCase()}`}
                  className="rounded-xl bg-white px-6 py-3 text-base font-semibold text-[#0F5A3D] border border-gray-200 hover:bg-[#E8F5ED] hover:border-[#27AE60]/30 hover:shadow-sm transition-all"
                >
                  {area}
                </Link>
              ))}
            </div>
          </section> */}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
