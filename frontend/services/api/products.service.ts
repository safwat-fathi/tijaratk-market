import HttpService from '@/services/base/http.service';
import {
  CatalogItemsResponse,
  BulkEssentialStage,
  Product,
  ProductOrderConfig,
  PublicProductCategory,
  PublicProductsResponse,
  TenantProductsSearchResponse,
} from '@/types/models/product';

const PUBLIC_STOREFRONT_REVALIDATE_SECONDS = 60;

class ProductsService extends HttpService {
  constructor() {
    super('/products');
  }

  public async getProducts() {
    return this.get<Product[]>('', undefined, {
      cache: 'no-store',
      authRequired: true,
    });
  }

  public async searchProducts(params: {
    search: string;
    category?: string;
    page?: number;
    limit?: number;
    rank_all?: boolean;
    exclude_product_ids?: string;
  }) {
    return this.get<TenantProductsSearchResponse>('', params, {
      cache: 'no-store',
      authRequired: true,
    });
  }

  public async getPublicProducts(
    slug: string,
    params?: { search?: string; category?: string; page?: number; limit?: number },
  ) {
    return this.get<PublicProductsResponse>(`public/${slug}`, params, {
      next: { revalidate: PUBLIC_STOREFRONT_REVALIDATE_SECONDS },
    });
  }

  public async getPublicProductCategories(slug: string) {
    return this.get<PublicProductCategory[]>(`public/${slug}/categories`, undefined, {
      next: { revalidate: PUBLIC_STOREFRONT_REVALIDATE_SECONDS },
    });
  }

  public async createProduct(payload: FormData | {
    name: string;
    image_url?: string;
    current_price?: number;
    category?: string;
    is_available?: boolean;
    order_mode?: 'quantity' | 'weight' | 'price';
    order_config?: ProductOrderConfig;
  }) {
    return this.post<Product>('', payload, undefined, {
      authRequired: true,
      timeoutMs: payload instanceof FormData ? 30000 : undefined,
    });
  }

  public async addProductFromCatalog(catalogItemId: number) {
    return this.post<Product>(
      'from-catalog',
      { catalog_item_id: catalogItemId },
      undefined,
      { authRequired: true }
    );
  }

  public async getBulkEssentialStages() {
    return this.get<BulkEssentialStage[]>('bulk-essentials/stages', undefined, {
      cache: 'no-store',
      authRequired: true,
    });
  }

  public async bulkAddEssentialItems(payload: {
    category?: string;
    catalog_item_ids?: number[];
    categories?: string[];
  }) {
    return this.post<{ count: number }>(
      'bulk-essentials',
      payload,
      undefined,
      { authRequired: true }
    );
  }

  public async updateProduct(productId: number, payload: FormData) {
    return this.patch<Product>(`${productId}`, payload, undefined, {
      authRequired: true,
      timeoutMs: 30000,
    });
  }

  public async removeProduct(productId: number) {
    return this.delete<void>(`${productId}`, undefined, {
      authRequired: true,
    });
  }

  public async getCatalogCategories() {
    return this.get<PublicProductCategory[]>('catalog/categories', undefined, {
      cache: 'no-store',
      authRequired: true,
    });
  }

  public async getProductCategories() {
    return this.get<string[]>('categories', undefined, {
      cache: 'no-store',
      authRequired: true,
    });
  }

  public async getCatalogItems(params?: {
    search?: string;
    category?: string;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.search) {
      query.set('search', params.search);
    }
    if (params?.category) {
      query.set('category', params.category);
    }
    if (params?.page) {
      query.set('page', String(params.page));
    }
    if (params?.limit) {
      query.set('limit', String(params.limit));
    }
    const search = query.toString();
    const route = search ? `catalog?${search}` : 'catalog';

    return this.get<CatalogItemsResponse>(route, undefined, {
      cache: 'no-store',
      authRequired: true,
    });
  }

  public async getHiddenCatalogItems(params?: {
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.page) {
      query.set('page', String(params.page));
    }
    if (params?.limit) {
      query.set('limit', String(params.limit));
    }
    const search = query.toString();
    const route = search ? `catalog/hidden?${search}` : 'catalog/hidden';

    return this.get<CatalogItemsResponse>(route, undefined, {
      cache: 'no-store',
      authRequired: true,
    });
  }

  public async hideCatalogItem(catalogItemId: number) {
    return this.post<{ success: boolean }>(`catalog/${catalogItemId}/hide`, undefined, undefined, {
      authRequired: true,
    });
  }

  public async unhideCatalogItem(catalogItemId: number) {
    return this.post<{ success: boolean }>(`catalog/${catalogItemId}/unhide`, undefined, undefined, {
      authRequired: true,
    });
  }
}

export const productsService = new ProductsService();
