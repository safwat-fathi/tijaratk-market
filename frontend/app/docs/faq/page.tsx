import type { Metadata } from "next";
import PublicPageShell from "@/components/marketing/PublicPageShell";
import {
	createPublicMetadata,
	faqPageJsonLd,
	faqs,
	publicMarketingPages,
} from "@/lib/marketing-seo";

const page = publicMarketingPages.find(item => item.path === "/docs/faq")!;

export const metadata: Metadata = createPublicMetadata(page);

export default function DocsFaqPage() {
	return (
		<PublicPageShell
			eyebrow="Docs"
			title="أسئلة شائعة عن تجارتك"
			description="إجابات مباشرة عن أكثر الأسئلة التي تهم أصحاب المحلات ومحركات البحث ووكلاء الذكاء الاصطناعي."
		>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd) }}
			/>
			<section className="space-y-4">
				{faqs.map(faq => (
					<article key={faq.question} className="rounded-2xl border border-brand-border bg-white p-6 shadow-soft">
						<h2 className="text-xl font-black text-brand-primary">{faq.question}</h2>
						<p className="mt-3 leading-8 text-muted-foreground">{faq.answer}</p>
					</article>
				))}
			</section>
		</PublicPageShell>
	);
}
