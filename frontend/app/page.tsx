import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import Image from "next/image";
import heroMockup from "@/public/images/hero-mockup.png";

const pricingPlans = [
	{
		name: "الباقة الأساسية",
		originalPrice: "١٩٩",
		currency: "جنيه/شهر",
		promoPrice: "٠",
		promoText: "أول شهرين مجاناً",
		afterPromoText: "ثم ١٩٩ جنيه/شهر بعد ذلك",
		description: "للمتاجر النامية التي تحتاج لمتابعة أفضل",
		features: [
			"عدد منتجات غير محدود",
			"عدد طلبات غير محدود",
			"تقارير يومية",
			"خدمة عملاء سريعة",
			"تعديلات واجهة المتجر (ألوان المتجر، شعار المتجر)",
		],
		buttonText: "ابدأ فترة التجربة",
		highlighted: false,
	},
	{
		name: "الباقة الكاملة",
		originalPrice: "٥٩٩",
		currency: "جنيه/شهر",
		promoPrice: "٠",
		promoText: "أول شهرين مجاناً",
		afterPromoText: "ثم ٥٩٩ جنيه/شهر بعد ذلك",
		description: "لكل ما تحتاجه للنمو والظهور بقوة",
		features: [
			"كل ما في الباقة الأساسية",
			"سجل وتقارير للعملاء (أسماء، أرقام، عناوين, الطلبات السابقة)",
			"ابعت عروض لعملاءك بسهولة",
			"خدمة عملاء VIP",
			"ظهور متجرك على جوجل (صفحة نشاط تجاري، خرائط، ربط واتساب)",
		],
		buttonText: "ابدأ فترة التجربة",
		highlighted: true,
	},
	{
		name: "باقة الفروع",
		originalPrice: "٦٩٩",
		currency: "جنيه للفرع الأول / شهر",
		subPrice: "٢٩٩ جنيه لكل فرع إضافي بعد الفترة المجانية",
		promoPrice: "٠",
		promoText: "أول شهرين مجاناً",
		afterPromoText: "ثم ٦٩٩ جنيه للفرع الأول / شهر بعد ذلك",
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

const SVGCheckCircle = ({ className }: { className?: string }) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
	>
		<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
		<path d="m9 11 3 3L22 4" />
	</svg>
);

export default function LandingPage() {
	return (
		<div
			className="flex min-h-screen flex-col font-sans bg-[#F7F8F6]"
			dir="rtl"
		>
			{/* Header */}
			<header className="sticky top-0 z-50 w-full bg-white shadow-sm">
				<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
					<div className="flex items-center gap-2">
						<Logo
							variant="icon"
							width={32}
							height={32}
							className="rounded-md"
						/>
						<span className="text-xl font-bold text-[#0F5A3D]">تجارتك</span>
					</div>
					<div className="flex items-center gap-4">
						<Link
							href="/merchant/login"
							className="text-sm font-semibold text-[#0F5A3D] transition-colors hover:text-[#27AE60]"
						>
							تسجيل الدخول
						</Link>
						<Link
							href="/merchant/login"
							className="inline-flex h-10 items-center justify-center rounded-full bg-[#0F5A3D] px-5 text-sm font-bold text-white transition-colors hover:bg-[#00412a]"
						>
							ابدأ الآن
						</Link>
					</div>
				</div>
			</header>

			<main className="flex-1">
				{/* Hero Section */}
				<section className="bg-[#0F5A3D] px-4 pt-12 pb-12 sm:pt-20 sm:pb-20 lg:pt-28 lg:pb-28 lg:px-8">
					<div className="mx-auto max-w-7xl flex flex-col-reverse lg:flex-row items-center justify-between gap-12 lg:gap-20">
						{/* Text Content */}
						<div className="flex-1 text-center lg:text-right max-w-2xl lg:max-w-xl">
							<h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
								نظّم طلباتك على <span className="text-[#27AE60]">واتساب</span>{" "}
								بسهولة
							</h1>
							<p className="mx-auto lg:mx-0 mt-6 max-w-2xl text-lg leading-relaxed text-white/90">
								استقبل الطلبات بشكل منظم بدل رسايل الواتساب الكتير والمكالمات اللي
								بتتلخبط. وفر وقتك وكبّر تجارتك مع متجر إلكتروني متكامل.
							</p>

							<div className="mt-8 flex justify-center lg:justify-start">
								<Link
									href="/merchant/login"
									className="inline-flex h-14 w-full sm:w-auto min-w-[200px] items-center justify-center rounded-2xl bg-[#27AE60] px-8 text-xl font-bold text-white transition-colors hover:bg-[#219653]"
								>
									أنشئ متجرك مجاناً
								</Link>
							</div>

							{/* Trust Badges */}
							<div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 text-sm font-medium text-white/90">
								<div className="flex items-center gap-1.5">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<circle cx="12" cy="12" r="10"></circle>
										<path d="m9 12 2 2 4-4"></path>
									</svg>
									بدون عمولة
								</div>
								<div className="flex items-center gap-1.5">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
										<line x1="12" y1="18" x2="12.01" y2="18"></line>
									</svg>
									يشتغل من الموبايل
								</div>
								<div className="flex items-center gap-1.5">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<circle cx="12" cy="12" r="10"></circle>
										<path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
										<line x1="9" y1="9" x2="9.01" y2="9"></line>
										<line x1="15" y1="9" x2="15.01" y2="9"></line>
									</svg>
									سهل الاستخدام
								</div>
							</div>
						</div>

						{/* Image Wrapper */}
						<div className="flex-1 flex justify-center lg:justify-end w-full">
							<Image
								alt="Merchant using mobile app"
								className="rounded-xl custom-shadow w-full max-w-sm lg:max-w-md"
								src={heroMockup}
								placeholder="blur"
								sizes="(max-width: 640px) 100vw, (max-width: 1024px) 384px, 448px"
								loading="lazy"
							/>
						</div>
					</div>
				</section>

				{/* Problems Section */}
				<section className="bg-[#F7F8F6] px-4 py-16 sm:py-24 lg:px-8">
					<div className="mx-auto max-w-5xl">
						<h2 className="mb-12 text-center text-3xl font-bold text-[#222B2E] sm:text-4xl">
							إيه المشاكل اللي بنحلها؟
						</h2>
						<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
							{/* Card 1 */}
							<div className="flex flex-col items-center rounded-2xl bg-white p-8 text-center shadow-sm border border-gray-100">
								<div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="32"
										height="32"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
										<polyline points="14 2 14 8 20 8"></polyline>
										<line x1="9.5" y1="12.5" x2="14.5" y2="17.5"></line>
										<line x1="14.5" y1="12.5" x2="9.5" y2="17.5"></line>
									</svg>
								</div>
								<h3 className="text-xl font-bold text-[#222B2E]">
									الطلبات بتضيع وسط الرسايل
								</h3>
							</div>

							{/* Card 2 */}
							<div className="flex flex-col items-center rounded-2xl bg-white p-8 text-center shadow-sm border border-gray-100">
								<div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="32"
										height="32"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M12 20h9"></path>
										<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
									</svg>
								</div>
								<h3 className="text-xl font-bold text-[#222B2E]">
									العميل يغير الطلب أكتر من مرة
								</h3>
							</div>

							{/* Card 3 */}
							<div className="flex flex-col items-center rounded-2xl bg-white p-8 text-center shadow-sm border border-gray-100">
								<div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="32"
										height="32"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path>
										<path d="M4 6v12c0 1.1.9 2 2 2h14v-4"></path>
										<path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"></path>
									</svg>
								</div>
								<h3 className="text-xl font-bold text-[#222B2E]">
									مش عارف حسابات اليوم راحت فين
								</h3>
							</div>
						</div>
					</div>
				</section>

				{/* Solutions Section */}
				<section className="bg-white px-4 py-16 sm:py-24 lg:px-8">
					<div className="mx-auto max-w-4xl">
						<div className="mb-12 text-center">
							<h2 className="inline-block text-3xl font-bold text-[#0F5A3D] sm:text-4xl border-b-4 border-[#27AE60] pb-2">
								تجارتك بتنظم الشغل بدل اللخبطة
							</h2>
						</div>

						<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
							{/* Solution 1 */}
							<div className="flex flex-col rounded-2xl bg-[#E8F5ED] p-8">
								<div className="mb-4 flex items-center gap-4">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="32"
										height="32"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
										className="text-[#0F5A3D] flex-none"
									>
										<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
										<rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
										<path d="M12 11h4"></path>
										<path d="M12 16h4"></path>
										<path d="M8 11h.01"></path>
										<path d="M8 16h.01"></path>
									</svg>
									<h3 className="text-xl font-bold text-[#0F5A3D]">
										كل طلب بيوصلك بشكل منظم وواضح
									</h3>
								</div>
								<p className="text-[#0F5A3D]/80 leading-relaxed mr-12">
									بيانات العميل، المنتجات، والعنوان كلهم في مكان واحد.
								</p>
							</div>

							{/* Solution 2 */}
							<div className="flex flex-col rounded-2xl bg-[#E8F5ED] p-8">
								<div className="mb-4 flex items-center gap-4">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="32"
										height="32"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
										className="text-[#0F5A3D] flex-none"
									>
										<path d="M22 14a8 8 0 0 1-8 8"></path>
										<path d="M18 11v-1a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path>
										<path d="M14 10V9a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v1"></path>
										<path d="M10 9.5V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v10"></path>
										<path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path>
									</svg>
									<h3 className="text-xl font-bold text-[#0F5A3D]">
										العميل يشوف المنتجات ويطلب بنفسه
									</h3>
								</div>
								<p className="text-[#0F5A3D]/80 leading-relaxed mr-12">
									وفر وقت الشرح، لينك واحد فيه كل حاجتك والعميل بيختار اللي
									عاوزه.
								</p>
							</div>

							{/* Solution 3 */}
							<div className="flex flex-col rounded-2xl bg-[#E8F5ED] p-8">
								<div className="mb-4 flex items-center gap-4">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="32"
										height="32"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
										className="text-[#0F5A3D] flex-none"
									>
										<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
										<path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9"></path>
										<path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1"></path>
									</svg>
									<h3 className="text-xl font-bold text-[#0F5A3D]">
										إشعارات واتساب ليك وللعميل
									</h3>
								</div>
								<p className="text-[#0F5A3D]/80 leading-relaxed mr-12">
									يوصلك تنبيه بأي طلب جديد أو تعديل، والعميل يعرف حالة طلبه أول
									بأول.
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* Pricing Section */}
				<section
					id="pricing"
					className="bg-[#F7F8F6] px-4 py-16 sm:py-24 lg:px-8"
				>
					<div className="mx-auto max-w-7xl">
						<div className="mx-auto max-w-3xl text-center">
							<h2 className="text-3xl font-bold tracking-tight text-[#222B2E] sm:text-4xl">
								خطط التسعير
							</h2>
							<p className="mt-4 text-lg text-[#222B2E]/70">
								اختر الباقة اللي تناسب حجم تجارتك وابدأ في النمو.
							</p>
						</div>

						<div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 justify-center">
							{pricingPlans.map((plan, index) => (
								<div
									key={index}
									className={`relative flex flex-col rounded-[2.5rem] p-8 md:p-10 shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-xl ${
										plan.highlighted
											? "bg-gradient-to-b from-[#0F5A3D] to-[#0A412A] text-white ring-4 ring-[#27AE60]/20"
											: "bg-white text-[#222B2E] border border-[#DDE5E1]"
									}`}
								>
									{/* Top Badge for Plan Highlight */}
									{plan.highlighted && index === 1 && (
										<div className="absolute -top-4 left-0 right-0 mx-auto w-fit rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-1.5 text-xs font-black text-white shadow-lg tracking-wider animate-pulse">
											الأكثر طلباً 🔥
										</div>
									)}
									{plan.highlighted && index === 2 && (
										<div className="absolute -top-4 left-0 right-0 mx-auto w-fit rounded-full bg-[#27AE60] px-5 py-1.5 text-xs font-black text-white shadow-lg tracking-wider">
											للمتاجر الكبرى 🏢
										</div>
									)}

									{/* Header & Promo Badge */}
									<div className="flex items-center justify-between gap-4 mb-4">
										<h3
											className={`text-2xl font-black ${
												plan.highlighted ? "text-white" : "text-[#0F5A3D]"
											}`}
										>
											{plan.name}
										</h3>
										<span
											className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border transition-colors ${
												plan.highlighted
													? "bg-[#27AE60]/20 text-[#27AE60] border-[#27AE60]/30"
													: "bg-[#E8F5ED] text-[#0F5A3D] border-[#27AE60]/20"
											}`}
										>
											🎁 {plan.promoText}
										</span>
									</div>

									{/* Pricing Section - Marketing Focused */}
									<div className="mt-4 flex flex-col">
										<div className="flex items-center gap-2 mb-1">
											<span
												className={`text-sm line-through font-medium ${
													plan.highlighted ? "text-white/50" : "text-[#222B2E]/50"
												}`}
											>
												{plan.originalPrice} {plan.currency}
											</span>
											<span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-500">
												توفير ١٠٠٪
											</span>
										</div>
										<div className="flex items-baseline gap-x-2">
											<span
												className={`text-5xl font-black tracking-tight ${
													plan.highlighted ? "text-[#27AE60]" : "text-[#0F5A3D]"
												}`}
											>
												مجانًا
											</span>
											<span
												className={`text-sm font-extrabold ${
													plan.highlighted ? "text-white/90" : "text-[#222B2E]/80"
												}`}
											>
												لأول شهرين
											</span>
										</div>
										<span
											className={`mt-2 text-xs font-bold leading-relaxed ${
												plan.highlighted ? "text-white/70" : "text-[#222B2E]/60"
											}`}
										>
											{plan.afterPromoText}
										</span>
										{plan.subPrice && (
											<p
												className={`mt-1.5 text-xs font-black ${
													plan.highlighted ? "text-[#27AE60]" : "text-[#27AE60]"
												}`}
											>
												{plan.subPrice}
											</p>
										)}
									</div>

									{/* Description */}
									<p
										className={`mt-6 text-sm leading-relaxed ${
											plan.highlighted ? "text-white/80" : "text-[#222B2E]/70"
										}`}
									>
										{plan.description}
									</p>

									{/* Features List */}
									<ul
										role="list"
										className={`mt-8 space-y-4 text-sm leading-6 flex-1 ${
											plan.highlighted ? "text-white/90" : "text-[#222B2E]/80"
										}`}
									>
										{plan.features.map((feature, featureIndex) => (
											<li key={featureIndex} className="flex gap-x-3 items-start">
												<SVGCheckCircle
													className={`h-5 w-5 flex-none mt-0.5 ${
														plan.highlighted ? "text-[#27AE60]" : "text-[#27AE60]"
													}`}
												/>
												<span>{feature}</span>
											</li>
										))}
									</ul>

									{/* CTA Link */}
									<Link
										href="/merchant/login"
										className={`mt-8 block w-full rounded-2xl px-4 py-4 text-center text-sm font-black transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md ${
											plan.highlighted
												? "bg-[#27AE60] text-white hover:bg-[#219653] hover:shadow-[#27AE60]/20"
												: "bg-[#E8F5ED] text-[#0F5A3D] hover:bg-[#D1EBDC]"
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
			<footer className="bg-white py-12 border-t border-gray-100">
				<div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
					<div className="flex items-center gap-2">
						<Logo
							variant="icon"
							width={24}
							height={24}
							className="rounded-md opacity-80"
						/>
						<span className="text-lg font-bold text-[#0F5A3D]">تجارتك</span>
					</div>
					<p className="text-sm font-medium text-[#222B2E]/60">
						© {new Date().getFullYear()} جميع الحقوق محفوظة لـ{" "}
						<span className="text-[#0F5A3D] font-bold">تجارتك</span>.
					</p>
				</div>
			</footer>
		</div>
	);
}
