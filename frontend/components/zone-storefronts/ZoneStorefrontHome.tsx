import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Pill,
  ShieldCheck,
  ShoppingBasket,
  Truck,
} from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import InstallPwaAction from "@/components/pwa/InstallPwaAction";
import JsonLd from "@/components/seo/JsonLd";
import ZoneAutocomplete, {
  type ZoneSearchOption,
} from "@/components/zone-storefronts/ZoneAutocomplete";
import { SITE_URL } from "@/lib/marketing-seo";
import type { ZoneStorefront } from "@/types/models/zone-storefront";

type Props = {
  zones: ZoneStorefront[];
};

const getCategoryLabel = (category: ZoneStorefront["category"]) =>
  category === "pharmacy" ? "صيدلية" : "سوبر ماركت";

const getDeliveryFeeLabel = (deliveryFee?: number | string) => {
  const fee = Number(deliveryFee ?? 0);
  return Number.isFinite(fee) && fee > 0 ? `${fee} ج.م` : "مجاني";
};

const toSearchOptions = (zones: ZoneStorefront[]): ZoneSearchOption[] =>
  zones.map((zone) => ({
    name: zone.area.name_ar,
    nameEn: zone.area.name_en,
    slug: zone.area.slug,
    zoneSlug: zone.slug,
    category: zone.category,
  }));

const buildZoneJsonLd = (zones: ZoneStorefront[]) => [
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "اطلب احتياجات منطقتك من تجارتك",
    description:
      "اختر منطقتك واطلب مباشرة من خدمة السوبر ماركت أو الصيدلية المتاحة عبر واجهة تجارتك المركزية.",
    url: SITE_URL,
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
    name: "مناطق تجارتك المتاحة للطلب",
    itemListElement: zones.map((zone, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `${getCategoryLabel(zone.category)} في ${zone.area.name_ar}`,
      url: `${SITE_URL}/market/${encodeURIComponent(zone.slug)}`,
    })),
  },
];

function ZoneCard({ zone }: { zone: ZoneStorefront }) {
  const isPharmacy = zone.category === "pharmacy";
  const categoryLabel = getCategoryLabel(zone.category);
  const CategoryIcon = isPharmacy ? Pill : ShoppingBasket;

  return (
    <Link
      href={`/market/${encodeURIComponent(zone.slug)}`}
      aria-label={`ابدأ طلب ${categoryLabel} في ${zone.area.name_ar}`}
      className="group flex h-full cursor-pointer flex-col rounded-xl border border-brand-border bg-white p-5 text-right shadow-soft transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-brand-accent hover:shadow-float focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 active:scale-[0.99] sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            isPharmacy
              ? "bg-status-info/10 text-status-info"
              : "bg-brand-soft text-brand-primary"
          }`}
        >
          <CategoryIcon className="h-6 w-6" aria-hidden="true" />
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold ${
            isPharmacy
              ? "border-status-info/20 bg-status-info/10 text-status-info"
              : "border-brand-border bg-brand-soft text-brand-primary"
          }`}
        >
          {categoryLabel}
        </span>
      </div>

      <div className="mt-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
          <MapPin className="h-4 w-4" aria-hidden="true" />
          <span>المنطقة المتاحة</span>
        </div>
        <h3 className="mt-2 text-2xl font-black text-brand-text">
          {zone.area.name_ar}
        </h3>
        {zone.area.name_en && (
          <p className="mt-1 font-latin text-sm text-gray-600" dir="ltr">
            {zone.area.name_en}
          </p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-4 border-t border-brand-border pt-4">
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Truck className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          التوصيل {getDeliveryFeeLabel(zone.delivery_fee)}
        </span>
        <span className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-bold text-white transition-colors duration-200 group-hover:bg-brand-primary-hover">
          ابدأ الطلب
          <ArrowLeft
            className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1"
            aria-hidden="true"
          />
        </span>
      </div>
    </Link>
  );
}

export default function ZoneStorefrontHome({ zones }: Props) {
  const jsonLd = buildZoneJsonLd(zones);
  const searchOptions = toSearchOptions(zones);

  return (
    <div className="flex min-h-dvh flex-col bg-brand-bg" dir="rtl">
      {jsonLd.map((item, index) => (
        <JsonLd
          key={`${item["@type"]}-${index}`}
          id={`zone-home-${String(item["@type"]).toLowerCase()}-${index}-jsonld`}
          data={item}
        />
      ))}

      <AppHeader
        title="تجارتك"
        subtitle="طلبات منطقتك في مكان واحد"
        innerClassName="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8"
        actions={<InstallPwaAction appName="تجارتك" />}
      />

      <main className="flex-1">
        <section className="border-b border-brand-border bg-brand-primary px-4 py-12 text-white sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              واجهة طلب موحدة وآمنة
            </span>
            <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-black leading-tight text-white sm:text-5xl">
              احتياجات منطقتك، أقرب بخطوة
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/85 sm:text-lg">
              اختر منطقتك وادخل مباشرة إلى الخدمة المتاحة فيها، سواء سوبر
              ماركت أو صيدلية. تجارتك تتولى توجيه الطلب للتنفيذ داخل المنطقة.
            </p>
          </div>
        </section>

        <section className="relative z-10 -mt-6 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl rounded-xl border border-brand-border bg-white p-5 shadow-float sm:p-6">
            <ZoneAutocomplete options={searchOptions} />
          </div>
        </section>

        <section
          className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
          aria-labelledby="available-zones-heading"
        >
          <div className="mb-7 flex flex-col gap-2 sm:mb-8">
            <p className="text-sm font-bold text-brand-primary">
              اختر وابدأ طلبك
            </p>
            <h2
              id="available-zones-heading"
              className="text-2xl font-black text-brand-text sm:text-3xl"
            >
              المناطق المتاحة الآن
            </h2>
            <p className="max-w-2xl text-base leading-7 text-gray-600">
              كل منطقة تعرض نوع الخدمة المتاح فيها بوضوح، وتفتح الكتالوج
              المخصص لها مباشرة.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {zones.map((zone) => (
              <ZoneCard key={zone.id} zone={zone} />
            ))}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
