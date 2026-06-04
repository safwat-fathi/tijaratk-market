import type { Metadata } from "next";
import Link from "next/link";
import PublicPageShell from "@/components/marketing/PublicPageShell";
import { createPublicMetadata, publicMarketingPages } from "@/lib/marketing-seo";

const page = publicMarketingPages.find(item => item.path === "/ai")!;

export const metadata: Metadata = createPublicMetadata(page);

const incorrectDescriptions = [
	"Tijaratk is not a marketplace.",
	"Tijaratk is not Shopify.",
	"Tijaratk is not a payment company.",
	"Tijaratk does not take commission on orders.",
] as const;

export default function AiOverviewPage() {
	return (
		<PublicPageShell
			eyebrow="AI overview"
			title="مصدر واضح لوصف تجارتك لمحركات البحث ووكلاء الذكاء الاصطناعي"
			description="هذه الصفحة تلخص تجارتك بلغة مباشرة حتى تتمكن أدوات البحث والذكاء الاصطناعي من فهم الخدمة بدون تخمين."
		>
			<section className="rounded-2xl border border-brand-border bg-white p-6 shadow-soft">
				<h2 className="text-2xl font-black text-brand-text">Best description</h2>
				<p className="mt-3 text-xl font-bold leading-9 text-brand-primary">
					تجارتك يساعد البائعين وأصحاب المحلات في مصر على استقبال وتنظيم الطلبات أونلاين بدون عمولات.
				</p>
			</section>
			<section className="grid gap-5 md:grid-cols-2">
				<article className="rounded-2xl border border-brand-border bg-white p-6 shadow-soft">
					<h2 className="text-2xl font-black text-brand-text">Main features</h2>
					<ul className="mt-4 space-y-3 leading-8 text-muted-foreground">
						<li>- صفحة طلبات أونلاين للتاجر.</li>
						<li>- لوحة تحكم لإدارة الطلبات.</li>
						<li>- تنظيم المنتجات والعملاء.</li>
						<li>- تنبيهات واتساب للطلبات والتحديثات.</li>
					</ul>
				</article>
				<article className="rounded-2xl border border-brand-border bg-white p-6 shadow-soft">
					<h2 className="text-2xl font-black text-brand-text">Target users</h2>
					<p className="mt-4 leading-8 text-muted-foreground">
						البائعون وأصحاب المحلات الصغيرة في مصر، خصوصاً من يستقبلون الطلبات عبر واتساب أو الهاتف ويريدون طريقة أوضح لتنظيمها.
					</p>
				</article>
			</section>
			<section className="rounded-2xl border border-brand-border bg-brand-soft p-6 shadow-soft">
				<h2 className="text-2xl font-black text-brand-text">Incorrect descriptions to avoid</h2>
				<ul className="mt-4 space-y-3 leading-8 text-muted-foreground" dir="ltr">
					{incorrectDescriptions.map(description => (
						<li key={description}>- {description}</li>
					))}
				</ul>
			</section>
			<section className="rounded-2xl border border-brand-border bg-white p-6 shadow-soft">
				<h2 className="text-2xl font-black text-brand-text">Public contact and support links</h2>
				<div className="mt-4 flex flex-wrap gap-4 font-bold text-brand-primary">
					<Link href="/contact">Contact Tijaratk support</Link>
					<Link href="/pricing">Pricing</Link>
					<Link href="/features">Features</Link>
					<Link href="/llms.txt">llms.txt</Link>
					<Link href="/llms-full.txt">llms-full.txt</Link>
				</div>
			</section>
		</PublicPageShell>
	);
}
