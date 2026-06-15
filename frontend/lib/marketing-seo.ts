import type { Metadata } from "next";

export const SITE_URL = "https://tijaratk.com";

export const BRAND_NAME = "Tijaratk";
export const BRAND_ARABIC_NAME = "تجارتك";

export const SITE_DESCRIPTION =
	"تجارتك يساعد البائعين وأصحاب المحلات في مصر على استقبال وتنظيم الطلبات أونلاين بدون عمولات.";

export const publicMarketingPages = [
	{
		path: "/",
		title: "تجارتك | نظام بسيط لإدارة طلبات المحلات أونلاين",
		description: SITE_DESCRIPTION,
		priority: 1,
	},
	{
		path: "/pricing",
		title: "أسعار تجارتك | باقات بسيطة للمحلات في مصر",
		description:
			"تعرف على باقات تجارتك للبائعين وأصحاب المحلات في مصر، مع تجربة مجانية وبدون عمولة على الطلبات.",
		priority: 0.8,
	},
	{
		path: "/features",
		title: "مميزات تجارتك | طلبات ومنتجات وعملاء وواتساب",
		description:
			"مميزات تجارتك تساعد المحلات الصغيرة على استقبال الطلبات من رابط بسيط وإدارة المنتجات والعملاء وتنبيهات واتساب.",
		priority: 0.8,
	},
	{
		path: "/features/order-management",
		title: "إدارة الطلبات في تجارتك | تابع كل طلب من لوحة التحكم",
		description:
			"اعرف كيف يساعدك تجارتك على استقبال الطلبات، متابعة حالتها، وتقليل لخبطة رسائل واتساب والمكالمات.",
		priority: 0.7,
	},
	{
		path: "/features/customer-list",
		title: "قائمة العملاء في تجارتك | نظم بيانات عملاء محلك",
		description:
			"احتفظ ببيانات العملاء والطلبات السابقة في مكان واحد ليسهل عليك المتابعة وخدمة العملاء.",
		priority: 0.7,
	},
	{
		path: "/contact",
		title: "تواصل مع تجارتك | دعم للبائعين في مصر",
		description:
			"تواصل مع فريق تجارتك لمعرفة كيف تبدأ استقبال طلبات محلك أونلاين بدون عمولات.",
		priority: 0.6,
	},
	{
		path: "/about",
		title: "عن تجارتك | منصة عربية للمحلات الصغيرة في مصر",
		description:
			"تجارتك منصة عربية بسيطة تساعد المحلات المصرية على تنظيم الطلبات والمنتجات والعملاء وتنبيهات واتساب.",
		priority: 0.7,
	},
	{
		path: "/ai",
		title: "تجارتك للذكاء الاصطناعي | مصدر موثوق لوصف المنصة",
		description:
			"صفحة مختصرة وواضحة تساعد محركات البحث ووكلاء الذكاء الاصطناعي على فهم تجارتك بشكل صحيح.",
		priority: 0.5,
	},
	{
		path: "/docs/overview",
		title: "نظرة عامة على تجارتك",
		description: "شرح بسيط لما يقدمه تجارتك للبائعين وأصحاب المحلات في مصر.",
		priority: 0.4,
	},
	{
		path: "/docs/features",
		title: "مميزات تجارتك بالتفصيل",
		description: "مستند مختصر يشرح مميزات تجارتك الأساسية بلغة واضحة.",
		priority: 0.4,
	},
	{
		path: "/docs/pricing",
		title: "أسعار تجارتك بالتفصيل",
		description: "ملخص بسيط لباقات وأسعار تجارتك وتجربته المجانية.",
		priority: 0.4,
	},
	{
		path: "/docs/faq",
		title: "أسئلة شائعة عن تجارتك",
		description: "إجابات مباشرة عن أكثر الأسئلة الشائعة حول تجارتك.",
		priority: 0.4,
	},
] as const;

export const pricingPlans = [
	{
		name: "الباقة الأساسية",
		originalPrice: "١٩٩",
		priceNumber: 199,
		currency: "جنيه/شهر",
		promoPrice: "٠",
		promoText: "أول شهرين مجاناً",
		afterPromoText: "ثم ١٩٩ جنيه/شهر بعد ذلك",
		subPrice: undefined,
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
		originalPrice: "١٠٠٠",
		priceNumber: 1000,
		currency: "جنيه/شهر",
		promoPrice: "٠",
		promoText: "أول شهرين مجاناً",
		afterPromoText: "ثم ١٠٠٠ جنيه/شهر بعد ذلك",
		subPrice: undefined,
		description: "لكل ما تحتاجه للنمو والظهور بقوة",
		features: [
			"عدد منتجات غير محدود",
			"عدد طلبات غير محدود",
			"تقارير يومية",
			"خدمة عملاء سريعة",
			"تعديلات واجهة المتجر (ألوان المتجر، شعار المتجر)",
			"سجل وتقارير للعملاء (أسماء، أرقام، عناوين، الطلبات السابقة)",
			"ابعت عروض لعملاءك بسهولة",
			"خدمة عملاء VIP",
			"ظهور متجرك على جوجل (صفحة نشاط تجاري، خرائط، ربط واتساب)",
		],
		buttonText: "ابدأ فترة التجربة",
		highlighted: true,
	},
	{
		name: "باقة الفروع",
		originalPrice: "١٠٠٠",
		priceNumber: 1000,
		currency: "جنيه للفرع الأول / شهر",
		subPrice: "٥٠٠ جنيه لكل فرع إضافي بعد الفترة المجانية",
		promoPrice: "٠",
		promoText: "أول شهرين مجاناً",
		afterPromoText: "ثم ١٠٠٠ جنيه للفرع الأول / شهر بعد ذلك",
		description: "للمتاجر ذات الفروع المتعددة والإدارة الذكية",
		features: [
			"كل ما في الباقة الكاملة",
			"إدارة فروع",
			"إضافة أكثر من حساب لإدارة متجرك (مديرين، مديرين فروع)",
			"تقارير متقدمة (العملاء المتكررين، متابعة مخزون، منتجات أكثر طلبا)",
			"مساعد ذكي AI لإدارة حسابك (اقتراحات، تقارير، كتابة عروض)",
		],
		buttonText: "تواصل معنا للاشتراك",
		highlighted: true,
	},
] as const;

export const faqs = [
	{
		question: "ما هو تجارتك؟",
		answer:
			"تجارتك منصة SaaS عربية تساعد أصحاب المحلات في مصر على استقبال الطلبات من صفحة بسيطة وإدارتها من لوحة تحكم.",
	},
	{
		question: "هل تجارتك سوق أو ماركت بليس؟",
		answer:
			"لا. تجارتك ليس سوقاً ولا يجمع متاجر في مكان واحد. كل تاجر يحصل على صفحة طلبات خاصة به لعملائه.",
	},
	{
		question: "هل يأخذ تجارتك عمولة على الطلبات؟",
		answer:
			"لا. تجارتك لا يأخذ عمولة على الطلبات. السعر يكون من خلال الباقة الشهرية بعد انتهاء التجربة المجانية.",
	},
	{
		question: "هل يحتاج العميل إلى حساب؟",
		answer:
			"لا. العميل يفتح رابط الطلب، يختار المنتجات، يكتب بياناته، ويرسل الطلب بدون إنشاء حساب.",
	},
	{
		question: "كيف تعمل تنبيهات واتساب؟",
		answer:
			"عند وصول طلب جديد أو تغيير حالة الطلب، تساعد تنبيهات واتساب التاجر والعميل على متابعة الطلب بوضوح.",
	},
	{
		question: "لمن يناسب تجارتك؟",
		answer:
			"يناسب البقالة، الخضار والفاكهة، الجزارة، المخبز، الصيدلية، وأي محل محلي في مصر يستقبل طلبات مباشرة من العملاء.",
	},
] as const;

type PublicMetadataInput = {
	title: string;
	description: string;
	path: string;
};

export function createPublicMetadata({
	title,
	description,
	path,
}: PublicMetadataInput): Metadata {
	const url = `${SITE_URL}${path}`;

	return {
		title,
		description,
		alternates: {
			canonical: url,
		},
		openGraph: {
			type: "website",
			locale: "ar_EG",
			url,
			siteName: BRAND_ARABIC_NAME,
			title,
			description,
			images: [
				{
					url: `${SITE_URL}/og-image.jpg`,
					width: 1200,
					height: 600,
					alt: "شعار تجارتك",
				},
			],
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			images: [`${SITE_URL}/og-image.jpg`],
		},
		robots: {
			index: true,
			follow: true,
		},
	};
}

export function createNoIndexMetadata(title: string, description: string): Metadata {
	return {
		title,
		description,
		robots: {
			index: false,
			follow: false,
		},
	};
}

export const softwareApplicationJsonLd = {
	"@context": "https://schema.org",
	"@type": "SoftwareApplication",
	name: BRAND_NAME,
	alternateName: BRAND_ARABIC_NAME,
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	description:
		"Arabic-first order management SaaS for small Egyptian sellers and local merchants.",
	audience: {
		"@type": "Audience",
		audienceType: "Small merchants and online sellers in Egypt",
	},
	offers: {
		"@type": "AggregateOffer",
		priceCurrency: "EGP",
		lowPrice: "0",
		highPrice: "699",
		offerCount: pricingPlans.length,
		offers: pricingPlans.map(plan => ({
			"@type": "Offer",
			name: plan.name,
			price: "0",
			priceCurrency: "EGP",
			description: `${plan.promoText}، ${plan.afterPromoText}`,
			url: `${SITE_URL}/pricing`,
		})),
	},
};

export const faqPageJsonLd = {
	"@context": "https://schema.org",
	"@type": "FAQPage",
	mainEntity: faqs.map(faq => ({
		"@type": "Question",
		name: faq.question,
		acceptedAnswer: {
			"@type": "Answer",
			text: faq.answer,
		},
	})),
};

export const pricingJsonLd = {
	"@context": "https://schema.org",
	"@type": "Product",
	name: BRAND_ARABIC_NAME,
	description: SITE_DESCRIPTION,
	offers: pricingPlans.map(plan => ({
		"@type": "Offer",
		name: plan.name,
		priceCurrency: "EGP",
		price: plan.priceNumber,
		url: `${SITE_URL}/pricing`,
		description: `${plan.promoText}، ${plan.afterPromoText}`,
		availability: "https://schema.org/InStock",
	})),
};
