import ProductOnboardingClient from './_components/ProductOnboardingClient';
import MerchantCsvUploadClient from './_components/MerchantCsvUploadClient';
import { ProductsGuidedTour } from '@/components/merchant/ProductsGuidedTour';
import { productsService } from '@/services/api/products.service';
import {
  CatalogItemsResponse,
  Product,
  PublicProductCategory,
} from '@/types/models/product';
import { isNextRedirectError } from '@/lib/auth/navigation-errors';
import { createNoIndexMetadata } from '@/lib/marketing-seo';
import { tenantsService } from '@/services/api/tenants.service';
import { Tenant } from '@/types/models/tenant';
import { supportsCatalogForStoreType } from './_utils/product-onboarding';

export const metadata = createNoIndexMetadata(
	"إدارة المنتجات",
	"أضف منتجات جديدة لمتجرك بسهولة، اختر من الكتالوج أو أضف منتجاتك الخاصة.",
);

export const dynamic = 'force-dynamic';

async function getProducts(): Promise<Product[]> {
  try {
    const response = await productsService.getProducts();
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Failed to fetch products', error);
    return [];
  }
}

const CATALOG_PAGE_LIMIT = 40;

const createEmptyCatalogItemsResponse = (): CatalogItemsResponse => ({
  data: [],
  meta: {
    total: 0,
    page: 1,
    limit: CATALOG_PAGE_LIMIT,
    last_page: 1,
    has_next: false,
  },
});

async function getCatalogItems(): Promise<CatalogItemsResponse> {
  try {
    const response = await productsService.getCatalogItems({
      page: 1,
      limit: CATALOG_PAGE_LIMIT,
    });
    if (response.success && response.data) {
      return response.data;
    }
    return createEmptyCatalogItemsResponse();
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Failed to fetch catalog items', error);
    return createEmptyCatalogItemsResponse();
  }
}

async function getProductCategories(): Promise<string[]> {
  try {
    const response = await productsService.getProductCategories();
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Failed to fetch catalog categories', error);
    return [];
  }
}

async function getCatalogCategories(): Promise<PublicProductCategory[]> {
  try {
    const response = await productsService.getCatalogCategories();
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Failed to fetch catalog category summaries', error);
    return [];
  }
}

async function getTenant(): Promise<Tenant | null> {
  try {
    const response = await tenantsService.getMyTenant();
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Failed to fetch tenant', error);
    return null;
  }
}

export default async function NewProductPage() {
  const [products, productCategories, tenant] = await Promise.all([
    getProducts(),
    getProductCategories(),
    getTenant(),
  ]);
  const [catalogItemsResponse, catalogCategories] = supportsCatalogForStoreType(
    tenant?.category,
  )
    ? await Promise.all([getCatalogItems(), getCatalogCategories()])
    : [createEmptyCatalogItemsResponse(), []];

  return (
    <div className="space-y-4">
      <ProductsGuidedTour />
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">إضافة منتجات</h1>
          <a
            href="/api/merchant/products/import-template"
            download
            className="inline-flex items-center justify-center rounded-md border border-brand-border bg-white px-4 py-2 text-sm font-semibold text-brand-text transition hover:border-brand-accent hover:bg-brand-soft/60 shadow-sm"
          >
            <svg className="me-2 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            تحميل قالب الاستيراد CSV
          </a>
        </div>
        <p className="text-sm text-gray-500 mt-2">ابدأ بسرعة: اكتب اسم المنتج أو اختر من الكتالوج أو استخدم قالب الاستيراد.</p>
      </div>

      <MerchantCsvUploadClient />

      <ProductOnboardingClient
        initialProducts={products}
        initialCatalogItems={catalogItemsResponse.data}
        initialCatalogMeta={catalogItemsResponse.meta}
        catalogCategories={catalogCategories}
        productCategories={productCategories}
        storeType={tenant?.category}
      />
    </div>
  );
}
