import { redirect } from "next/navigation";
import { createNoIndexMetadata } from "@/lib/marketing-seo";

export const metadata = createNoIndexMetadata(
  "دليل المتاجر",
  "تحويل إلى صفحة دليل المتاجر المناسبة.",
);
type StoresRedirectSearchParams = {
  area?: string;
  category?: string;
  deliveryArea?: string;
};

type Props = {
  searchParams: Promise<StoresRedirectSearchParams>;
};

export default async function StoresQueryRedirectPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const { area, category, deliveryArea } = resolvedSearchParams;
  const areaSlug = area?.trim();
  const categorySlug = category?.trim();
  if (areaSlug && categorySlug) {
    const deliveryAreaSlug = deliveryArea?.trim();
    const query = deliveryAreaSlug
      ? `?deliveryArea=${encodeURIComponent(deliveryAreaSlug)}`
      : "";
    redirect(
      `/stores/${encodeURIComponent(areaSlug)}/${encodeURIComponent(
        categorySlug,
      )}${query}`,
    );
  }

  redirect("/");
}
