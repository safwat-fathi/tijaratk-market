import { redirect } from "next/navigation";
type StoresRedirectSearchParams = {
  area?: string;
  category?: string;
};

type Props = {
  searchParams: Promise<StoresRedirectSearchParams>;
};

export default async function StoresQueryRedirectPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const { area, category } = resolvedSearchParams;
  const areaSlug = area?.trim();
  const categorySlug = category?.trim();
  if (areaSlug && categorySlug) {
    redirect(
      `/stores/${encodeURIComponent(areaSlug)}/${encodeURIComponent(categorySlug)}`,
    );
  }

  redirect("/");
}
