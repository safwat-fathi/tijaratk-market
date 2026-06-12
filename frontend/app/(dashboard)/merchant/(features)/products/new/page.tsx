import ProductOnboardingClient from './_components/ProductOnboardingClient';
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">إضافة منتجات</h1>
        <p className="text-sm text-gray-500">ابدأ بسرعة: اكتب اسم المنتج أو اختر من الكتالوج.</p>
      </div>

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
