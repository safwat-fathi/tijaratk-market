import type { Metadata } from "next";
import Link from "next/link";
import PublicPageShell from "@/components/marketing/PublicPageShell";
import { createPublicMetadata, publicMarketingPages } from "@/lib/marketing-seo";

const page = publicMarketingPages.find(item => item.path === "/docs/features")!;

export const metadata: Metadata = createPublicMetadata(page);

export default function DocsFeaturesPage() {
	return (
		<PublicPageShell
			eyebrow="Docs"
			title="مميزات تجارتك"
			description="شرح مختصر ومباشر لمميزات تجارةك الأساسية بلغة سهلة القراءة."
		>
			<section className="rounded-2xl border border-brand-border bg-white p-6 shadow-soft">
				<h2 className="text-2xl font-black text-brand-text">المميزات الأساسية</h2>
				<ul className="mt-4 space-y-3 leading-8 text-muted-foreground">
					<li>- رابط طلبات لكل تاجر.</li>
					<li>- صفحة يختار منها العميل المنتجات بدون حساب.</li>
					<li>- لوحة تحكم لمتابعة الطلبات والحالات.</li>
					<li>- إدارة منتجات وعملاء.</li>
					<li>- تنبيهات واتساب للطلبات والتحديثات.</li>
				</ul>
				<Link href="/features" className="mt-6 inline-flex font-bold text-brand-primary">
					اذهب إلى صفحة المميزات العامة
				</Link>
			</section>
		</PublicPageShell>
	);
}
