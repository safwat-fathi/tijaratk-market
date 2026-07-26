import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Poppins } from "next/font/google";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/marketing-seo";
import MarketingTracking from "@/components/analytics/MarketingTracking";
import CustomerPwaEngagement from "@/components/pwa/CustomerPwaEngagement";
import KeyboardStateDetector from "@/components/pwa/KeyboardStateDetector";
import { customerPushNotificationsService } from "@/services/api/push-notifications.service";
import "./globals.css";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
	subsets: ["arabic"],
	weight: ["400", "600", "700"],
	variable: "--font-ibm-plex-sans-arabic",
	display: "swap",
});

const poppins = Poppins({
	subsets: ["latin"],
	weight: ["400", "600"],
	variable: "--font-poppins",
	display: "swap",
	preload: false,
});

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

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const pushConfigResponse =
		await customerPushNotificationsService.getConfig();
	const pushConfig =
		pushConfigResponse.success && pushConfigResponse.data
			? pushConfigResponse.data
			: { enabled: false };

	return (
		<html lang="ar" dir="rtl">
			<head>
				<script
					dangerouslySetInnerHTML={{
						__html: `
              window.__installPromptEvent = null;
              window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                window.__installPromptEvent = e;
              });
            `,
					}}
				/>
			</head>
			<body
				className={`${ibmPlexSansArabic.variable} ${poppins.variable} font-sans antialiased`}
			>
				<KeyboardStateDetector />
				<CustomerPwaEngagement config={pushConfig}>
					{children}
				</CustomerPwaEngagement>
				<MarketingTracking />
			</body>
		</html>
	);
}
