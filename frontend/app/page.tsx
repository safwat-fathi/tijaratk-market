import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

const pricingPlans = [
	{
		name: "الباقة المجانية",
		price: "مجانًا",
		description: "ابدأ تجارتك الأونلاين بدون أي تكاليف",
		features: ["متجر أونلاين", "١٠٠ طلب في الشهر", "عدد منتجات غير محدود"],
		buttonText: "ابدأ مجاناً",
		highlighted: false,
	},
	{
		name: "الباقة الأساسية",
		price: "١٩٩",
		currency: "جنيه/شهر",
		description: "للمتاجر النامية التي تحتاج لمتابعة أفضل",
		features: [
			"عدد منتجات غير محدود",
			"عدد طلبات غير محدود",
			"تقارير يومية",
			"خدمة عملاء سريعة",
			"تعديلات واجهة المتجر (ألوان المتجر، شعار المتجر)",
		],
		buttonText: "اشترك الآن",
		highlighted: false,
	},
	{
		name: "الباقة الكاملة",
		price: "٥٩٩",
		currency: "جنيه/شهر",
		description: "لكل ما تحتاجه للنمو والظهور بقوة",
		features: [
			"كل ما في الباقة الأساسية",
			"سجل وتقارير للعملاء (أسماء، أرقام، عناوين, الطلبات السابقة)",
			"ابعت عروض لعملاءك بسهولة",
			"خدمة عملاء VIP",
			"ظهور متجرك على جوجل (صفحة نشاط تجاري، خرائط، ربط واتساب)",
		],
		buttonText: "اشترك الآن",
		highlighted: true,
	},
	{
		name: "الباقة الذهبية",
		price: "٦٩٩",
		currency: "جنيه للفرع الأول / شهر",
		subPrice: "٢٩٩ جنيه لكل فرع إضافي",
		description: "للمتاجر ذات الفروع المتعددة والإدارة الذكية",
		features: [
			"كل ما في الباقة الكاملة",
			"إدارة فروع",
			"إضافة اكثر من حساب لإدارة متجرك (مديرين، مديرين فروع)",
			"تقارير متقدمة (العملاء المتكررين، متابعة مخزون، منتجات أكثر طلبا)",
			"مساعد ذكي AI لإدارة حسابك (اقتراحات، تقارير، كتابة عروض)",
		],
		buttonText: "تواصل معنا للاشتراك",
		highlighted: true,
	},
];

const features = [
	{
		title: "الطلبات بتضيع وسط الرسايل؟",
		description:
			"كل طلب بيوصلك بشكل منظم وواضح، بيانات العميل والمنتجات والعنوان في مكان واحد.",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="h-6 w-6 text-brand-primary"
			>
				<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
			</svg>
		),
	},
	{
		title: "العميل يغير الطلب أكتر من مرة؟",
		description:
			"وفر وقت الشرح، لينك واحد فيه كل حاجتك والعميل بيختار اللي عاوزه ويثبت طلبه.",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="h-6 w-6 text-brand-primary"
			>
				<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
				<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
				<path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
				<path d="M2 7h20" />
				<path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7" />
			</svg>
		),
	},
	{
		title: "مش عارف حسابات اليوم؟",
		description:
			"تقارير يومية مفصلة بتعرفك إجمالي المبيعات والطلبات اللي اتنفذت.",
		icon: (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="h-6 w-6 text-brand-primary"
			>
				<path d="M3 3v18h18" />
				<path d="m19 9-5 5-4-4-3 3" />
			</svg>
		),
	},
];

export default function LandingPage() {
	return (
		<div
			className="flex min-h-screen flex-col bg-background font-sans"
			dir="rtl"
		>
			{/* Header */}
			<header className="sticky top-0 z-50 w-full border-b border-brand-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
					<div className="flex items-center gap-2">
						<Logo
							variant="icon"
							width={32}
							height={32}
							className="rounded-md"
						/>
						<span className="text-xl font-bold text-brand-text">تجارتك</span>
					</div>
					<div className="flex items-center gap-3">
						<Link
							href="/merchant/login"
							className="text-sm font-semibold text-brand-text transition-colors hover:text-brand-primary"
						>
							تسجيل الدخول
						</Link>
						<Link
							href="/merchant/login"
							className="inline-flex h-9 items-center justify-center rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50"
						>
							ابدأ الآن
						</Link>
					</div>
				</div>
			</header>

			<main className="flex-1">
				{/* Hero Section */}
				<section className="relative overflow-hidden py-20 sm:py-32 lg:pb-32 xl:pb-36">
					<div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
						<div className="mx-auto max-w-3xl text-center">
							<h1 className="text-4xl font-extrabold tracking-tight text-brand-text sm:text-5xl lg:text-6xl">
								نظّم طلباتك على{" "}
								<span className="text-brand-primary">واتساب</span> بسهولة
							</h1>
							<p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
								استقبل الطلبات بشكل منظم بدل رسايل الواتساب الكتير والمكالمات
								اللي بتتلخبط. وفر وقتك وكبّر تجارتك مع متجر إلكتروني متكامل.
							</p>
							<div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
								<Link
									href="/merchant/login"
									className="inline-flex h-12 w-full items-center justify-center rounded-md bg-brand-primary px-8 text-base font-semibold text-white shadow-soft transition-colors hover:bg-brand-primary-hover sm:w-auto"
								>
									أنشئ متجرك مجاناً
								</Link>
								<Link
									href="#pricing"
									className="inline-flex h-12 w-full items-center justify-center rounded-md border border-brand-border bg-white px-8 text-base font-semibold text-brand-text shadow-sm transition-colors hover:bg-muted/50 sm:w-auto"
								>
									عرض الباقات
								</Link>
							</div>
						</div>
					</div>
				</section>

				{/* Features / Problem Section */}
				<section className="bg-brand-soft/30 py-20 sm:py-32">
					<div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
						<div className="mx-auto max-w-2xl text-center">
							<h2 className="text-3xl font-bold tracking-tight text-brand-text sm:text-4xl">
								تجارتك بتنظم الشغل بدل اللخبطة
							</h2>
							<p className="mt-4 text-lg text-muted-foreground">
								إيه المشاكل اللي بنحلها؟ الطلبات اللي بتضيع، والتغييرات الكتير،
								والحسابات اللي مش واضحة.
							</p>
						</div>
						<div className="mx-auto mt-16 max-w-5xl sm:mt-20">
							<div className="grid grid-cols-1 gap-8 md:grid-cols-3">
								{features.map((feature, index) => (
									<div
										key={index}
										className="relative rounded-2xl border border-brand-border/50 bg-white p-8 shadow-sm"
									>
										<div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft">
											{feature.icon}
										</div>
										<h3 className="mb-3 text-xl font-bold text-brand-text">
											{feature.title}
										</h3>
										<p className="text-muted-foreground leading-relaxed">
											{feature.description}
										</p>
									</div>
								))}
							</div>
						</div>
					</div>
				</section>

				{/* Pricing Section */}
				<section id="pricing" className="py-20 sm:py-32">
					<div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
						<div className="mx-auto max-w-3xl text-center">
							<h2 className="text-3xl font-bold tracking-tight text-brand-text sm:text-4xl">
								خطط التسعير
							</h2>
							<p className="mt-4 text-lg text-muted-foreground">
								اختر الباقة اللي تناسب حجم تجارتك وابدأ في النمو.
							</p>
						</div>

						<div className="mx-auto mt-16 grid max-w-7xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
							{pricingPlans.map((plan, index) => (
								<div
									key={index}
									className={`relative flex flex-col rounded-3xl p-8 shadow-sm ring-1 sm:p-10 ${
										plan.highlighted
											? "bg-brand-text text-white ring-brand-text"
											: "bg-white text-brand-text ring-brand-border/80"
									}`}
								>
									{plan.highlighted && index === 2 && (
										<div className="absolute -top-4 left-0 right-0 mx-auto w-fit rounded-full bg-brand-primary px-4 py-1 text-xs font-semibold text-white">
											الأكثر طلباً
										</div>
									)}
									{plan.highlighted && index === 3 && (
										<div className="absolute -top-4 left-0 right-0 mx-auto w-fit rounded-full bg-yellow-500 px-4 py-1 text-xs font-semibold text-white">
											للمتاجر الكبرى
										</div>
									)}
									<h3
										className={`text-xl font-semibold ${plan.highlighted ? "text-white" : "text-brand-text"}`}
									>
										{plan.name}
									</h3>
									<div className="mt-4 flex items-baseline gap-x-2">
										<span
											className={`text-4xl font-bold tracking-tight ${plan.highlighted ? "text-white" : "text-brand-text"}`}
										>
											{plan.price}
										</span>
										{plan.currency && (
											<span
												className={`text-sm font-semibold leading-6 ${plan.highlighted ? "text-gray-300" : "text-muted-foreground"}`}
											>
												{plan.currency}
											</span>
										)}
									</div>
									{plan.subPrice && (
										<p
											className={`mt-2 text-sm ${plan.highlighted ? "text-gray-300" : "text-muted-foreground"}`}
										>
											{plan.subPrice}
										</p>
									)}
									<p
										className={`mt-6 text-sm leading-6 ${plan.highlighted ? "text-gray-300" : "text-muted-foreground"}`}
									>
										{plan.description}
									</p>
									<ul
										role="list"
										className={`mt-8 space-y-3 text-sm leading-6 sm:mt-10 ${
											plan.highlighted
												? "text-gray-300"
												: "text-muted-foreground"
										} flex-1`}
									>
										{plan.features.map((feature, featureIndex) => (
											<li key={featureIndex} className="flex gap-x-3">
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="24"
													height="24"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="2"
													strokeLinecap="round"
													strokeLinejoin="round"
													className={`h-6 w-5 flex-none text-brand-primary`}
													aria-hidden="true"
												>
													<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
													<path d="m9 11 3 3L22 4" />
												</svg>
												{feature}
											</li>
										))}
									</ul>
									<Link
										href="/merchant/login"
										className={`mt-8 block rounded-md px-3 py-3 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
											plan.highlighted
												? "bg-brand-primary text-white hover:bg-brand-primary-hover focus-visible:outline-brand-primary"
												: "bg-brand-soft text-brand-primary hover:bg-brand-soft/80 ring-1 ring-inset ring-brand-primary/20"
										}`}
									>
										{plan.buttonText}
									</Link>
								</div>
							))}
						</div>
					</div>
				</section>
			</main>

			{/* Footer */}
			<footer className="border-t border-brand-border/40 bg-white py-12">
				<div className="container mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
					<div className="flex items-center gap-2">
						<Logo
							variant="icon"
							width={24}
							height={24}
							className="rounded-md opacity-80"
						/>
						<span className="text-lg font-bold text-muted-foreground">
							تجارتك
						</span>
					</div>
					<p className="text-sm text-muted-foreground">
						© {new Date().getFullYear()} جميع الحقوق محفوظة لـ{" "}
						<span className="text-brand-primary font-bold">تجارتك</span>.
					</p>
				</div>
			</footer>
		</div>
	);
}
