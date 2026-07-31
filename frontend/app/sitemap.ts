import type { MetadataRoute } from "next";
import { publicMarketingPages, SITE_URL } from "@/lib/marketing-seo";
import { storesDirectoryService } from "@/services/api/stores-directory.service";

/** Revalidated daily so newly listed areas and categories get picked up. */
export const revalidate = 86400;

const toEntry = (
	path: string,
	priority: number,
	changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
): MetadataRoute.Sitemap[number] => ({
	url: `${SITE_URL}${path}`,
	lastModified: new Date(),
	changeFrequency,
	priority,
});

/**
 * The directory category pages are the routes actually built for organic
 * discovery — they carry backend-supplied SEO copy and CollectionPage /
 * ItemList / BreadcrumbList JSON-LD. Leaving them out meant a crawler had to
 * find them by luck.
 */
async function getDirectoryEntries(): Promise<MetadataRoute.Sitemap> {
	try {
		const response = await storesDirectoryService.getLanding();
		if (!response.success || !response.data) return [];

		const { areas = [], categories = [] } = response.data;

		return areas.flatMap((area) =>
			categories.map((category) =>
				toEntry(
					`/stores/${encodeURIComponent(area.slug)}/${encodeURIComponent(
						category.slug,
					)}`,
					0.7,
					"daily",
				),
			),
		);
	} catch {
		return [];
	}
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const marketingEntries = publicMarketingPages.map((page) =>
		toEntry(page.path, page.priority, "weekly"),
	);

	return [...marketingEntries, ...await getDirectoryEntries()];
}
