import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import Script from "next/script";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/marketing-seo";
import MarketingTracking from "@/components/analytics/MarketingTracking";
import "./globals.css";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
	subsets: ["arabic"],
	weight: ["400", "600", "700"],
	variable: "--font-ibm-plex-sans-arabic",
	display: "swap",
});

export const viewport: Viewport = {
	themeColor: "#0F5A3D",
	colorScheme: "light",
};

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		default: "تجارتك | نظام بسيط لإدارة طلبات المحلات أونلاين",
		template: "%s | تجارتك",
	},
	description: SITE_DESCRIPTION,
	keywords: [
		"تجارتك",
		"منصة تجارة",
		"إدارة المتاجر",
		"متاجر أوفلاين",
		"تتبع الطلبات",
		"إدارة العملاء",
		"نظام مبيعات",
		"طلبات أونلاين بدون عمولة",
		"محلات مصر",
	],
	authors: [{ name: "تجارتك" }],
	creator: "تجارتك",
	publisher: "تجارتك",
	formatDetection: {
		email: false,
		address: false,
		telephone: false,
	},
	openGraph: {
		type: "website",
		locale: "ar_EG",
		url: SITE_URL,
		siteName: "تجارتك",
		title: "تجارتك | نظام بسيط لإدارة طلبات المحلات أونلاين",
		description: SITE_DESCRIPTION,
		images: [
			{
				url: "/og-image.jpg",
				width: 1200,
				height: 600,
				alt: "تجارتك",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "تجارتك | نظام بسيط لإدارة طلبات المحلات أونلاين",
		description: SITE_DESCRIPTION,
		images: ["/og-image.jpg"],
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-video-preview": -1,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
	},
};

/**
 * Deliberately synchronous and request-independent. Anything awaited here makes
 * the root layout dynamic, which forces every route in the application to be
 * rendered per request — including the static marketing pages.
 */
export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="ar" dir="rtl">
			<body
				className={`${ibmPlexSansArabic.variable} font-sans antialiased`}
			>
				{/*
				 * Must run before hydration so the install prompt is not lost on
				 * routes where the PWA shell mounts later.
				 */}
				<Script id="capture-install-prompt" strategy="beforeInteractive">
					{`window.__installPromptEvent = null;
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window.__installPromptEvent = e;
});`}
				</Script>
				{children}
				<MarketingTracking />
			</body>
		</html>
	);
}
