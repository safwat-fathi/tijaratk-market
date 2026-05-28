import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Poppins } from "next/font/google";
import "./globals.css";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
	subsets: ["arabic"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-ibm-plex-sans-arabic",
	display: "swap",
});

const poppins = Poppins({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-poppins",
	display: "swap",
});

export const metadata: Metadata = {
	title: {
		default: "تجارتك | منصة إدارة المتاجر",
		template: "%s | تجارتك",
	},
	description: "تجارتك هي المنصة المتكاملة لإدارة متجرك بفعالية، تتبع الطلبات، وإدارة العملاء والمنتجات بكل سهولة.",
	keywords: [
		"تجارتك",
		"منصة تجارة",
		"إدارة المتاجر",
		"متاجر أوفلاين",
		"تتبع الطلبات",
		"إدارة العملاء",
		"نظام مبيعات",
		"تجارة إلكترونية",
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
		locale: "ar_SA",
		url: "https://tijaratk.com",
		siteName: "تجارتك",
		title: "تجارتك | منصة إدارة المتاجر",
		description: "تجارتك هي المنصة المتكاملة لإدارة متجرك بفعالية، تتبع الطلبات، وإدارة العملاء والمنتجات بكل سهولة.",
		images: [
			{
				url: "/logo.png",
				width: 800,
				height: 600,
				alt: "تجارتك",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "تجارتك | منصة إدارة المتاجر",
		description: "تجارتك هي المنصة المتكاملة لإدارة متجرك بفعالية، تتبع الطلبات، وإدارة العملاء والمنتجات بكل سهولة.",
		images: ["/logo.png"],
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

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="ar" dir="rtl">
			<body
				className={`${ibmPlexSansArabic.variable} ${poppins.variable} font-sans antialiased`}
			>
				{children}
			</body>
		</html>
	);
}
