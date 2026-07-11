import type { Metadata } from "next";
import Link from "next/link";
import PublicPageShell from "@/components/marketing/PublicPageShell";
import { createPublicMetadata, getPublicMarketingPage } from "@/lib/marketing-seo";

const page = getPublicMarketingPage("/contact");

export const metadata: Metadata = createPublicMetadata(page);

export default function ContactPage() {
	return (
		<PublicPageShell
			eyebrow="تواصل معنا"
			title="اسأل فريق تجارتك عن بدء استقبال الطلبات أونلاين"
			description="لو عندك محل في مصر وتريد الانضمام إلى تجارتك، أرسل بيانات متجرك وسيتواصل معك الفريق لمراجعة النشاط والمستندات القانونية."
		>
			<section className="grid gap-5 md:grid-cols-2">
				<article className="rounded-2xl border border-brand-border bg-white p-6 shadow-soft">
					<h2 className="text-2xl font-black text-brand-primary">قدّم طلب انضمام</h2>
					<p className="mt-3 leading-8 text-muted-foreground">
						أدخل بيانات متجرك الأساسية. سيراجع الفريق الطلب ويتواصل معك لطلب المستندات القانونية قبل اعتماد الحساب.
					</p>
					<Link
						href="/merchant/register"
						className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-brand-primary px-5 py-3 text-sm font-bold text-white hover:bg-brand-primary-hover"
					>
						أرسل طلب متجرك
					</Link>
				</article>
				<article className="rounded-2xl border border-brand-border bg-white p-6 shadow-soft">
					<h2 className="text-2xl font-black text-brand-primary">محتاج مساعدة؟</h2>
					<p className="mt-3 leading-8 text-muted-foreground">
						استخدم قنوات الدعم الموجودة في صفحة طلب الانضمام أو تسجيل الدخول للاستفسار عن حالة المراجعة.
					</p>
					<Link href="/about" className="mt-5 inline-flex font-bold text-brand-primary hover:text-brand-accent">
						اقرأ أكثر عن تجارتك قبل التواصل
					</Link>
				</article>
			</section>
		</PublicPageShell>
	);
}
