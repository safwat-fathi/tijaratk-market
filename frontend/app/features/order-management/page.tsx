import type { Metadata } from "next";
import Link from "next/link";
import PublicPageShell from "@/components/marketing/PublicPageShell";
import { createPublicMetadata, getPublicMarketingPage } from "@/lib/marketing-seo";

const page = getPublicMarketingPage("/features/order-management");

export const metadata: Metadata = createPublicMetadata(page);

export default function OrderManagementPage() {
	return (
		<PublicPageShell
			eyebrow="إدارة الطلبات"
			title="تابع كل طلب من أول ما يوصل لحد التسليم"
			description="بدلاً من طلبات متفرقة بين المكالمات ورسائل واتساب، يظهر كل طلب في لوحة تحكم واضحة للتاجر."
		>
			<section className="rounded-2xl border border-brand-border bg-white p-6 shadow-soft">
				<h2 className="text-2xl font-black text-brand-text">كيف يعمل الطلب؟</h2>
				<ol className="mt-4 space-y-3 leading-8 text-muted-foreground">
					<li>1. التاجر يشارك رابط صفحة الطلبات مع العملاء.</li>
					<li>2. العميل يختار المنتجات والكميات وبيانات التوصيل.</li>
					<li>3. الطلب يظهر في لوحة التحكم مع بيانات العميل والمنتجات.</li>
					<li>4. التاجر يحدث حالة الطلب ويتابع التشغيل اليومي.</li>
				</ol>
			</section>
			<section className="grid gap-5 md:grid-cols-3">
				{["طلبات جديدة", "حالات الطلب", "بيانات العميل"].map(item => (
					<article key={item} className="rounded-2xl border border-brand-border bg-white p-6 shadow-soft">
						<h2 className="text-xl font-black text-brand-primary">{item}</h2>
						<p className="mt-3 leading-7 text-muted-foreground">
							يساعدك تجارتك تشوف المعلومات المهمة في نص واضح بدل البحث داخل رسائل كثيرة.
						</p>
					</article>
				))}
			</section>
			<Link href="/pricing" className="inline-flex font-bold text-brand-primary hover:text-brand-accent">
				راجع باقات تجارتك لإدارة الطلبات بدون عمولة
			</Link>
		</PublicPageShell>
	);
}
