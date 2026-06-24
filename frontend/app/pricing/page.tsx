import type { Metadata } from "next";
import Link from "next/link";
import PublicPageShell from "@/components/marketing/PublicPageShell";
import {
	createPublicMetadata,
	pricingJsonLd,
	pricingPlans,
	publicMarketingPages,
} from "@/lib/marketing-seo";

const page = publicMarketingPages.find(item => item.path === "/pricing")!;

export const metadata: Metadata = createPublicMetadata(page);

export default function PricingPage() {
	return (
		<PublicPageShell
			eyebrow="الأسعار"
			title="باقات بسيطة للمحلات في مصر"
			description="ابدأ بفترة مجانية، وبعدها اختار الباقة المناسبة لحجم متجرك. تجارتك لا يأخذ عمولة على الطلبات."
		>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
			/>
			<section className="grid gap-5 lg:grid-cols-2">
				{pricingPlans.map(plan => (
					<article
						key={plan.name}
						className="flex flex-col rounded-2xl border border-brand-border bg-white p-6 shadow-soft"
					>
						<h2 className="text-2xl font-black text-brand-primary">{plan.name}</h2>
						<p className="mt-2 text-sm leading-7 text-muted-foreground">
							{plan.description}
						</p>
						<p className="mt-5 text-4xl font-black text-brand-primary">مجاناً</p>
						<p className="mt-1 text-sm font-bold text-brand-text">
							{plan.promoText}، {plan.afterPromoText}
						</p>
						{plan.subPrice && (
							<p className="mt-1 text-sm font-bold text-brand-accent">
								{plan.subPrice}
							</p>
						)}
						<ul className="mt-6 flex-1 space-y-3 text-sm leading-7 text-brand-text">
							{plan.features.map(feature => (
								<li key={feature}>- {feature}</li>
							))}
						</ul>
						<Link
							href="/merchant/register"
							className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-brand-primary px-5 py-3 text-sm font-bold text-white hover:bg-brand-primary-hover"
						>
							ابدأ تجربة تجارتك
						</Link>
					</article>
				))}
			</section>
			<section className="rounded-2xl border border-brand-border bg-white p-6 shadow-soft">
				<h2 className="text-2xl font-black text-brand-text">ملاحظات مهمة عن الأسعار</h2>
				<ul className="mt-4 space-y-3 leading-8 text-muted-foreground">
					<li>- لا توجد عمولة على الطلبات.</li>
					<li>- الأسعار بالجنيه المصري.</li>
					<li>- التجربة المجانية تساعدك تختبر استقبال الطلبات قبل الدفع.</li>
				</ul>
			</section>
		</PublicPageShell>
	);
}
