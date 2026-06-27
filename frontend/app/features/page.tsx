import type { Metadata } from "next";
import Link from "next/link";
import PublicPageShell from "@/components/marketing/PublicPageShell";
import { createPublicMetadata, getPublicMarketingPage } from "@/lib/marketing-seo";

const page = getPublicMarketingPage("/features");

export const metadata: Metadata = createPublicMetadata(page);

const features = [
	{
		title: "صفحة طلبات بسيطة",
		description:
			"شارك رابط متجرك مع العملاء، والعميل يختار المنتجات ويرسل الطلب بدون حساب.",
		href: "/features/order-management",
		linkText: "تعلم كيف يدير تجارتك الطلبات اليومية",
	},
	{
		title: "لوحة تحكم للبائع",
		description:
			"تابع الطلبات الجديدة، حالة كل طلب، بيانات العميل، والمنتجات المطلوبة من شاشة واحدة.",
		href: "/features/order-management",
		linkText: "اقرأ عن لوحة تحكم الطلبات",
	},
	{
		title: "تنظيم المنتجات والعملاء",
		description:
			"أضف منتجاتك واحتفظ ببيانات العملاء والطلبات السابقة بطريقة تساعدك في التشغيل اليومي.",
		href: "/features/customer-list",
		linkText: "اعرف أكثر عن قائمة العملاء",
	},
	{
		title: "تنبيهات واتساب",
		description:
			"استخدم واتساب للتنبيه عند وصول طلب جديد أو تغير حالة الطلب بدلاً من متابعة رسائل كثيرة يدوياً.",
		href: "/contact",
		linkText: "اسأل عن تفعيل تنبيهات واتساب",
	},
] as const;

export default function FeaturesPage() {
	return (
		<PublicPageShell
			eyebrow="المميزات"
			title="كل ما يحتاجه المحل لاستقبال الطلبات وتنظيمها"
			description="تجارتك يركز على الطلبات المباشرة من عملائك، بدون سوق عام وبدون عمولة على الطلبات."
		>
			<section className="grid gap-5 md:grid-cols-2">
				{features.map(feature => (
					<article
						key={feature.title}
						className="rounded-2xl border border-brand-border bg-white p-6 shadow-soft"
					>
						<h2 className="text-2xl font-black text-brand-primary">{feature.title}</h2>
						<p className="mt-3 leading-8 text-muted-foreground">
							{feature.description}
						</p>
						<Link
							href={feature.href}
							className="mt-5 inline-flex font-bold text-brand-primary hover:text-brand-accent"
						>
							{feature.linkText}
						</Link>
					</article>
				))}
			</section>
			<section className="rounded-2xl border border-brand-border bg-brand-soft p-6 shadow-soft">
				<h2 className="text-2xl font-black text-brand-text">ما الذي لا يفعله تجارتك؟</h2>
				<p className="mt-3 leading-8 text-muted-foreground">
					تجارتك ليس ماركت بليس، وليس شركة دفع، وليس بديلًا معقدًا لنظام تجارة إلكترونية كبير. هو أداة عملية للمحل الذي يريد رابط طلبات ولوحة متابعة.
				</p>
			</section>
		</PublicPageShell>
	);
}
