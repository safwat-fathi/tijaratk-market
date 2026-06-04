import type { Metadata } from "next";
import Link from "next/link";
import PublicPageShell from "@/components/marketing/PublicPageShell";
import { createPublicMetadata, pricingPlans, publicMarketingPages } from "@/lib/marketing-seo";

const page = publicMarketingPages.find(item => item.path === "/docs/pricing")!;

export const metadata: Metadata = createPublicMetadata(page);

export default function DocsPricingPage() {
	return (
		<PublicPageShell
			eyebrow="Docs"
			title="أسعار تجارتك"
			description="ملخص بسيط لباقات تجارتك والتجربة المجانية بدون عمولة على الطلبات."
		>
			<section className="rounded-2xl border border-brand-border bg-white p-6 shadow-soft">
				<h2 className="text-2xl font-black text-brand-text">ملخص الباقات</h2>
				<ul className="mt-4 space-y-4 leading-8 text-muted-foreground">
					{pricingPlans.map(plan => (
						<li key={plan.name}>
							<strong className="text-brand-text">{plan.name}:</strong> {plan.promoText}، {plan.afterPromoText}
						</li>
					))}
				</ul>
				<p className="mt-5 leading-8 text-muted-foreground">
					تجارتك لا يأخذ عمولة على الطلبات. الأسعار بالجنيه المصري.
				</p>
				<Link href="/pricing" className="mt-6 inline-flex font-bold text-brand-primary">
					راجع صفحة الأسعار الكاملة
				</Link>
			</section>
		</PublicPageShell>
	);
}
