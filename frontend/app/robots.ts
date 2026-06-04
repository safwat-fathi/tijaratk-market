import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/marketing-seo";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: "OAI-SearchBot",
				allow: "/",
				disallow: ["/dashboard/", "/admin/", "/api/", "/checkout/session/"],
			},
			{
				userAgent: "GPTBot",
				disallow: "/",
			},
			{
				userAgent: "*",
				allow: "/",
				disallow: [
					"/dashboard/",
					"/admin/",
					"/api/",
					"/checkout/session/",
					"/merchant/",
					"/track-order/",
					"/*/success/",
				],
			},
		],
		sitemap: `${SITE_URL}/sitemap.xml`,
	};
}
