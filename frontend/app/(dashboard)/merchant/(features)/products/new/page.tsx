import ProductOnboardingClient from './_components/ProductOnboardingClient';
import { productsService } from '@/services/api/products.service';
import { CatalogItemsResponse, Product } from '@/types/models/product';
import { isNextRedirectError } from '@/lib/auth/navigation-errors';
import { createNoIndexMetadata } from '@/lib/marketing-seo';

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

async function getCatalogItems(): Promise<CatalogItemsResponse> {
  try {
    const response = await productsService.getCatalogItems({
      page: 1,
      limit: CATALOG_PAGE_LIMIT,
    });
    if (response.success && response.data) {
      return response.data;
    }
    return {
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: CATALOG_PAGE_LIMIT,
        last_page: 1,
        has_next: false,
      },
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Failed to fetch catalog items', error);
    return {
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: CATALOG_PAGE_LIMIT,
        last_page: 1,
        has_next: false,
      },
    };
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

export default async function NewProductPage() {
  const [products, catalogItemsResponse, productCategories] = await Promise.all([
    getProducts(),
    getCatalogItems(),
    getProductCategories(),
  ]);

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
        productCategories={productCategories}
      />
    </div>
  );
}
