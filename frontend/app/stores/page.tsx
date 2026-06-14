import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{
    area?: string;
    category?: string;
  }>;
};

export default async function StoresQueryRedirectPage({ searchParams }: Props) {
  const { area, category } = await searchParams;
  const areaSlug = area?.trim();
  const categorySlug = category?.trim();

  if (areaSlug && categorySlug) {
    redirect(
      `/stores/${encodeURIComponent(areaSlug)}/${encodeURIComponent(categorySlug)}`,
    );
  }

  redirect("/");
}
