'use server';

import { revalidatePath } from 'next/cache';

import { productsService } from '@/services/api/products.service';
import { isNextRedirectError } from '@/lib/auth/navigation-errors';
import {
  BulkEssentialStage,
  BulkUpdateProductsPayload,
  BulkUpdateProductsResponse,
  Product,
  CatalogItemsResponse,
  ProductOrderConfig,
  ProductOrderMode,
  ProductStatus,
} from '@/types/models/product';

const UPDATE_PRODUCT_FALLBACK_MESSAGE = 'تعذر تعديل المنتج، حاول مرة أخرى.';
const UPDATE_PRODUCT_IMAGE_SIZE_MESSAGE =
  'حجم الصورة كبير. الحد الأقصى 15 ميجابايت.';
const UPDATE_PRODUCT_IMAGE_FORMAT_MESSAGE =
  'صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WEBP أو HEIC أو HEIF.';
const UPDATE_PRODUCT_TIMEOUT_MESSAGE =
  'استغرق رفع/معالجة الصورة وقتًا أطول من المتوقع. حاول مرة أخرى.';

type LoadCatalogItemsParams = {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
};

export async function loadProductsAction(
  status: ProductStatus = 'active',
): Promise<{
  success: boolean;
  data?: Product[];
  message?: string;
}> {
  try {
    const response = await productsService.getProducts({ status });

    if (!response.success || !response.data) {
      return {
        success: false,
        message: response.message || 'تعذر تحميل المنتجات',
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    console.error('Load products failed:', error);
    return {
      success: false,
      message: 'تعذر تحميل المنتجات',
    };
  }
}

const normalizeUpdateProductErrorMessage = (
  message?: string,
): string => {
  const normalized = message?.trim();
  if (!normalized) {
    return UPDATE_PRODUCT_FALLBACK_MESSAGE;
  }

  if (
    /(unsupported image format|unsupported codec|صيغة الصورة غير مدعومة)/i.test(
      normalized,
    )
  ) {
    return UPDATE_PRODUCT_IMAGE_FORMAT_MESSAGE;
  }

  if (
    /(limit_file_size|payload too large|entity too large|file too large|حجم الصورة|exceed.*(?:size|limit))/i.test(
      normalized,
    )
  ) {
    return UPDATE_PRODUCT_IMAGE_SIZE_MESSAGE;
  }

  if (
    /(timeout|timed out|aborterror|operation was aborted|signal is aborted)/i.test(
      normalized,
    )
  ) {
    return UPDATE_PRODUCT_TIMEOUT_MESSAGE;
  }

  return normalized;
};

const setTrimmedField = (
  payload: FormData,
  key: string,
  value: FormDataEntryValue | null,
) => {
  if (typeof value !== 'string') {
    return;
  }

  const trimmed = value.trim();
  if (trimmed) {
    payload.set(key, trimmed);
  }
};

const setNormalizedAvailabilityField = (
  payload: FormData,
  value: FormDataEntryValue | null,
) => {
  if (typeof value !== 'string') {
    return;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    payload.set('is_available', 'true');
  } else if (normalized === 'false' || normalized === '0') {
    payload.set('is_available', 'false');
  }
};

const normalizeUpdateProductPayload = (formData: FormData): FormData => {
  const normalizedPayload = new FormData();

  setTrimmedField(normalizedPayload, 'name', formData.get('name'));
  setTrimmedField(normalizedPayload, 'current_price', formData.get('current_price'));
  setTrimmedField(normalizedPayload, 'category', formData.get('category'));
  setTrimmedField(normalizedPayload, 'order_mode', formData.get('order_mode'));
  setTrimmedField(normalizedPayload, 'order_config', formData.get('order_config'));
  setNormalizedAvailabilityField(normalizedPayload, formData.get('is_available'));

  const file = formData.get('file');
  if (file instanceof File && file.size > 0) {
    normalizedPayload.set('file', file);
  }

  return normalizedPayload;
};

const buildCreateProductFormData = ({
  name,
  imageUrl,
  currentPrice,
  category,
  orderMode,
  orderConfig,
  imageFile,
}: {
  name: string;
  imageUrl?: string;
  currentPrice?: number;
  category?: string;
  orderMode?: ProductOrderMode;
  orderConfig?: ProductOrderConfig;
  imageFile: File;
}): FormData => {
  const payload = new FormData();
  payload.set('name', name);

  if (imageUrl?.trim()) {
    payload.set('image_url', imageUrl.trim());
  }
  if (typeof currentPrice === 'number') {
    payload.set('current_price', String(currentPrice));
  }
  if (category) {
    payload.set('category', category);
  }
  if (orderMode) {
    payload.set('order_mode', orderMode);
  }
  if (orderConfig) {
    payload.set('order_config', JSON.stringify(orderConfig));
  }

  payload.set('file', imageFile);
  return payload;
};

export async function createProductAction(
  name: string,
  imageUrl?: string,
  currentPrice?: number,
  category?: string,
  orderMode?: ProductOrderMode,
  orderConfig?: ProductOrderConfig,
  imageFile?: File | null,
) {
  try {
    const normalizedCategory = category?.trim() || undefined;
    const normalizedName = name.trim();

    if (imageFile && imageFile.size > 0) {
      const payload = buildCreateProductFormData({
        name: normalizedName,
        imageUrl,
        currentPrice,
        category: normalizedCategory,
        orderMode,
        orderConfig,
        imageFile,
      });

      const response = await productsService.createProduct(payload);

      if (!response.success || !response.data) {
        return {
          success: false,
          message: normalizeUpdateProductErrorMessage(response.message),
        };
      }

      return {
        success: true,
        data: response.data,
      };
    }

    const response = await productsService.createProduct({
      name: normalizedName,
      image_url: imageUrl,
      current_price: currentPrice,
      category: normalizedCategory,
      order_mode: orderMode,
      order_config: orderConfig,
    });

    if (!response.success || !response.data) {
      return {
        success: false,
        message: response.message || 'تعذر إضافة المنتج',
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Create product failed:', error);
    return {
      success: false,
      message: normalizeUpdateProductErrorMessage(
        error instanceof Error ? error.message : undefined,
      ),
    };
  }
}

export async function addProductFromCatalogAction(catalogItemId: number) {
  try {
    const response = await productsService.addProductFromCatalog(catalogItemId);

    if (!response.success || !response.data) {
      return {
        success: false,
        message: response.message || 'تعذر إضافة المنتج من الكتالوج',
      };
    }

    revalidatePath('/merchant/products/new');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Add product from catalog failed:', error);
    return {
      success: false,
      message: 'تعذر إضافة المنتج من الكتالوج',
    };
  }
}

export async function loadBulkEssentialStagesAction(): Promise<{
  success: boolean;
  data?: BulkEssentialStage[];
  message?: string;
}> {
  try {
    const response = await productsService.getBulkEssentialStages();

    if (!response.success || !response.data) {
      return {
        success: false,
        message: response.message || 'تعذر تحميل مجموعات المنتجات الأساسية',
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Load bulk essential stages failed:', error);
    return {
      success: false,
      message: 'تعذر تحميل مجموعات المنتجات الأساسية',
    };
  }
}

export async function bulkAddEssentialItemsAction(
  payload:
    | {
        allEssentialItems: true;
      }
    | {
        category: string;
        catalogItemIds: number[];
      }
    | string[],
) {
  try {
    const response = await productsService.bulkAddEssentialItems(
      Array.isArray(payload)
        ? { categories: payload }
        : "allEssentialItems" in payload
          ? { all_essential_items: payload.allEssentialItems }
        : {
            category: payload.category,
            catalog_item_ids: payload.catalogItemIds,
          },
    );

    if (!response.success || !response.data) {
      return {
        success: false,
        message: response.message || 'تعذر إضافة المنتجات الأساسية',
      };
    }

    revalidatePath('/merchant/products/new');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Bulk add essential items failed:', error);
    return {
      success: false,
      message: 'تعذر إضافة المنتجات الأساسية',
    };
  }
}

export async function loadCatalogItemsAction(
  params: LoadCatalogItemsParams,
): Promise<{
  success: boolean;
  data?: CatalogItemsResponse;
  message?: string;
}> {
  try {
    const response = await productsService.getCatalogItems(params);

    if (!response.success || !response.data) {
      return {
        success: false,
        message: response.message || 'تعذر تحميل منتجات الكتالوج',
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Load catalog items failed:', error);
    return {
      success: false,
      message: 'تعذر تحميل منتجات الكتالوج',
    };
  }
}

export async function updateProductAction(productId: number, formData: FormData) {
  try {
    const normalizedPayload = normalizeUpdateProductPayload(formData);

    const response = await productsService.updateProduct(
      productId,
      normalizedPayload,
    );

    if (!response.success || !response.data) {
      return {
        success: false,
        message: normalizeUpdateProductErrorMessage(response.message),
      };
    }

    return {
      success: true,
      data: response.data as Product,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    console.error('Update product failed:', error);
    const message =
      error instanceof Error ? error.message : undefined;
    return {
      success: false,
      message: normalizeUpdateProductErrorMessage(message),
    };
  }
}

export async function updateProductAvailabilityAction(
  productId: number,
  isAvailable: boolean,
) {
  const formData = new FormData();
  formData.set('is_available', String(isAvailable));
  return updateProductAction(productId, formData);
}

export async function bulkUpdateProductsAction(
  payload: BulkUpdateProductsPayload,
): Promise<{
  success: boolean;
  data?: BulkUpdateProductsResponse;
  message?: string;
}> {
  try {
    const ids = Array.from(
      new Set(
        payload.ids.filter(
          (id) => Number.isInteger(id) && Number.isFinite(id) && id > 0,
        ),
      ),
    );
    const category = payload.category?.trim();
    const hasAction =
      Boolean(category) ||
      payload.is_available !== undefined ||
      payload.status !== undefined;

    if (ids.length === 0 || !hasAction) {
      return {
        success: false,
        message: 'اختر منتجات وإجراء للتطبيق',
      };
    }

    const response = await productsService.bulkUpdateProducts({
      ids,
      category: category || undefined,
      is_available: payload.is_available,
      status: payload.status,
    });

    if (!response.success || !response.data) {
      return {
        success: false,
        message: response.message || 'تعذر تحديث المنتجات المحددة',
      };
    }

    revalidatePath('/merchant/products/new');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    console.error('Bulk update products failed:', error);
    return {
      success: false,
      message: 'تعذر تحديث المنتجات المحددة',
    };
  }
}

export async function removeProductAction(productId: number) {
  try {
    const response = await productsService.removeProduct(productId);

    if (!response.success) {
      return {
        success: false,
        message: response.message || 'تعذر حذف المنتج من المتجر',
      };
    }

    return {
      success: true,
      message: 'اتشال المنتج من المتجر',
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    console.error('Remove product failed:', error);
    return {
      success: false,
      message: 'تعذر حذف المنتج من المتجر',
    };
  }
}

export async function searchTenantProductsAction(
  search: string,
  page = 1,
  limit = 20,
  categoryOrOptions?:
    | string
    | {
        category?: string;
        rankAll?: boolean;
        excludeProductIds?: number[];
        status?: ProductStatus;
      },
) {
  try {
    const normalizedSearch = search.trim();
    if (normalizedSearch.length < 2) {
      return {
        success: true,
        data: {
          data: [],
          meta: {
            total: 0,
            page: 1,
            limit,
            last_page: 1,
            has_next: false,
          },
        },
      };
    }

    const searchOptions =
      typeof categoryOrOptions === 'string'
        ? { category: categoryOrOptions }
        : categoryOrOptions || {};
    const normalizedExcludedProductIds = Array.from(
      new Set(
        (searchOptions.excludeProductIds || []).filter(
          (id): id is number =>
            Number.isInteger(id) && Number.isFinite(id) && id > 0,
        ),
      ),
    );

    const response = await productsService.searchProducts({
      search: normalizedSearch,
      category: searchOptions.category?.trim() || undefined,
      page,
      limit,
      rank_all: searchOptions.rankAll,
      exclude_product_ids:
        normalizedExcludedProductIds.length > 0
          ? normalizedExcludedProductIds.join(',')
          : undefined,
      status: searchOptions.status,
    });

    if (!response.success || !response.data) {
      const message = response.message || 'تعذر تحميل نتائج البحث';
      const isThrottled = /(too many requests|throttl|rate limit)/i.test(message);
      return {
        success: false,
        message: isThrottled
          ? 'طلبات كثيرة، يرجى الانتظار قليلاً قبل البحث مرة أخرى'
          : message,
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    console.error('Search tenant products failed:', error);
    return {
      success: false,
      message: 'تعذر تحميل نتائج البحث',
    };
  }
}

export async function loadHiddenCatalogItemsAction(
  params: { page?: number; limit?: number },
): Promise<{
  success: boolean;
  data?: CatalogItemsResponse;
  message?: string;
}> {
  try {
    const response = await productsService.getHiddenCatalogItems(params);

    if (!response.success || !response.data) {
      return {
        success: false,
        message: response.message || 'تعذر تحميل المنتجات المخفية',
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Load hidden catalog items failed:', error);
    return {
      success: false,
      message: 'تعذر تحميل المنتجات المخفية',
    };
  }
}

export async function hideCatalogItemAction(catalogItemId: number) {
  try {
    const response = await productsService.hideCatalogItem(catalogItemId);

    if (!response.success) {
      return {
        success: false,
        message: response.message || 'تعذر إخفاء المنتج',
      };
    }

    revalidatePath('/merchant/products/new');
    return {
      success: true,
      message: 'تم إخفاء المنتج بنجاح',
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Hide catalog item failed:', error);
    return {
      success: false,
      message: 'تعذر إخفاء المنتج',
    };
  }
}

export async function unhideCatalogItemAction(catalogItemId: number) {
  try {
    const response = await productsService.unhideCatalogItem(catalogItemId);

    if (!response.success) {
      return {
        success: false,
        message: response.message || 'تعذر إظهار المنتج',
      };
    }

    revalidatePath('/merchant/products/new');
    return {
      success: true,
      message: 'تم إظهار المنتج بنجاح',
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Unhide catalog item failed:', error);
    return {
      success: false,
      message: 'تعذر إظهار المنتج',
    };
  }
}
