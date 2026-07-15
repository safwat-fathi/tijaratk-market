import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/layout/PublicFooter";
import JsonLd from "@/components/seo/JsonLd";
import SafeImage from "@/components/ui/SafeImage";
import AreaAutocomplete from "@/components/stores-directory/AreaAutocomplete";
import { createPublicMetadata, SITE_URL } from "@/lib/marketing-seo";
import { storesDirectoryService } from "@/services/api/stores-directory.service";
import {
  StoresDirectoryArea,
  StoresDirectoryCategory,
  StoresDirectoryLanding,
  StoresDirectoryStoreCard,
} from "@/types/models/stores-directory";
import CategoryGrid, {
  DirectoryAreaOption,
  DirectoryCategoryCard,
} from "@/components/stores-directory/CategoryGrid";
import { AppHeader } from "@/components/layout/AppHeader";
import InstallPwaAction from "@/components/pwa/InstallPwaAction";
import { zoneStorefrontsService } from "@/services/api/zone-storefronts.service";
import type { ZoneStorefront } from "@/types/models/zone-storefront";

type StoresDirectorySearchParams = {
  area?: string;
};

type StoresDirectoryPageProps = {
  searchParams: Promise<StoresDirectorySearchParams>;
};

const STORES_PATH = "/";
const DEFAULT_SEO_TITLE = "دليل المتاجر في مصر | سوبر ماركت وصيدليات قريبة";
const DEFAULT_SEO_DESCRIPTION =
  "اكتشف سوبر ماركت وصيدليات بتوصل في منطقتك داخل مصر، وتصفح المتاجر المحلية المتاحة للطلب المباشر من خلال تجارتك.";

const fallbackCategories: StoresDirectoryCategory[] = [
  {
    slug: "supermarkets",
    label: "Supermarkets",
    tenantCategory: "grocery",
    storesCount: 0,
  },
  {
    slug: "pharmacies",
    label: "Pharmacies",
    tenantCategory: "pharmacy",
    storesCount: 0,
  },
];

const containsArabic = (value?: string | null) =>
  Boolean(value && /[\u0600-\u06FF]/.test(value));

const resolveSeo = (landing?: StoresDirectoryLanding | null) => {
  const apiTitle = landing?.seo?.title?.trim();
  const apiDescription = landing?.seo?.description?.trim();

  return {
    title: apiTitle && containsArabic(apiTitle) ? apiTitle : DEFAULT_SEO_TITLE,
    description:
      apiDescription && containsArabic(apiDescription)
        ? apiDescription
        : DEFAULT_SEO_DESCRIPTION,
  };
};

async function getStoresLanding(): Promise<StoresDirectoryLanding | null> {
  try {
    const response = await storesDirectoryService.getLanding();
    if (!response.success || !response.data) {
      return null;
    }

    return response.data;
  } catch {
    return null;
  }
}

async function getPublicZoneStorefronts(): Promise<ZoneStorefront[]> {
  try {
    const response = await zoneStorefrontsService.getPublicZones();
    return response.success && Array.isArray(response.data) ? response.data : [];
  } catch {
    return [];
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const landing = await getStoresLanding();
  const seo = resolveSeo(landing);

  return {
    ...createPublicMetadata({
      title: seo.title,
      description: seo.description,
      path: STORES_PATH,
    }),
    manifest: "/pwa/stores-directory/manifest",
    keywords: [
      "دليل المتاجر",
      "سوبر ماركت قريب",
      "صيدليات قريبة",
      "متاجر بتوصل",
      "تجارتك",
      "طلبات من المحلات",
      "محلات مصر",
    ],
  };
}

const getCategoryName = (category: StoresDirectoryCategory) => {
  if (category.slug === "supermarkets") return "سوبر ماركت";
  if (category.slug === "pharmacies") return "صيدليات";
  return category.label;
};

const getCategoryColor = (category: StoresDirectoryCategory) => {
  if (category.slug === "pharmacies") return "bg-red-50";
  return "bg-[#E8F5ED]";
};

const getCategoryIcon = (category: StoresDirectoryCategory) => {
  if (category.slug === "pharmacies") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-8 w-8 text-red-500"
      >
        <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
        <path d="m8.5 8.5 7 7" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-8 w-8 text-[#0F5A3D]"
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
};

const toCategoryCards = (
  categories: StoresDirectoryCategory[],
  selectedArea?: StoresDirectoryArea,
): DirectoryCategoryCard[] =>
  categories
    .map((category) => ({
      slug: category.slug,
      name: getCategoryName(category),
      stores: selectedArea
        ? (selectedArea.categoryCounts?.[category.slug] ?? 0)
        : category.storesCount,
      color: getCategoryColor(category),
      icon: getCategoryIcon(category),
    }))
    .filter((category) => !selectedArea || category.stores > 0);

const toAreaOptions = (areas: StoresDirectoryArea[]): DirectoryAreaOption[] =>
  areas.map((area) => ({
    name: area.nameAr,
    nameEn: area.nameEn,
    slug: area.slug,
    stores: area.storesCount,
    categoryCounts: area.categoryCounts ?? {},
  }));

const buildJsonLd = (params: {
  seo: { title: string; description: string };
  areas: StoresDirectoryArea[];
  categories: StoresDirectoryCategory[];
}) => {
  const url = `${SITE_URL}${STORES_PATH}`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: params.seo.title,
      description: params.seo.description,
      url,
      inLanguage: "ar-EG",
      isPartOf: {
        "@type": "WebSite",
        name: "تجارتك",
        url: SITE_URL,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "مناطق دليل المتاجر في تجارتك",
      itemListElement: params.areas.slice(0, 12).map((area, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: area.nameAr,
        url: `${url}?area=${encodeURIComponent(area.slug)}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "تصنيفات المتاجر في تجارتك",
      itemListElement: params.categories.map((category, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: getCategoryName(category),
        url: `${url}?category=${encodeURIComponent(category.slug)}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "الرئيسية",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "دليل المتاجر",
          item: url,
        },
      ],
    },
  ];
};

const resolveStorefrontUrl = (store: StoresDirectoryStoreCard) => {
  const params = new URLSearchParams({ src: "directory" });
  if (store.areaSlug) {
    params.set("areaSlug", store.areaSlug);
  }

  return `${store.storefrontUrl}?${params.toString()}`;
};

const StoreCard = ({ store }: { store: StoresDirectoryStoreCard }) => (
  <Link
    href={resolveStorefrontUrl(store)}
    className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 text-right shadow-sm transition-all hover:border-[#27AE60]/30 hover:shadow-md"
  >
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#E8F5ED] text-lg font-black text-[#0F5A3D]">
      {store.logoUrl ? (
        <SafeImage
          src={store.logoUrl}
          alt={store.name}
          width={64}
          height={64}
          imageClassName="h-16 w-16 rounded-xl object-cover"
          sizes="64px"
          fallback={store.name.slice(0, 1)}
        />
      ) : (
        store.name.slice(0, 1)
      )}
    </div>
    <div className="min-w-0 flex-1">
      <h3 className="line-clamp-1 text-base font-bold text-[#222B2E]">
        {store.name}
      </h3>
      <p className="mt-1 line-clamp-1 text-sm text-gray-500">
        {store.areaName || store.address || "متجر محلي على تجارتك"}
      </p>
    </div>
  </Link>
);

const ZoneStorefrontCard = ({
  zone,
  highlighted,
}: {
  zone: ZoneStorefront;
  highlighted: boolean;
}) => {
  const deliveryFee = Number(zone.delivery_fee ?? 0);
  const categoryLabel =
    zone.category === "pharmacy" ? "صيدليات" : "سوبر ماركت";

  return (
    <Link
      href={`/market/${encodeURIComponent(zone.slug)}`}
      className={`group relative overflow-hidden rounded-3xl border p-6 text-right shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${
        highlighted
          ? "border-[#27AE60] bg-gradient-to-br from-[#0F5A3D] to-[#167A53] text-white"
          : "border-[#27AE60]/20 bg-gradient-to-br from-white to-[#E8F5ED] text-[#222B2E]"
      }`}
    >
      <div
        className={`absolute -left-8 -top-10 h-32 w-32 rounded-full ${
          highlighted ? "bg-white/10" : "bg-[#27AE60]/10"
        }`}
        aria-hidden="true"
      />
      <div className="relative flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                highlighted
                  ? "bg-white/15 text-white"
                  : "bg-[#0F5A3D] text-white"
              }`}
            >
              سوق مركزي تديره تجارتك
            </span>
            <h3 className="mt-3 text-xl font-black">{zone.name}</h3>
            <p
              className={`mt-1 text-sm ${
                highlighted ? "text-white/75" : "text-gray-600"
              }`}
            >
              {zone.area.name_ar} · {categoryLabel}
            </p>
          </div>
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              highlighted
                ? "bg-white/15 text-white"
                : "bg-white text-[#0F5A3D] shadow-sm"
            }`}
            aria-hidden="true"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-4">
          <span
            className={`text-sm font-semibold ${
              highlighted ? "text-white/80" : "text-gray-600"
            }`}
          >
            التوصيل {deliveryFee > 0 ? `${deliveryFee} ج.م` : "مجاني"}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-sm font-black ${
              highlighted ? "text-white" : "text-[#0F5A3D]"
            }`}
          >
            اطلب الآن
            <span className="transition-transform group-hover:-translate-x-1">
              ←
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
};

export default async function StoresDirectoryPage({
  searchParams,
}: StoresDirectoryPageProps) {
  const resolvedSearchParams = await searchParams;
  const { area } = resolvedSearchParams;
  const selectedAreaSlug = area?.trim() || undefined;
  const [landing, publicZones] = await Promise.all([
    getStoresLanding(),
    getPublicZoneStorefronts(),
  ]);
  const areas = landing?.areas ?? [];
  const selectedArea = selectedAreaSlug
    ? areas.find((item) => item.slug === selectedAreaSlug)
    : undefined;
  const categories = landing?.categories?.length
    ? landing.categories
    : fallbackCategories;
  const featuredStores = landing?.featuredStores ?? [];
  const seo = resolveSeo(landing);
  const jsonLd = buildJsonLd({ seo, areas, categories });
  const categoryCards = toCategoryCards(categories, selectedArea);
  const areaOptions = toAreaOptions(areas);
  const topAreas = areas.slice(0, 8);
  const searchedAreas = areas.slice(0, 4);
  const orderedPublicZones = selectedAreaSlug
    ? [
        ...publicZones.filter((zone) => zone.area.slug === selectedAreaSlug),
        ...publicZones.filter((zone) => zone.area.slug !== selectedAreaSlug),
      ]
    : publicZones;

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8F6]" dir="rtl">
      {jsonLd.map((item, index) => (
        <JsonLd
          key={`${item["@type"]}-${index}`}
          id={`stores-directory-${String(item["@type"]).toLowerCase()}-${index}-jsonld`}
          data={item}
        />
      ))}

      <AppHeader
        title="دليل المتاجر"
        innerClassName="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8"
        actions={<InstallPwaAction appName="دليل تجارتك" />}
      />

      <main className="flex-1">
        <section className="bg-gradient-to-b from-[#E8F5ED] to-[#F7F8F6] px-4 pb-8 pt-16 text-center sm:py-24">
          <div className="mx-auto max-w-4xl">
            <h1 className="mb-6 text-4xl font-bold leading-tight text-[#0F5A3D] sm:text-5xl lg:text-6xl">
              اطلب من سوبر ماركت وصيدليات في منطقتك
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-[#222B2E]/80">
              اختر منطقتك وشوف السوبر ماركت والصيدليات المتاحة للطلب والتوصيل
              مباشرة من المتاجر المحلية على تجارتك.
            </p>
          </div>
        </section>

        <section className="sticky top-16 z-40 border-b border-gray-200/50 bg-[#F7F8F6]/90 px-4 py-6 shadow-sm backdrop-blur-md transition-all">
          <div className="mx-auto max-w-3xl">
            <AreaAutocomplete
              areas={areaOptions}
              destination={{ type: "landing" }}
            />

            {searchedAreas.length > 0 && (
              <div className="mt-4 flex items-start gap-3">
                <span className="shrink-0 pt-1.5 text-sm font-semibold text-gray-500">
                  الأكثر بحثاً:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {searchedAreas.map((area) => {
                    const isSelected = area.slug === selectedAreaSlug;
                    return (
                      <Link
                        key={area.slug}
                        href={`/?area=${encodeURIComponent(area.slug)}`}
                        className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                          isSelected
                            ? "border-[#0F5A3D] bg-[#0F5A3D] text-white"
                            : "border-gray-200 bg-white text-[#0F5A3D] hover:border-[#27AE60]/30 hover:bg-[#E8F5ED]"
                        }`}
                      >
                        {area.nameAr}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="mx-auto max-w-7xl space-y-20 px-4 py-16 sm:px-6 lg:px-8">
          {orderedPublicZones.length > 0 && (
            <section aria-labelledby="zone-storefronts-heading">
              <div className="mb-6 flex flex-col gap-2">
                <h2
                  id="zone-storefronts-heading"
                  className="text-3xl font-bold text-[#222B2E]"
                >
                  أسواق تجارتك المركزية
                </h2>
                <p className="max-w-2xl text-base leading-7 text-gray-600">
                  اطلب احتياجاتك من واجهة واحدة، وفريق تجارتك يختار متجر
                  التنفيذ المناسب داخل منطقتك.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {orderedPublicZones.map((zone) => (
                  <ZoneStorefrontCard
                    key={zone.id}
                    zone={zone}
                    highlighted={zone.area.slug === selectedAreaSlug}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-3xl font-bold text-[#222B2E]">
                بتدور على إيه؟
              </h2>
            </div>
            <CategoryGrid
              categories={categoryCards}
              areas={areaOptions}
              selectedAreaSlug={selectedAreaSlug}
            />
          </section>

          {topAreas.length > 0 && (
            <section id="areas">
              <div className="mb-4 flex flex-col gap-3">
                <h2 className="text-3xl font-bold text-[#222B2E]">
                  تصفح حسب المنطقة
                </h2>
                <Link
                  href="#areas"
                  className="group flex items-center gap-1 text-sm font-bold text-[#27AE60] transition-colors hover:text-[#0F5A3D]"
                >
                  <span>عرض المناطق المتاحة</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 transition-transform group-hover:-translate-x-1"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-6">
                {topAreas.map((area) => (
                  <Link
                    key={area.slug}
                    href={`/?area=${encodeURIComponent(area.slug)}`}
                    className="group flex flex-col items-center rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm transition-all hover:border-[#27AE60]/30 hover:shadow-md"
                  >
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F7F8F6] text-[#0F5A3D] transition-colors group-hover:bg-[#27AE60] group-hover:text-white">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-6 w-6"
                      >
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-[#222B2E]">
                      {area.nameAr}
                    </h3>
                    <p className="mt-1 text-sm font-medium text-gray-500">
                      {area.storesCount} متجر
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {featuredStores.length > 0 && (
            <section>
              <div className="mb-6 flex flex-col gap-2">
                <h2 className="text-3xl font-bold text-[#222B2E]">
                  متاجر متاحة الآن
                </h2>
                <p className="text-base leading-7 text-gray-600">
                  متاجر محلية يمكنك الطلب منها مباشرة عبر تجارتك.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {featuredStores.slice(0, 6).map((store) => (
                  <StoreCard key={store.id} store={store} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
