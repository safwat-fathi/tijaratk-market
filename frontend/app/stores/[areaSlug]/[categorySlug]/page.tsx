import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { X } from "lucide-react";
import CustomerAnalytics from "@/components/analytics/CustomerAnalytics";
import CustomerPwaInstallTracking from "@/components/analytics/CustomerPwaInstallTracking";
import { AppHeader } from "@/components/layout/AppHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import AreaAutocomplete from "@/components/stores-directory/AreaAutocomplete";
import JsonLd from "@/components/seo/JsonLd";
import SafeImage from "@/components/ui/SafeImage";
import { createPublicMetadata, SITE_URL } from "@/lib/marketing-seo";
import { storesDirectoryService } from "@/services/api/stores-directory.service";
import InstallPwaAction from "@/components/pwa/InstallPwaAction";
import { CUSTOMER_PWA_INSTALL_SURFACES } from "@/lib/analytics/storefront-ga4";
import { CUSTOMER_PWA, CUSTOMER_PWA_METADATA } from "@/lib/customer-pwa";
import {
  StoresDirectoryCategoryPage,
  StoresDirectoryStoreCard,
} from "@/types/models/stores-directory";
import { formatCurrency } from "@/lib/utils/currency";

type StoresCategorySearchParams = {
  deliveryArea?: string;
  search?: string;
  open_now?: string;
  page?: string;
};

type Props = {
  params: Promise<{
    areaSlug: string;
    categorySlug: string;
  }>;
  searchParams: Promise<StoresCategorySearchParams>;
};

const getCategoryName = (slug: string, label: string) => {
  if (slug === "supermarkets") return "سوبر ماركت";
  if (slug === "pharmacies") return "صيدليات";
  return label;
};

const resolveStorefrontUrl = (
  store: StoresDirectoryStoreCard,
  categorySlug: string,
) => {
  const params = new URLSearchParams({ src: "directory" });
  if (store.areaSlug) {
    params.set("areaSlug", store.areaSlug);
  }
  params.set("categorySlug", categorySlug);

  return `${store.storefrontUrl}?${params.toString()}`;
};

const toAbsoluteSiteUrl = (pathOrUrl: string) =>
  pathOrUrl.startsWith("http") ? pathOrUrl : `${SITE_URL}${pathOrUrl}`;

async function getCategoryPage(
  areaSlug: string,
  categorySlug: string,
  searchParams?: Awaited<Props["searchParams"]>,
): Promise<StoresDirectoryCategoryPage | null> {
  const page = Number(searchParams?.page);
  const openNow = searchParams?.open_now === "true" ? true : undefined;
  const response = await storesDirectoryService.getCategoryPage(
    areaSlug,
    categorySlug,
    {
      delivery_area_slug: searchParams?.deliveryArea?.trim() || undefined,
      search: searchParams?.search,
      open_now: openNow,
      page: Number.isFinite(page) && page > 0 ? page : undefined,
    },
  );

  if (!response.success || !response.data) {
    return null;
  }

  return response.data;
}

const buildCategoryJsonLd = (
  page: StoresDirectoryCategoryPage,
  categoryName: string,
) => {
  const url = toAbsoluteSiteUrl(
    page.seo.canonicalUrl || `/stores/${page.area.slug}/${page.category.slug}`,
  );

  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: page.seo.title,
      description: page.seo.description,
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
      name: `${categoryName} في ${page.area.nameAr}`,
      itemListElement: page.stores.map((store, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: store.name,
        url: resolveStorefrontUrl(store, page.category.slug),
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "دليل المتاجر",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: page.area.nameAr,
          item: `${SITE_URL}/?area=${encodeURIComponent(page.area.slug)}`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: categoryName,
          item: url,
        },
      ],
    },
  ];
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { areaSlug, categorySlug } = await params;
  const page = await getCategoryPage(areaSlug, categorySlug);

  if (!page) {
    return { title: "404 - الصفحة غير موجودة" };
  }

  return {
    ...createPublicMetadata({
      title: page.seo.title,
      description: page.seo.description,
      path: page.seo.canonicalUrl || `/stores/${areaSlug}/${categorySlug}`,
    }),
    ...CUSTOMER_PWA_METADATA,
  };
}

/**
 * A closed store can still take pre-orders, so it must not be labelled the same
 * as one that cannot be ordered from at all. Falls back to the legacy boolean
 * pair when the backend has not yet shipped `deliveryOrderingMode`.
 */
const resolveAvailabilityBadge = (store: StoresDirectoryStoreCard) => {
  const mode =
    store.deliveryOrderingMode ??
    (store.deliveryAvailableNow
      ? "asap"
      : store.deliveryAvailable
        ? "scheduled"
        : "unavailable");

  if (mode === "asap") {
    return { label: "متاح الآن", className: "bg-[#E8F5ED] text-[#0F5A3D]" };
  }

  if (mode === "scheduled") {
    return { label: "مغلق · الحجز متاح", className: "bg-amber-50 text-amber-900" };
  }

  return { label: "غير متاح الآن", className: "bg-gray-100 text-gray-500" };
};

const AvailabilityBadge = ({ store }: { store: StoresDirectoryStoreCard }) => {
  const badge = resolveAvailabilityBadge(store);

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}
    >
      {badge.label}
    </span>
  );
};

const StoreCard = ({
  store,
  categorySlug,
}: {
  store: StoresDirectoryStoreCard;
  categorySlug: string;
}) => (
  <Link
    href={resolveStorefrontUrl(store, categorySlug)}
    className="group flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 text-right shadow-sm transition-all hover:border-[#27AE60]/30 hover:shadow-md"
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="line-clamp-1 text-base font-bold text-[#222B2E]">
          {store.name}
        </h2>
        <AvailabilityBadge store={store} />
      </div>
      <p className="mt-1 line-clamp-1 text-sm text-gray-500">
        {store.areaName || store.address || "متجر محلي على تجارتك"}
      </p>
      {store.deliveryAvailable ? (
        <p className="mt-1 text-xs font-bold text-[#0F5A3D]">
          رسوم التوصيل:{" "}
          {store.deliveryFee > 0 ? formatCurrency(store.deliveryFee) : "مجاني"}
        </p>
      ) : null}
    </div>
  </Link>
);

export default async function StoresCategoryPage({
  params,
  searchParams,
}: Props) {
  const [{ areaSlug, categorySlug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const page = await getCategoryPage(
    areaSlug,
    categorySlug,
    resolvedSearchParams,
  );

  if (!page) {
    notFound();
  }

  const categoryName = getCategoryName(page.category.slug, page.category.label);
  const storesCount = page.pagination.total;
  const selectedDeliveryArea = page.selectedDeliveryArea;
  const jsonLd = buildCategoryJsonLd(page, categoryName);

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8F6]" dir="rtl">
      <CustomerAnalytics
        pageLocation={`/stores/${encodeURIComponent(areaSlug)}/${encodeURIComponent(categorySlug)}`}
        pageTitle={page.seo.title}
      />
      <CustomerPwaInstallTracking
        installSurface={CUSTOMER_PWA_INSTALL_SURFACES.STORE_DIRECTORY}
      />
      {jsonLd.map((item, index) => (
        <JsonLd
          key={`${item["@type"]}-${index}`}
          id={`stores-category-${String(item["@type"]).toLowerCase()}-${index}-jsonld`}
          data={item}
        />
      ))}

      <AppHeader
        title="دليل المتاجر"
        innerClassName="mx-auto flex max-w-7xl flex-col items-start gap-3 px-4 py-3 sm:px-6 lg:px-8"
        titleActions={
          <InstallPwaAction
            appName={CUSTOMER_PWA.name}
            buttonText="تنزيل التطبيق"
          />
        }
      />

      <main className="flex-1">
        <section className="border-b border-gray-200/70 bg-white px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Link
              href="/"
              className="mb-5 inline-flex text-sm font-bold text-[#0F5A3D] transition-colors hover:text-[#27AE60]"
            >
              العودة لدليل المتاجر
            </Link>
            <h1 className="text-3xl font-black leading-tight text-[#222B2E] sm:text-5xl">
              {categoryName} في{" "}
              {selectedDeliveryArea?.nameAr || page.area.nameAr}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600">
              {selectedDeliveryArea
                ? "هذه المتاجر توصل إلى منطقة التوصيل التي اخترتها."
                : "اختر منطقة التوصيل الدقيقة أولاً لعرض المتاجر التي تخدم عنوانك."}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {selectedDeliveryArea ? (
                <>
                  <Link
                    href={`/stores/${encodeURIComponent(page.area.slug)}/${encodeURIComponent(page.category.slug)}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5ED] px-4 py-2 text-sm font-bold text-[#0F5A3D] transition-colors hover:bg-[#D1EBDC]"
                    title="تغيير منطقة التوصيل"
                  >
                    <span>التوصيل إلى {selectedDeliveryArea.nameAr}</span>
                    <X className="h-4 w-4" />
                  </Link>
                  <span className="rounded-full bg-[#E8F5ED] px-4 py-2 text-sm font-bold text-[#0F5A3D]">
                    {storesCount} متجر
                  </span>
                </>
              ) : null}
              {page.area.city && (
                <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600">
                  {page.area.city}
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          {!selectedDeliveryArea ? (
            <div className="mx-auto max-w-2xl rounded-xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-xl font-black text-[#222B2E]">
                اختر منطقة التوصيل
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                لن نعرض أي متجر قبل التأكد أنه يوصل إلى منطقتك داخل{" "}
                {page.area.nameAr}.
              </p>
              <div className="mt-5">
                <AreaAutocomplete
                  areas={page.deliveryAreas.map((deliveryArea) => ({
                    name: deliveryArea.nameAr,
                    nameEn: deliveryArea.nameEn,
                    slug: deliveryArea.slug,
                    destinationSlug: page.area.slug,
                    parentNameAr: page.area.nameAr,
                    stores: deliveryArea.storesCount,
                  }))}
                  destination={{
                    type: "category",
                    categorySlug: page.category.slug,
                  }}
                  placeholder="ابحث عن منطقة التوصيل..."
                  emptyMessage="لا توجد منطقة توصيل متاحة لهذا القسم"
                />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {page.deliveryAreas.map((deliveryArea) => (
                  <Link
                    key={deliveryArea.id}
                    href={`/stores/${encodeURIComponent(
                      page.area.slug,
                    )}/${encodeURIComponent(
                      page.category.slug,
                    )}?deliveryArea=${encodeURIComponent(deliveryArea.slug)}`}
                    className="rounded-full border border-gray-200 bg-[#F7F8F6] px-4 py-2 text-sm font-semibold text-[#0F5A3D] transition-colors hover:border-[#27AE60]/30 hover:bg-[#E8F5ED]"
                  >
                    {deliveryArea.nameAr}
                    <span className="mr-1 text-xs text-gray-500">
                      ({deliveryArea.storesCount})
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : page.stores.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {page.stores.map((store) => (
                <StoreCard
                  key={store.id}
                  store={store}
                  categorySlug={categorySlug}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm">
              <h2 className="text-xl font-bold text-[#222B2E]">
                لا توجد متاجر متاحة حالياً
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-600">
                لا يوجد {categoryName} متاح للتوصيل إلى{" "}
                {selectedDeliveryArea.nameAr} الآن. جرّب منطقة أخرى.
              </p>
              <Link
                href={`/stores/${encodeURIComponent(
                  page.area.slug,
                )}/${encodeURIComponent(page.category.slug)}`}
                className="mt-6 inline-flex rounded-lg bg-[#0F5A3D] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#27AE60]"
              >
                تغيير منطقة التوصيل
              </Link>
            </div>
          )}
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
