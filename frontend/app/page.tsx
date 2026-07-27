import type { Metadata } from "next";
import Link from "next/link";
import { cache, Suspense } from "react";
import CustomerAnalytics from "@/components/analytics/CustomerAnalytics";
import CustomerPwaInstallTracking from "@/components/analytics/CustomerPwaInstallTracking";
import { PublicFooter } from "@/components/layout/PublicFooter";
import JsonLd from "@/components/seo/JsonLd";
import AreaAutocomplete, {
  type AreaAutocompleteOption,
} from "@/components/stores-directory/AreaAutocomplete";
import ZoneStorefrontHome from "@/components/zone-storefronts/ZoneStorefrontHome";
import { createPublicMetadata, SITE_URL } from "@/lib/marketing-seo";
import { storesDirectoryService } from "@/services/api/stores-directory.service";
import {
  StoresDirectoryArea,
  StoresDirectoryCategory,
  StoresDirectoryLanding,
  StoresDirectorySearchArea,
} from "@/types/models/stores-directory";
import CategoryGrid, {
  DirectoryCategoryCard,
} from "@/components/stores-directory/CategoryGrid";
import { AppHeader } from "@/components/layout/AppHeader";
import InstallPwaAction from "@/components/pwa/InstallPwaAction";
import { CUSTOMER_PWA_INSTALL_SURFACES } from "@/lib/analytics/storefront-ga4";
import { CUSTOMER_PWA, CUSTOMER_PWA_METADATA } from "@/lib/customer-pwa";
import { zoneStorefrontsService } from "@/services/api/zone-storefronts.service";
import type { ZoneStorefront } from "@/types/models/zone-storefront";
import { isZoneStorefrontEnabled } from "@/lib/zone-storefront-feature";

type StoresDirectorySearchParams = {
  area?: string;
  deliveryArea?: string;
};

type StoresDirectoryPageProps = {
  searchParams: Promise<StoresDirectorySearchParams>;
};

const STORES_PATH = "/";
const DEFAULT_SEO_TITLE = "دليل المتاجر في مصر | سوبر ماركت وصيدليات قريبة";
const DEFAULT_SEO_DESCRIPTION =
  "اكتشف سوبر ماركت وصيدليات بتوصل في منطقتك داخل مصر، وتصفح المتاجر المحلية المتاحة للطلب المباشر من خلال تجارتك.";
const ZONE_SEO_TITLE = "اطلب احتياجات منطقتك | سوبر ماركت وصيدليات";
const ZONE_SEO_DESCRIPTION =
  "اختر منطقتك واطلب مباشرة من خدمة السوبر ماركت أو الصيدلية المتاحة عبر واجهة تجارتك المركزية.";

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

const getStoresLanding = cache(
  async (): Promise<StoresDirectoryLanding | null> => {
    try {
      const response = await storesDirectoryService.getLanding();
      if (!response.success || !response.data) {
        return null;
      }

      return response.data;
    } catch {
      return null;
    }
  },
);

const getPublicZoneStorefronts = cache(async (): Promise<ZoneStorefront[]> => {
  if (!isZoneStorefrontEnabled()) return [];

  try {
    const response = await zoneStorefrontsService.getPublicZones();
    return response.success && Array.isArray(response.data) ? response.data : [];
  } catch {
    return [];
  }
});

export function generateMetadata(): Metadata {
  if (isZoneStorefrontEnabled()) {
    return {
      ...createPublicMetadata({
        title: ZONE_SEO_TITLE,
        description: ZONE_SEO_DESCRIPTION,
        path: STORES_PATH,
      }),
      ...CUSTOMER_PWA_METADATA,
      keywords: [
        "توصيل حسب المنطقة",
        "سوبر ماركت في منطقتك",
        "صيدلية في منطقتك",
        "طلبات المنطقة",
        "تجارتك",
      ],
    };
  }

  return {
    ...createPublicMetadata({
      title: DEFAULT_SEO_TITLE,
      description: DEFAULT_SEO_DESCRIPTION,
      path: STORES_PATH,
    }),
    ...CUSTOMER_PWA_METADATA,
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
  selectedDeliveryArea?: AreaAutocompleteOption,
): DirectoryCategoryCard[] =>
  categories
    .map((category) => ({
      slug: category.slug,
      name: getCategoryName(category),
      stores: selectedDeliveryArea
        ? (selectedDeliveryArea.categoryCounts?.[category.slug] ?? 0)
        : selectedArea
          ? (selectedArea.categoryCounts?.[category.slug] ?? 0)
          : category.storesCount,
      color: getCategoryColor(category),
      icon: getCategoryIcon(category),
    }))
    .filter(
      (category) =>
        (!selectedArea && !selectedDeliveryArea) || category.stores > 0,
    );

const toSearchAreaOptions = (
  areas: StoresDirectorySearchArea[],
): AreaAutocompleteOption[] =>
  areas.map((area) => ({
    name: area.nameAr,
    nameEn: area.nameEn,
    slug: area.slug,
    destinationSlug: area.destinationSlug,
    parentNameAr: area.parentNameAr,
    stores: area.storesCount,
    categoryCounts: area.categoryCounts,
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

async function LegacyDirectoryContent({
  searchParams,
}: StoresDirectoryPageProps) {
  const resolvedSearchParams = await searchParams;
  const { area, deliveryArea } = resolvedSearchParams;
  const selectedAreaSlug = area?.trim() || undefined;
  const selectedDeliveryAreaSlug = deliveryArea?.trim() || undefined;
  const landing = await getStoresLanding();
  const areas = landing?.areas ?? [];
  const categories = landing?.categories?.length
    ? landing.categories
    : fallbackCategories;
  const seo = resolveSeo(landing);
  const jsonLd = buildJsonLd({ seo, areas, categories });
  const searchAreaOptions = landing?.searchAreas?.length
    ? toSearchAreaOptions(landing.searchAreas)
    : areas.map((item) => ({
        name: item.nameAr,
        nameEn: item.nameEn,
        slug: item.slug,
        destinationSlug: item.slug,
        stores: item.storesCount,
        categoryCounts: item.categoryCounts,
      }));
  const selectedDeliveryArea = selectedDeliveryAreaSlug
    ? searchAreaOptions.find(
        (item) =>
          item.slug === selectedDeliveryAreaSlug &&
          item.destinationSlug !== item.slug &&
          (!selectedAreaSlug || item.destinationSlug === selectedAreaSlug),
      )
    : undefined;
  const effectiveMainAreaSlug =
    selectedDeliveryArea?.destinationSlug ?? selectedAreaSlug;
  const selectedArea = effectiveMainAreaSlug
    ? areas.find((item) => item.slug === effectiveMainAreaSlug)
    : undefined;
  const categoryCards = toCategoryCards(
    categories,
    selectedArea,
    selectedDeliveryArea,
  );
  const topAreas = areas.slice(0, 8);
  const searchedAreas = areas.slice(0, 4);

  return (
    <>
      {jsonLd.map((item, index) => (
        <JsonLd
          key={`${item["@type"]}-${index}`}
          id={`stores-directory-${String(item["@type"]).toLowerCase()}-${index}-jsonld`}
          data={item}
        />
      ))}

      <section className="sticky top-16 z-40 border-b border-gray-200/50 bg-[#F7F8F6]/90 px-4 py-6 shadow-sm backdrop-blur-md transition-all">
        <div className="mx-auto max-w-3xl">
          <AreaAutocomplete
            areas={searchAreaOptions}
            destination={{ type: "landing" }}
          />

          {selectedDeliveryArea ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#27AE60]/25 bg-[#E8F5ED] px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-gray-600">
                  التوصيل إلى
                </p>
                <p className="mt-0.5 font-black text-[#0F5A3D]">
                  {selectedDeliveryArea.name}
                </p>
              </div>
              <Link
                href={
                  effectiveMainAreaSlug
                    ? `/?area=${encodeURIComponent(effectiveMainAreaSlug)}`
                    : "/"
                }
                className="min-h-11 rounded-lg border border-[#27AE60]/30 bg-white px-4 py-2.5 text-sm font-bold text-[#0F5A3D]"
              >
                تغيير المنطقة
              </Link>
            </div>
          ) : null}

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
        <section>
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-3xl font-bold text-[#222B2E]">
                بتدور على إيه؟
              </h2>
            </div>
            <CategoryGrid
              categories={categoryCards}
              deliveryAreas={searchAreaOptions}
              selectedMainAreaSlug={effectiveMainAreaSlug}
              selectedDeliveryAreaSlug={selectedDeliveryArea?.slug}
            />
        </section>

        {!selectedArea && topAreas.length > 0 && (
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

      </div>
    </>
  );
}

function LegacyDirectoryFallback() {
  return (
    <>
      <section className="border-b border-gray-200/50 bg-[#F7F8F6] px-4 py-6">
        <div className="mx-auto h-14 max-w-3xl animate-pulse rounded-full bg-gray-200" />
      </section>
      <div
        className="mx-auto grid min-h-64 max-w-7xl grid-cols-2 gap-4 px-4 py-16 sm:px-6 md:grid-cols-4 lg:px-8"
        aria-hidden="true"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded-2xl bg-gray-200"
          />
        ))}
      </div>
    </>
  );
}

function LegacyStoresDirectoryPage(props: StoresDirectoryPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8F6]" dir="rtl">
      <AppHeader
        title="دليل المتاجر"
        innerClassName="mx-auto flex max-w-7xl flex-col items-start gap-3 px-4 py-3 sm:px-6 lg:px-8"
        titleActions={
          <InstallPwaAction
            appName={CUSTOMER_PWA.name}
            buttonText="تثبيت التطبيق"
          />
        }
      />

      <main className="flex-1">
        <section className="bg-gradient-to-b from-[#E8F5ED] to-[#F7F8F6] px-4 pb-8 pt-16 text-center sm:pt-24 sm:pb-8">
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

        <Suspense fallback={<LegacyDirectoryFallback />}>
          <LegacyDirectoryContent {...props} />
        </Suspense>
      </main>

      <PublicFooter />
    </div>
  );
}

export default async function HomePage(props: StoresDirectoryPageProps) {
  if (!isZoneStorefrontEnabled()) {
    return (
      <>
        <CustomerAnalytics pageLocation={STORES_PATH} />
        <CustomerPwaInstallTracking
          installSurface={CUSTOMER_PWA_INSTALL_SURFACES.HOME}
        />
        <LegacyStoresDirectoryPage {...props} />
      </>
    );
  }

  const publicZones = await getPublicZoneStorefronts();

  return (
    <>
      <CustomerAnalytics pageLocation={STORES_PATH} />
      <CustomerPwaInstallTracking
        installSurface={CUSTOMER_PWA_INSTALL_SURFACES.HOME}
      />
      {publicZones.length > 0 ? (
        <ZoneStorefrontHome zones={publicZones} />
      ) : (
        <LegacyStoresDirectoryPage {...props} />
      )}
    </>
  );
}
