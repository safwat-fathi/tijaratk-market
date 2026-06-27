import type { Metadata } from "next";
import Link from "next/link";
import PublicPageShell from "@/components/marketing/PublicPageShell";
import { createPublicMetadata, getPublicMarketingPage } from "@/lib/marketing-seo";

const page = getPublicMarketingPage("/features/customer-list");

export const metadata: Metadata = createPublicMetadata(page);

export default function CustomerListPage() {
	return (
		<PublicPageShell
			eyebrow="قائمة العملاء"
			title="نظم بيانات عملاء محلك والطلبات السابقة"
			description="قائمة العملاء تساعد التاجر يعرف من يطلب، بيانات التواصل، والعناوين والطلبات السابقة بشكل أوضح."
		>
			<section className="rounded-2xl border border-brand-border bg-white p-6 shadow-soft">
				<h2 className="text-2xl font-black text-brand-text">ما الذي يمكنك تنظيمه؟</h2>
				<ul className="mt-4 space-y-3 leading-8 text-muted-foreground">
					<li>- اسم العميل ورقم الهاتف.</li>
					<li>- عناوين التوصيل المستخدمة في الطلبات.</li>
					<li>- سياق الطلبات السابقة لمتابعة أفضل.</li>
					<li>- بيانات تساعد خدمة العملاء اليومية.</li>
				</ul>
			</section>
			<section className="rounded-2xl border border-brand-border bg-brand-soft p-6 shadow-soft">
				<h2 className="text-2xl font-black text-brand-text">مهم للخصوصية</h2>
				<p className="mt-3 leading-8 text-muted-foreground">
					بيانات العملاء تظهر داخل لوحة تحكم التاجر المحمية، ولا يتم وضعها في sitemap أو صفحات التسويق العامة.
				</p>
			</section>
			<Link href="/contact" className="inline-flex font-bold text-brand-primary hover:text-brand-accent">
				تواصل لمعرفة كيف يساعدك تجارتك في تنظيم العملاء
			</Link>
		</PublicPageShell>
	);
}
