import type { MetadataRoute } from "next";
import { publicMarketingPages, SITE_URL } from "@/lib/marketing-seo";

export default function sitemap(): MetadataRoute.Sitemap {
	return publicMarketingPages.map(page => ({
		url: `${SITE_URL}${page.path}`,
		changeFrequency: "weekly",
		priority: page.priority,
	}));
}
