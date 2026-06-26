import type { Metadata } from "next";
import Link from "next/link";
import PublicPageShell from "@/components/marketing/PublicPageShell";
import { createPublicMetadata, publicMarketingPages } from "@/lib/marketing-seo";

const page = publicMarketingPages.find(item => item.path === "/docs/overview")!;

export const metadata: Metadata = createPublicMetadata(page);

export default function DocsOverviewPage() {
	return (
		<PublicPageShell
			eyebrow="Docs"
			title="نظرة عامة على تجارتك"
			description="مستند عام قصير يشرح ما هو تجارتك ومن يستخدمه وما الذي لا يقدمه."
		>
			<article className="prose prose-neutral max-w-none rounded-2xl border border-brand-border bg-white p-6 leading-8 shadow-soft">
				<h2 className="text-2xl font-black text-brand-text">ما هو تجارتك؟</h2>
				<p className="mt-3 text-muted-foreground">
					تجارتك هو SaaS عربي بسيط للمحلات المصرية. يساعد التاجر يشارك رابط طلبات، يستقبل الطلبات من العملاء، ويتابعها من لوحة تحكم.
				</p>
				<h2 className="mt-6 text-2xl font-black text-brand-text">لمن يناسب؟</h2>
				<p className="mt-3 text-muted-foreground">
					يناسب المحلات التي تستقبل طلبات مباشرة، مثل السوبر ماركت والخضار والفاكهة والمخبز والجزارة والصيدلية.
				</p>
				<h2 className="mt-6 text-2xl font-black text-brand-text">ما هو ليس عليه؟</h2>
				<p className="mt-3 text-muted-foreground">
					تجارتك ليس ماركت بليس ولا شركة دفع ولا يأخذ عمولة على الطلبات.
				</p>
				<Link href="/docs/features" className="mt-6 inline-flex font-bold text-brand-primary">
					اقرأ مستند مميزات تجارتك
				</Link>
			</article>
		</PublicPageShell>
	);
}
