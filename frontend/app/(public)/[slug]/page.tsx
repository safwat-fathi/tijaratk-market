import StoreHeader, {
  resolveTenantCategoryMeta,
} from "./_components/StoreHeader";

import OrderForm from "./_components/OrderForm";

import { tenantsService } from "@/services/api/tenants.service";
import { productsService } from "@/services/api/products.service";
import { ordersService } from "@/services/api/orders.service";

// Types
import { Tenant } from "@/types/models/tenant";
import {
  Product,
  PublicProductCategory,
  PublicProductsMeta,
} from "@/types/models/product";
import { Order } from "@/types/models/order";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getCustomerProfileBySlugFromCookie } from "@/lib/tracking/customer-tracking-cookie";
import MetaStorefrontView from "@/components/analytics/MetaStorefrontView";
import CustomerAnalytics from "@/components/analytics/CustomerAnalytics";

type StoreSearchParams = {
  reorder?: string;
  category?: string;
  areaSlug?: string;
  categorySlug?: string;
  src?: string;
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<StoreSearchParams>;
};

// Fetch data
async function getTenant(slug: string): Promise<Tenant | null> {
  const response = await tenantsService.getPublicTenant(slug);

  if (!response.success || !response.data) return null;
  return response.data;
}

const EMPTY_PRODUCTS_META: PublicProductsMeta = {
  total: 0,
  page: 1,
  limit: 20,
  last_page: 1,
  has_next: false,
};

async function getInitialProducts(
  slug: string,
  category?: string,
): Promise<{
  products: Product[];
  meta: PublicProductsMeta;
}> {
  const response = await productsService.getPublicProducts(slug, {
    category,
    page: 1,
    limit: 20,
  });

  if (!response.success || !response.data) {
    return {
      products: [],
      meta: EMPTY_PRODUCTS_META,
    };
  }

  return {
    products: response.data.data,
    meta: response.data.meta,
  };
}

async function getPublicCategories(
  slug: string,
): Promise<PublicProductCategory[]> {
  const response = await productsService.getPublicProductCategories(slug);
  if (!response.success || !response.data) return [];
  return response.data;
}

async function getOrder(token?: string): Promise<Order | null> {
  if (!token) return null;
  try {
    const response = await ordersService.getOrderByPublicToken(token);
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getTenant(slug);

  if (!tenant) return { title: "المتجر غير موجود" };

  const categoryLabel = resolveTenantCategoryMeta(tenant.category).labels.ar;
  const title = `${tenant.name} | ${categoryLabel}`;
  const description = `اطلب الآن من ${tenant.name}، متخصصون في ${categoryLabel}. تصفح المنتجات واطلب بسهولة عبر تجارتك.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/${slug}`,
    },
    manifest: `/pwa/storefront/${encodeURIComponent(slug)}/manifest`,
    keywords: [
      tenant.name,
      categoryLabel,
      "تجارتك",
      "طلب أونلاين",
      "قائمة المنتجات",
    ],
    openGraph: {
      title,
      description,
      type: "website",
      url: `https://tijaratk.com/${slug}`,
      siteName: "تجارتك",
      images: [
        {
          url: tenant.directory_profile?.logo_url || "/og-image.jpg",
          width: tenant.directory_profile?.logo_url ? 400 : 1200,
          height: tenant.directory_profile?.logo_url ? 400 : 600,
          alt: tenant.name,
        },
      ],
    },
    twitter: {
      card: tenant.directory_profile?.logo_url
        ? "summary"
        : "summary_large_image",
      title,
      description,
      images: [tenant.directory_profile?.logo_url || "/og-image.jpg"],
    },
  };
}

export default async function StorePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const { reorder, category, areaSlug, categorySlug, src } =
    resolvedSearchParams;

  const tenant = await getTenant(slug);
  if (!tenant || !tenant.id) {
    notFound();
  }

  const [{ products, meta }, categories, initialOrder, savedCustomerProfile] =
    await Promise.all([
      getInitialProducts(slug, category),
      getPublicCategories(slug),
      getOrder(reorder),
      getCustomerProfileBySlugFromCookie(tenant.slug),
    ]);

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-background flex flex-col">
      <CustomerAnalytics
        pageLocation={`/${encodeURIComponent(slug)}`}
        pageTitle={tenant.name}
      />
      <MetaStorefrontView
        contentId={`tenant:${tenant.id}`}
        storefrontType="tenant"
      />
      <StoreHeader tenant={tenant} />
      
      {!tenant.onboarding_completed ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-4xl">🚧</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">المتجر قيد التجهيز</h2>
          <p className="text-gray-500 max-w-xs">
            هذا المتجر يقوم حالياً بإعداد قائمة المنتجات وسيتم افتتاحه قريباً للطلبات!
          </p>
        </div>
      ) : (
        <div className="min-w-0">
          <OrderForm
            tenantSlug={tenant.slug}
            areaSlug={areaSlug}
            landingAttribution={{
              source: src,
              areaSlug,
              categorySlug,
              landedAt: new Date().toISOString(),
            }}
            isPharmacy={tenant.category === "pharmacy"}
            tenantCategory={tenant.category}
            deliverySettings={tenant}
            initialCategory={category}
            initialProducts={products}
            initialProductsMeta={meta}
            initialCategories={categories}
            initialOrder={initialOrder}
            savedCustomerProfile={savedCustomerProfile}
          />
          <div className="p-4 text-center text-xs text-gray-500 mt-4 border-t border-gray-100">
            <p>
              هذا المتجر مدعوم تقنياً بواسطة منصة <a href="/" className="text-brand-primary font-bold hover:underline">تجارتك</a>. 
            </p>
            <p className="mt-1">
              التاجر ({tenant.name}) هو المسؤول عن توفر المنتجات، جودتها، التسعير، وسياسة الإرجاع.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
