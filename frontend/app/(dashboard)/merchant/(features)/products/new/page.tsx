import ProductOnboardingClient from './_components/ProductOnboardingClient';
import { productsService } from '@/services/api/products.service';
import { CatalogItem, Product } from '@/types/models/product';
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

async function getCatalogItems(): Promise<CatalogItem[]> {
  try {
    const response = await productsService.getCatalogItems();
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Failed to fetch catalog items', error);
    return [];
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
  const [products, catalogItems, productCategories] = await Promise.all([
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
        catalogItems={catalogItems}
        productCategories={productCategories}
      />
    </div>
  );
}
