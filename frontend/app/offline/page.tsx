import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "غير متصل بالإنترنت",
  robots: { index: false, follow: false },
};

/** Static privacy-safe fallback shown when a dashboard navigation is offline. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <section className="w-full max-w-md rounded-xl border border-brand-border bg-white p-8 text-center shadow-soft">
        <Logo width={160} height={48} className="mx-auto h-12 w-auto" />
        <h1 className="mt-6 text-2xl font-bold text-brand-text">لا يوجد اتصال بالإنترنت</h1>
        <p className="mt-3 leading-7 text-gray-600">
          أعد الاتصال ثم حاول فتح لوحة التحكم مرة أخرى. لا يتم حفظ بيانات الطلبات على هذا الجهاز.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-brand-primary px-5 py-2.5 font-bold text-white hover:bg-brand-accent"
        >
          إعادة المحاولة
        </Link>
      </section>
    </main>
  );
}
