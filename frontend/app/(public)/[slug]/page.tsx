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

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    reorder?: string;
    category?: string;
    areaSlug?: string;
  }>;
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
  const { reorder, category, areaSlug } = await searchParams;

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
    <div className="mx-auto min-h-screen w-full max-w-md bg-background">
      <StoreHeader tenant={tenant} />
      {/* <WriteOrderFAB /> */}

      <div className="min-w-0">
        {products.length === 0 && (
          <div className="my-6 rounded-lg border border-brand-border bg-white p-4 text-center text-muted-foreground shadow-soft">
            <p className="font-medium text-brand-text">لا توجد منتجات بعد.</p>
            <p className="text-sm">فقط اكتب طلبك بالأسفل.</p>
          </div>
        )}

        <OrderForm
          tenantSlug={tenant.slug}
          areaSlug={areaSlug}
          isPharmacy={tenant.category === "pharmacy"}
          deliverySettings={tenant}
          initialCategory={category}
          initialProducts={products}
          initialProductsMeta={meta}
          initialCategories={categories}
          initialOrder={initialOrder}
          savedCustomerProfile={savedCustomerProfile}
        />
      </div>
    </div>
  );
}
