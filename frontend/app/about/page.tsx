import type { Metadata } from "next";
import Link from "next/link";
import { createPublicMetadata, publicMarketingPages } from "@/lib/marketing-seo";

const page = publicMarketingPages.find(item => item.path === "/about")!;

export const metadata: Metadata = createPublicMetadata(page);

const valuePoints = [
	{
		title: "طلباتك في شاشة واحدة",
		description: "تابع حالة كل طلب بسرعة، من الاستلام حتى التسليم.",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="h-5 w-5"
				aria-hidden="true"
			>
				<path d="M8 6h13" />
				<path d="M8 12h13" />
				<path d="M8 18h13" />
				<path d="M3 6h.01" />
				<path d="M3 12h.01" />
				<path d="M3 18h.01" />
			</svg>
		),
	},
	{
		title: "إدارة منتجات بدون تعقيد",
		description: "أضف منتجاتك وعدلها بوضوح، مع تنظيم مناسب لكل متجر.",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="h-5 w-5"
				aria-hidden="true"
			>
				<path d="M21 8a2 2 0 0 0-1.1-1.8l-7-3.5a2 2 0 0 0-1.8 0l-7 3.5A2 2 0 0 0 3 8v8a2 2 0 0 0 1.1 1.8l7 3.5a2 2 0 0 0 1.8 0l7-3.5A2 2 0 0 0 21 16Z" />
				<path d="m3.3 7 8.7 4.5L20.7 7" />
				<path d="M12 22V11.5" />
			</svg>
		),
	},
	{
		title: "تجربة عميل أوضح",
		description: "خلي العميل يعرف حالة طلبه بسهولة ويكمل معك بثقة.",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="h-5 w-5"
				aria-hidden="true"
			>
				<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
				<circle cx="9" cy="7" r="4" />
				<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
				<path d="M16 3.13a4 4 0 0 1 0 7.75" />
			</svg>
		),
	},
];

const steps = [
	"أنشئ حسابك وأدخل بيانات متجرك الأساسية.",
	"اختر نشاط متجرك: بقالة، خضروات وفواكه، جزارة، مخبز، صيدلية أو أخرى.",
	"أضف منتجاتك وشارك رابط الطلب مع عملائك.",
	"عند وصول طلب جديد، تستقبل إشعاراً مباشراً على واتساب المتجر.",
	"تابع الطلب من لوحة التحكم وحدّث حالته حتى التسليم.",
];

const supportedStoreTypes = [
	"بقالة",
	"خضروات وفواكه",
	"جزارة",
	"مخبز",
	"صيدلية",
	"أخرى",
];

const whatsappHighlights = [
	"تنبيه فوري للتاجر عند وصول طلب جديد.",
	"تنبيهات تشغيل مرتبطة بحالة الطلبات خلال اليوم.",
	"إشعارات حالة للعميل حتى يفضل متابع مع المتجر بثقة.",
];

export default function AboutPage() {
	return (
		<main className="relative isolate min-h-screen overflow-hidden bg-background px-4 py-10 sm:px-6 sm:py-14">
			<div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-brand-soft/70" />
			<div className="pointer-events-none absolute -left-16 top-24 -z-10 h-56 w-56 rounded-full bg-brand-accent/10 blur-3xl" />
			<div className="pointer-events-none absolute -right-16 bottom-20 -z-10 h-56 w-56 rounded-full bg-brand-primary/10 blur-3xl" />

			<div className="mx-auto w-full max-w-5xl space-y-8 sm:space-y-10">
				<nav className="flex flex-wrap gap-4 rounded-xl border border-brand-border bg-white/90 p-4 text-sm font-semibold text-brand-primary shadow-soft">
					<Link href="/features">تعرف على مميزات تجارتك لإدارة الطلبات</Link>
					<Link href="/pricing">راجع أسعار تجارتك بدون عمولة</Link>
					<Link href="/docs/faq">اقرأ الأسئلة الشائعة عن تجارتك</Link>
					<Link href="/contact">تواصل مع فريق تجارتك</Link>
				</nav>
				<section className="animate-fade-in rounded-xl border border-brand-border/90 bg-white/90 p-6 shadow-soft backdrop-blur-sm sm:p-8">
					<p className="text-xs font-bold tracking-[0.16em] text-muted-foreground">
						عن تجارتك
					</p>
					<h1 className="mt-3 max-w-2xl text-3xl font-black leading-tight text-brand-text sm:text-4xl">
						تجارتك منصة تساعدك تدير متجرك اليومي من مكان واحد.
					</h1>
					<p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
						تنظيم الطلبات، متابعة المنتجات، والتواصل مع العميل بشكل واضح من
						أول يوم.
					</p>
					<div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
						<Link
							href="/merchant/register"
							className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand-primary px-5 py-3 text-sm font-bold text-white shadow-soft transition-colors hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
						>
							سجل متجرك الآن
						</Link>
						<Link
							href="/merchant/login"
							className="inline-flex min-h-11 items-center justify-center rounded-md px-4 py-3 text-sm font-semibold text-brand-primary transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
						>
							عندك حساب؟ سجل دخول
						</Link>
					</div>
				</section>

				<section
					aria-labelledby="about-store-types"
					className="animate-slide-up rounded-xl border border-brand-border bg-white p-5 shadow-soft sm:p-7"
				>
					<h2
						id="about-store-types"
						className="text-xl font-extrabold text-brand-text sm:text-2xl"
					>
						هل متجرك مناسب؟
					</h2>
					<p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
						تقدر تسجل إذا كان متجرك ضمن الأنشطة التالية، ولو نشاطك مختلف لكنه
						محلي وتستقبل طلبات مباشرة، ابدأ تحت فئة أخرى.
					</p>
					<ul className="mt-4 flex flex-wrap gap-2">
						{supportedStoreTypes.map(type => (
							<li
								key={type}
								className="inline-flex items-center rounded-full border border-brand-border bg-brand-soft px-3 py-1.5 text-sm font-semibold text-brand-primary"
							>
								{type}
							</li>
						))}
					</ul>
				</section>

				<section
					aria-labelledby="about-value-points"
					className="animate-slide-up space-y-4"
				>
					<h2
						id="about-value-points"
						className="text-xl font-extrabold text-brand-text sm:text-2xl"
					>
						المهم لك كصاحب متجر
					</h2>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{valuePoints.map(point => (
							<article
								key={point.title}
								className="rounded-lg border border-brand-border bg-white p-4 shadow-soft transition-transform hover:-translate-y-0.5"
							>
								<div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-brand-primary">
									{point.icon}
								</div>
								<h3 className="text-base font-bold text-brand-text">{point.title}</h3>
								<p className="mt-1 text-sm leading-6 text-muted-foreground">
									{point.description}
								</p>
							</article>
						))}
					</div>
				</section>

				<section
					aria-labelledby="about-how-it-works"
					className="animate-slide-up rounded-xl border border-brand-border bg-white p-5 shadow-soft sm:p-7"
				>
					<h2
						id="about-how-it-works"
						className="text-xl font-extrabold text-brand-text sm:text-2xl"
					>
						كيف تبدأ بسرعة
					</h2>
					<ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
						{steps.map((step, index) => (
							<li
								key={step}
								className="rounded-lg border border-brand-border bg-brand-soft/60 p-4"
							>
								<span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
									{index + 1}
								</span>
								<p className="mt-3 text-sm leading-6 text-brand-text">{step}</p>
							</li>
						))}
					</ol>
				</section>

				<section
					aria-labelledby="about-whatsapp-flow"
					className="animate-fade-in rounded-xl border border-brand-accent/20 bg-brand-soft/70 p-5 shadow-soft sm:p-6"
				>
					<h2
						id="about-whatsapp-flow"
						className="text-lg font-extrabold text-brand-text sm:text-xl"
					>
						واتساب في التشغيل اليومي
					</h2>
					<p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
						واتساب هنا جزء عملي من التشغيل، ليس مجرد قناة إضافية.
					</p>
					<ul className="mt-4 space-y-2">
						{whatsappHighlights.map(item => (
							<li
								key={item}
								className="flex items-start gap-2 text-sm leading-6 text-brand-text"
							>
								<span
									className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-accent"
									aria-hidden="true"
								/>
								<span>{item}</span>
							</li>
						))}
					</ul>
				</section>

				<section className="animate-fade-in rounded-xl border border-brand-border bg-brand-soft p-6 shadow-soft sm:p-8">
					<h2 className="text-xl font-extrabold text-brand-text sm:text-2xl">
						ابدأ بخطوة واضحة اليوم
					</h2>
					<p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
						سجل متجرك وابدأ استقبال الطلبات وتنبيهات واتساب من أول يوم تشغيل.
					</p>
					<div className="mt-5">
						<Link
							href="/merchant/register"
							className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand-primary px-5 py-3 text-sm font-bold text-white shadow-soft transition-colors hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
						>
							ابدأ التسجيل
						</Link>
					</div>
				</section>
			</div>
		</main>
	);
}
