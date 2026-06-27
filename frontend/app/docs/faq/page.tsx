import type { Metadata } from "next";
import PublicPageShell from "@/components/marketing/PublicPageShell";
import JsonLd from "@/components/seo/JsonLd";
import {
	createPublicMetadata,
	faqPageJsonLd,
	faqs,
	getPublicMarketingPage,
} from "@/lib/marketing-seo";

const page = getPublicMarketingPage("/docs/faq");

export const metadata: Metadata = createPublicMetadata(page);

export default function DocsFaqPage() {
	return (
		<PublicPageShell
			eyebrow="Docs"
			title="أسئلة شائعة عن تجارتك"
			description="إجابات مباشرة عن أكثر الأسئلة التي تهم أصحاب المحلات ومحركات البحث ووكلاء الذكاء الاصطناعي."
		>
			<JsonLd id="docs-faq-jsonld" data={faqPageJsonLd} />
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
