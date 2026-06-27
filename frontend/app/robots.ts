import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/marketing-seo";

export default function robots(): MetadataRoute.Robots {
	const privatePaths = [
		"/dashboard/",
		"/admin/",
		"/api/",
		"/checkout/session/",
		"/merchant/",
		"/track-order/",
		"/*/success/",
	];

	return {
		rules: [
			{
				userAgent: [
					"OAI-SearchBot",
					"ChatGPT-User",
					"PerplexityBot",
					"ClaudeBot",
					"Bingbot",
				],
				allow: "/",
				disallow: privatePaths,
			},
			{
				userAgent: "GPTBot",
				disallow: "/",
			},
			{
				userAgent: "*",
				allow: "/",
				disallow: privatePaths,
			},
		],
		sitemap: `${SITE_URL}/sitemap.xml`,
	};
}
