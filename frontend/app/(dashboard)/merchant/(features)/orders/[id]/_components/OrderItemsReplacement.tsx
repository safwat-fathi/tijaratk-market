'use client';

import { useDebounce } from 'use-debounce';
import { useEffect, useMemo, memo, useRef, useState, useTransition } from 'react';
import {
  markOrderItemOutOfStockAction,
  replaceOrderItemAction,
  resetOrderItemReplacementAction,
  updateOrderItemPriceAction,
} from '@/actions/order-actions';
import {
  createProductAction,
  searchTenantProductsAction,
} from '@/actions/product-actions';
import SafeImage from "@/components/ui/SafeImage";
import { formatCurrency } from '@/lib/utils/currency';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { useDragToClose } from '@/lib/hooks/useDragToClose';
import { getImageUrl } from '@/lib/utils/image';
import { formatArabicQuantity } from '@/lib/utils/number';
import { OrderStatus, ReplacementDecisionStatus } from '@/types/enums';
import { OrderItem } from '@/types/models/order';
import { Product } from '@/types/models/product';

const MIN_SEARCH_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_RESULTS_LIMIT = 20;
const MAX_SEARCH_LENGTH = 120;
const MAX_PRODUCT_NAME_LENGTH = 120;
const MAX_ITEM_PRICE = 99_999.99;
const PRICE_CHIP_VALUES = [10, 20, 50, 100] as const;

type OrderItemsReplacementProps = {
  orderId: number;
  orderStatus: OrderStatus;
  initialItems: OrderItem[];
  products: Product[];
};

const ProductThumbnail = memo(({
  imageUrl,
  name,
  size = 36,
}: {
  imageUrl?: string | null;
  name: string;
  size?: number;
}) => {
  if (imageUrl?.trim()) {
    return (
			<SafeImage
				src={getImageUrl(imageUrl)}
				alt={name}
				width={size}
				height={size}
				unoptimized
				imageClassName="rounded-lg border border-gray-200 bg-gray-50 object-cover"
				fallback={
					<div
						className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-[10px] text-gray-500"
						style={{ width: size, height: size }}
					>
						🛒
					</div>
				}
			/>
		);
  }

  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-[10px] text-gray-500"
      style={{ width: size, height: size }}
    >
      🛒
    </div>
  );
});

ProductThumbnail.displayName = 'ProductThumbnail';

const normalizeCategory = (value?: string | null) => {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : undefined;
};

type ReplacementOptionsLoadResult =
	| { success: true; data: Product[] }
	| { success: false; message: string };

const loadReplacementOptions = async ({
	query,
	category,
	rankAll = false,
	excludeProductIds,
}: {
	query: string;
	category?: string;
	rankAll?: boolean;
	excludeProductIds: number[];
}): Promise<ReplacementOptionsLoadResult> => {
	const response = await searchTenantProductsAction(
		query,
		1,
		SEARCH_RESULTS_LIMIT,
		{
			category,
			rankAll,
			excludeProductIds: excludeProductIds,
		},
	);

	if (!response.success || !response.data) {
		return {
			success: false,
			message: response.message || "تعذر تحميل النتائج",
		};
	}

	return {
		success: true,
		data: response.data.data,
	};
};

const getReplacementButtonLabel = ({
  decisionStatus,
  replacementProductName,
}: {
  decisionStatus: ReplacementDecisionStatus;
  replacementProductName?: string;
}) => {
  if (decisionStatus === ReplacementDecisionStatus.PENDING) {
    return 'تعديل البديل المقترح';
  }

  if (replacementProductName) {
    return 'تغيير البديل';
  }

  return 'استبدال المنتج';
};

export default function OrderItemsReplacement({
  orderId,
  orderStatus,
  initialItems,
  products,
}: OrderItemsReplacementProps) {
  const [availableProducts, setAvailableProducts] = useState<Product[]>(products);
  const [items, setItems] = useState<OrderItem[]>(initialItems);
  const [activeItemId, setActiveItemId] = useState<number | null>(null);
  const [activeSheet, setActiveSheet] = useState<'replacement' | 'price' | null>(
    null,
  );
  const [newProductName, setNewProductName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [suggestedResults, setSuggestedResults] = useState<Product[]>([]);
  const [isLoadingSuggested, setIsLoadingSuggested] = useState(false);
  const [suggestedError, setSuggestedError] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [priceError, setPriceError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [debouncedSearch] = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  useBodyScrollLock(Boolean(activeSheet));

  const closeSheet = () => {
    setActiveItemId(null);
    setActiveSheet(null);
    setNewProductName('');
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setIsSearching(false);
    setIsSearchFocused(false);
    setSuggestedResults([]);
    setSuggestedError(null);
    setIsLoadingSuggested(false);
    setPriceInput('');
    setPriceError(null);
  };

  const sheetRef = useDragToClose<HTMLDivElement>({
    onClose: closeSheet,
    dragThreshold: 80,
    isOpen: Boolean(activeSheet),
  });

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    setAvailableProducts(products);
  }, [products]);

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeItemId) || null,
    [activeItemId, items],
  );
  const activeItemExcludedProductIds = useMemo(() => {
		if (!activeItem) {
			return [];
		}

		return Array.from(
			new Set(
				[
					activeItem.product_id,
					activeItem.pending_replacement_product_id,
					activeItem.replaced_by_product_id,
				].filter(
					(candidateId): candidateId is number =>
						typeof candidateId === "number",
				),
			),
		);
	}, [activeItem]);
  const availableProductsById = useMemo(
    () => new Map(availableProducts.map((product) => [product.id, product])),
    [availableProducts],
  );

  const normalizedSearch = debouncedSearch.trim();
  const isTextSearchActive = normalizedSearch.length >= MIN_SEARCH_CHARS;
  const canEditItemReplacement =
    orderStatus === OrderStatus.DRAFT || orderStatus === OrderStatus.CONFIRMED;
  const canEditItemPrice =
    orderStatus === OrderStatus.DRAFT || orderStatus === OrderStatus.CONFIRMED;
  const canMarkOutOfStock =
    orderStatus === OrderStatus.DRAFT || orderStatus === OrderStatus.CONFIRMED;

  const activeItemCategory = useMemo(() => {
    if (!activeItem) {
      return undefined;
    }

    const candidateProductIds = [
      activeItem.product_id,
      activeItem.pending_replacement_product_id,
      activeItem.replaced_by_product_id,
    ];

    for (const candidateId of candidateProductIds) {
      if (typeof candidateId !== 'number') {
        continue;
      }

      const product = availableProductsById.get(candidateId);
      const category = normalizeCategory(product?.category);
      if (category) {
        return category;
      }
    }

    return undefined;
  }, [activeItem, availableProductsById]);

  const activeItemInitialSuggestionQuery = useMemo(() => {
    if (!activeItem) {
      return '';
    }

    const originalProduct =
      typeof activeItem.product_id === 'number'
        ? availableProductsById.get(activeItem.product_id)
        : undefined;

    return (
      originalProduct?.name?.trim() ||
      activeItem.name_snapshot?.trim() ||
      activeItem.pending_replacement_product?.name?.trim() ||
      activeItem.replaced_by_product?.name?.trim() ||
      ''
    );
  }, [activeItem, availableProductsById]);

  useEffect(() => {
    if (!activeItem || activeSheet !== 'replacement') {
      return;
    }

    const initialQuery = activeItemInitialSuggestionQuery;

    if (initialQuery.length < MIN_SEARCH_CHARS) {
      setSuggestedResults([]);
      setSuggestedError(null);
      setIsLoadingSuggested(false);
      return;
    }

    const controller = new AbortController();
    setIsLoadingSuggested(true);
    setSuggestedError(null);

    void (async () => {
      const response = await loadReplacementOptions({
				query: initialQuery,
				category: activeItemCategory,
				rankAll: true,
				excludeProductIds: activeItemExcludedProductIds,
			});

      if (controller.signal.aborted) {
        return;
      }

      if (!response.success) {
				setSuggestedResults([]);
				setSuggestedError(response.message || "تعذر تحميل المنتجات المشابهة");
				setIsLoadingSuggested(false);
				return;
			}

      setSuggestedResults(response.data);
      setSuggestedError(null);
      setIsLoadingSuggested(false);
    })();

    return () => {
      controller.abort();
    };
  }, [
    activeItem,
    activeItemCategory,
    activeItemExcludedProductIds,
    activeItemInitialSuggestionQuery,
    activeSheet,
  ]);

  useEffect(() => {
		if (!activeItemId || activeSheet !== "replacement") {
			return;
		}

		if (!isTextSearchActive) {
			setSearchResults([]);
			setSearchError(null);
			setIsSearching(false);
			return;
		}

		const controller = new AbortController();
		setIsSearching(true);
		setSearchError(null);

		void (async () => {
			const response = await loadReplacementOptions({
				query: normalizedSearch,
				category: activeItemCategory,
				rankAll: false,
				excludeProductIds: activeItemExcludedProductIds,
			});

			if (controller.signal.aborted) {
				return;
			}

			if (!response.success) {
				setSearchResults([]);
				setSearchError(response.message || "تعذر تحميل نتائج البحث");
				setIsSearching(false);
				return;
			}

			setSearchResults(response.data);
			setIsSearching(false);
		})();

		return () => {
			controller.abort();
		};
	}, [
		activeItemCategory,
		activeItemExcludedProductIds,
		activeItemId,
		activeSheet,
		isTextSearchActive,
		normalizedSearch,
	]);
  const replacementOptions = isTextSearchActive
    ? searchResults
    : suggestedResults;

  const handleClearReplacementSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setIsSearching(false);
    searchInputRef.current?.focus();
  };

  const openReplacementSheet = (itemId: number) => {
    if (!canEditItemReplacement) {
      setFeedback('الاستبدال متاح في حالتي جديد ومؤكد فقط');
      return;
    }

    setActiveItemId(itemId);
    setActiveSheet('replacement');
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setIsSearching(false);
    setSuggestedResults([]);
    setSuggestedError(null);
    setIsLoadingSuggested(false);
    setPriceInput('');
    setPriceError(null);
  };

  const openPriceSheet = (itemId: number) => {
    const selectedItem = items.find((item) => item.id === itemId);
    const initialValue =
      selectedItem?.total_price !== null && selectedItem?.total_price !== undefined
        ? String(Number(selectedItem.total_price))
        : '';

    setActiveItemId(itemId);
    setActiveSheet('price');
    setPriceInput(initialValue);
    setPriceError(null);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
  };

  const applyPendingReplacement = (itemId: number, product: Product | null) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        return {
          ...item,
          replaced_by_product_id: null,
          replaced_by_product: null,
          pending_replacement_product_id: product?.id || null,
          pending_replacement_product: product
            ? {
                id: product.id,
                name: product.name,
                image_url: product.image_url || null,
              }
            : null,
          replacement_decision_status: product
            ? ReplacementDecisionStatus.PENDING
            : ReplacementDecisionStatus.NONE,
          replacement_decision_reason: null,
          replacement_decided_at: null,
        };
      }),
    );
  };

  const applyLinePrice = (itemId: number, totalPrice: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              total_price: totalPrice,
            }
          : item,
      ),
    );
  };

  const applyOutOfStock = (itemId: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              is_out_of_stock: true,
              out_of_stock_at: new Date().toISOString(),
              unit_price: 0,
              total_price: 0,
            }
          : item,
      ),
    );
  };

  const applyResetDecision = (itemId: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              replaced_by_product_id: null,
              replaced_by_product: null,
              pending_replacement_product_id: null,
              pending_replacement_product: null,
              replacement_decision_status: ReplacementDecisionStatus.NONE,
              replacement_decision_reason: null,
              replacement_decided_at: null,
            }
          : item,
      ),
    );
  };

  const handleSelectReplacement = (itemId: number, product: Product) => {
    if (!canEditItemReplacement) {
      setFeedback('الاستبدال متاح في حالتي جديد ومؤكد فقط');
      return;
    }

    startTransition(async () => {
      const response = await replaceOrderItemAction(orderId, itemId, product.id);

      if (!response.success) {
        setFeedback(response.error || 'تعذر تحديث البديل');
        return;
      }

      applyPendingReplacement(itemId, product);
      setFeedback(`تم إرسال بديل ${product.name} لموافقة العميل`);
      closeSheet();
    });
  };

  const handleClearReplacement = (itemId: number) => {
    if (!canEditItemReplacement) {
      setFeedback('الاستبدال متاح في حالتي جديد ومؤكد فقط');
      return;
    }

    startTransition(async () => {
      const response = await replaceOrderItemAction(orderId, itemId, null);

      if (!response.success) {
        setFeedback(response.error || 'تعذر إزالة البديل');
        return;
      }

      applyPendingReplacement(itemId, null);
      setFeedback('تمت إزالة طلب الاستبدال');
      closeSheet();
    });
  };

  const handleResetReplacementDecision = (itemId: number) => {
    if (!canEditItemReplacement) {
      setFeedback('الاستبدال متاح في حالتي جديد ومؤكد فقط');
      return;
    }

    startTransition(async () => {
      const response = await resetOrderItemReplacementAction(orderId, itemId);

      if (!response.success) {
        setFeedback(response.error || 'تعذر إعادة ضبط قرار الاستبدال');
        return;
      }

      applyResetDecision(itemId);
      setFeedback('تمت إعادة فتح الاستبدال للصنف');
      closeSheet();
    });
  };

  const handleCreateAndSelect = () => {
    if (!canEditItemReplacement) {
      setFeedback('الاستبدال متاح في حالتي جديد ومؤكد فقط');
      return;
    }

    if (!activeItem) {
      return;
    }

    const trimmedName = newProductName.trim();
    if (!trimmedName) {
      setFeedback('اكتب اسم المنتج أولاً');
      return;
    }

    startTransition(async () => {
      const createResponse = await createProductAction(
        trimmedName,
        undefined,
        undefined,
        activeItemCategory,
      );

      if (!createResponse.success || !createResponse.data) {
        setFeedback(createResponse.message || 'تعذر إضافة المنتج');
        return;
      }

      const product = createResponse.data as Product;
      setAvailableProducts((prev) => [product, ...prev]);
      const replaceResponse = await replaceOrderItemAction(
        orderId,
        activeItem.id,
        product.id,
      );

      if (!replaceResponse.success) {
        setFeedback(
          replaceResponse.error || 'تم إنشاء المنتج لكن تعذر ربطه كبديل',
        );
        return;
      }

      applyPendingReplacement(activeItem.id, product);
      setFeedback(`تم إرسال البديل ${product.name} لموافقة العميل`);
      closeSheet();
    });
  };

  const handleSaveLinePrice = () => {
    if (!activeItem) {
      return;
    }

    const parsedPrice = Number(priceInput);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setPriceError('ادخل سعرًا صحيحًا أكبر من صفر');
      return;
    }

    if (parsedPrice > MAX_ITEM_PRICE) {
      setPriceError(`الحد الأقصى للسعر هو ${MAX_ITEM_PRICE.toLocaleString('ar-EG')} ج.م`);
      return;
    }

    const roundedPrice = Math.round(parsedPrice * 100) / 100;

    startTransition(async () => {
      const response = await updateOrderItemPriceAction(
        orderId,
        activeItem.id,
        roundedPrice,
      );

      if (!response.success) {
        setPriceError(response.error || 'تعذر تحديث السعر');
        return;
      }

      applyLinePrice(activeItem.id, roundedPrice);
      setFeedback(`تم تحديث سعر ${activeItem.name_snapshot}`);
      closeSheet();
    });
  };

  const handleMarkOutOfStock = (item: OrderItem) => {
    if (!canMarkOutOfStock) {
      setFeedback('تحديد عدم التوفر متاح في حالتي جديد ومؤكد فقط');
      return;
    }

    if (item.is_out_of_stock) {
      setFeedback('تم تحديد هذا الصنف كغير متوفر بالفعل');
      return;
    }

    startTransition(async () => {
      const response = await markOrderItemOutOfStockAction(orderId, item.id);

      if (!response.success) {
        setFeedback(response.error || 'تعذر تحديد الصنف كغير متوفر');
        return;
      }

      applyOutOfStock(item.id);
      setFeedback(`تم تحديد ${item.name_snapshot} كغير متوفر وإيقافه من المتجر`);
    });
  };

  const formatLinePrice = (value: number | string | null | undefined) => {
    return formatCurrency(value) || 'غير محدد';
  };

  const getItemDecisionStatus = (item: OrderItem) =>
    item.replacement_decision_status || ReplacementDecisionStatus.NONE;
  const isReplacementResultsLoading = isTextSearchActive
    ? isSearching
    : isLoadingSuggested;
  const replacementResultsError = isTextSearchActive ? searchError : suggestedError;

  return (
		<section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
			<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
				العناصر
			</h2>

			{feedback && (
				<p className="mb-3 text-sm font-medium text-brand-primary">{feedback}</p>
			)}

			<div className="space-y-3">
				{items.length > 0 ? (
					items.map(item => {
						const replacementProduct = item.replaced_by_product;
						const pendingProduct = item.pending_replacement_product;
						const decisionStatus = getItemDecisionStatus(item);
						const isDecisionLocked =
							decisionStatus === ReplacementDecisionStatus.APPROVED ||
							decisionStatus === ReplacementDecisionStatus.REJECTED;
						const isOutOfStock = Boolean(item.is_out_of_stock);

						return (
							<div
								key={item.id}
								className={`rounded-xl border p-3 ${
									isOutOfStock
										? "border-red-200 bg-red-50/50"
										: "border-gray-200"
								}`}
							>
								<div className="flex justify-between gap-3">
									<div>
										<div className="flex flex-wrap items-center gap-2">
											<p className="font-semibold text-gray-900">
												{item.name_snapshot}
											</p>
											{isOutOfStock && (
												<span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
													غير متوفر
												</span>
											)}
										</div>
										<p className="text-sm text-gray-500">
											الكمية:{" "}
											{formatArabicQuantity(item.quantity) || item.quantity}
										</p>
										<p className="mt-1 text-sm font-semibold text-gray-800">
											السعر:{" "}
											{isOutOfStock
												? "محذوف من الإجمالي"
												: formatLinePrice(item.total_price)}
										</p>
									</div>
								</div>

								<div className="mt-3 grid grid-cols-3 gap-2">
									<button
										type="button"
										onClick={() => openReplacementSheet(item.id)}
										disabled={isDecisionLocked || !canEditItemReplacement}
										className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
									>
										{getReplacementButtonLabel({
											decisionStatus,
											replacementProductName: replacementProduct?.name,
										})}
									</button>

									<button
										type="button"
										onClick={() => openPriceSheet(item.id)}
										disabled={!canEditItemPrice || isOutOfStock}
										className="rounded-md bg-brand-primary px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
									>
										تسعير المنتج
									</button>

									<button
										type="button"
										onClick={() => handleMarkOutOfStock(item)}
										disabled={!canMarkOutOfStock || isPending || isOutOfStock}
										className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
									>
										غير متوفر
									</button>
								</div>

								{!canEditItemPrice && (
									<p className="mt-2 text-xs text-gray-500">
										تعديل السعر متاح في حالتي جديد ومؤكد فقط
									</p>
								)}

								{!canEditItemReplacement && (
									<p className="mt-2 text-xs text-gray-500">
										الاستبدال متاح في حالتي جديد ومؤكد فقط
									</p>
								)}

								{isOutOfStock && (
									<p className="mt-2 rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700">
										تم حذف الصنف من إجمالي الطلب وإيقاف المنتج من المتجر.
									</p>
								)}

								{decisionStatus === ReplacementDecisionStatus.PENDING &&
									pendingProduct?.name && (
										<div className="mt-2 flex items-center gap-2 text-sm font-medium text-amber-700">
											<ProductThumbnail
												imageUrl={pendingProduct?.image_url}
												name={pendingProduct.name}
												size={28}
											/>
											<p>بانتظار موافقة العميل على: {pendingProduct.name}</p>
										</div>
									)}

								{decisionStatus === ReplacementDecisionStatus.APPROVED &&
									replacementProduct?.name && (
										<div className="mt-2 flex items-center gap-2 text-sm font-medium text-green-700">
											<ProductThumbnail
												imageUrl={replacementProduct?.image_url}
												name={replacementProduct.name}
												size={28}
											/>
											<p>وافق العميل على البديل: {replacementProduct.name}</p>
										</div>
									)}

								{decisionStatus === ReplacementDecisionStatus.REJECTED && (
									<div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
										<p>رفض العميل البديل المقترح.</p>
										{item.replacement_decision_reason && (
											<p className="mt-1 text-xs text-red-600">
												السبب: {item.replacement_decision_reason}
											</p>
										)}
									</div>
								)}

								{isDecisionLocked && (
									<button
										type="button"
										onClick={() => handleResetReplacementDecision(item.id)}
										disabled={isPending || !canEditItemReplacement}
										className="mt-3 w-full rounded-md border border-brand-border bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-primary disabled:opacity-60"
									>
										إعادة فتح قرار الاستبدال
									</button>
								)}

								{item.notes && (
									<p className="mt-2 text-xs text-amber-700">
										ملاحظة: {item.notes}
									</p>
								)}
							</div>
						);
					})
				) : (
					<p className="italic text-gray-400">لا توجد عناصر</p>
				)}
			</div>

			{activeItem && activeSheet && (
				<div
					className="fixed inset-0 z-50 bg-black/40"
					role="dialog"
					aria-modal="true"
				>
					<button
						type="button"
						aria-label="close"
						className="absolute inset-0 h-full w-full"
						onClick={closeSheet}
					/>

					<div 
						ref={sheetRef}
						className={`absolute bottom-0 left-0 right-0 flex flex-col overflow-hidden rounded-t-xl bg-white shadow-float transition-[max-height,transform] duration-300 ${
							isSearchFocused ? "max-h-[100dvh] h-[100dvh]" : "max-h-[85dvh]"
						}`}
					>
						<div className="shrink-0 px-4 pb-2 pt-4 border-b border-gray-100">
							<div className="mx-auto h-1.5 w-12 rounded-full bg-gray-300 mb-4" />
							
							{activeSheet === "replacement" && (
								<div className="pb-2">
									<h3 className="text-lg font-bold text-gray-900 leading-tight">
										اختر المنتج البديل
									</h3>
									<p className="text-sm text-gray-500 mb-3">
										بديل لـ: {activeItem.name_snapshot}
									</p>

									{activeItem.replacement_decision_status !==
										ReplacementDecisionStatus.APPROVED &&
										activeItem.replacement_decision_status !==
											ReplacementDecisionStatus.REJECTED &&
										canEditItemReplacement && (
											<div className="relative">
												<input
													ref={searchInputRef}
													value={searchQuery}
													onFocus={() => setIsSearchFocused(true)}
													onBlur={() => {
														// Small delay to allow click on results before shrinking
														setTimeout(() => setIsSearchFocused(false), 200);
													}}
													onChange={event =>
														setSearchQuery(event.target.value)
													}
													maxLength={MAX_SEARCH_LENGTH}
													placeholder="ابحث بالاسم..."
											className="w-full rounded-md border border-brand-border bg-brand-soft/40 px-4 py-3 pe-10 text-sm font-medium focus:border-brand-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
												/>
												{searchQuery && (
													<button
														type="button"
														onClick={handleClearReplacementSearch}
														aria-label="مسح البحث"
														className="absolute inset-y-0 end-0 flex items-center pe-3 text-gray-400 transition-colors hover:text-gray-600"
													>
														<svg
															className="h-5 w-5"
															xmlns="http://www.w3.org/2000/svg"
															fill="none"
															viewBox="0 0 24 24"
															stroke="currentColor"
															strokeWidth={2}
														>
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																d="M6 18L18 6M6 6l12 12"
															/>
														</svg>
													</button>
												)}
											</div>
										)}
								</div>
							)}

							{activeSheet === "price" && (
								<div className="pb-2">
									<h3 className="text-lg font-bold text-gray-900 leading-tight">
										تحديد سعر الصنف
									</h3>
									<p className="text-sm text-gray-500">
										{activeItem.name_snapshot}
									</p>
								</div>
							)}
						</div>
						<div
							className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-2"
							style={{ WebkitOverflowScrolling: "touch" }}
						>
							{activeSheet === "replacement" && (
								<>
									{(activeItem.replacement_decision_status ===
										ReplacementDecisionStatus.APPROVED ||
										activeItem.replacement_decision_status ===
											ReplacementDecisionStatus.REJECTED) && (
										<div className="rounded-md border border-brand-border bg-brand-soft p-3 text-sm text-brand-primary">
											قرار العميل مقفل على هذا الصنف. استخدم زر إعادة الضبط
											لفتحه مرة أخرى.
										</div>
									)}

									{!canEditItemReplacement && (
										<div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
											لا يمكن تعديل الاستبدال بعد خروج الطلب من حالتي جديد أو
											مؤكد.
										</div>
									)}

									{activeItem.replacement_decision_status !==
										ReplacementDecisionStatus.APPROVED &&
										activeItem.replacement_decision_status !==
											ReplacementDecisionStatus.REJECTED &&
										canEditItemReplacement && (
											<>
												<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
													<p className="text-xs text-gray-400">
														اكتب {MIN_SEARCH_CHARS} حرف على الأقل للبحث
													</p>
													{activeItemCategory && (
														<p className="text-xs font-medium text-brand-primary">
															الأولوية لقسم: {activeItemCategory}
														</p>
													)}
												</div>

												<div className="mt-4 space-y-2">
													{!isTextSearchActive &&
														replacementOptions.length > 0 && (
															<p className="text-xs font-bold uppercase tracking-wider text-brand-primary">
																منتجات مشابهة مقترحة
															</p>
														)}

													{isReplacementResultsLoading && (
														<div className="flex flex-col items-center justify-center rounded-2xl bg-gray-50/50 py-8">
															<div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
															<p className="mt-2 text-sm text-gray-500">
																{isTextSearchActive
																	? "جاري البحث..."
																	: "جاري تحميل المقترحات..."}
															</p>
														</div>
													)}

													{!isReplacementResultsLoading &&
														replacementResultsError && (
															<p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
																{replacementResultsError}
															</p>
														)}

													{!isReplacementResultsLoading &&
														!replacementResultsError &&
														replacementOptions.length === 0 && (
															<p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">
																{!isTextSearchActive && activeItemCategory
																	? `لا توجد نتائج مطابقة داخل قسم ${activeItemCategory}`
																	: "لا توجد نتائج مطابقة"}
															</p>
														)}

													{!isReplacementResultsLoading &&
														!replacementResultsError &&
														replacementOptions.map(product => (
															<button
																key={product.id}
																type="button"
																onClick={() =>
																	handleSelectReplacement(
																		activeItem.id,
																		product,
																	)
																}
																disabled={
																	isPending || !canEditItemReplacement
																}
																className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-3 py-3 text-start"
															>
																<span className="flex items-center gap-3">
																	<ProductThumbnail
																		imageUrl={product.image_url}
																		name={product.name}
																	/>
																	<span className="font-medium text-gray-900">
																		{product.name}
																	</span>
																</span>
																<span className="text-xs text-gray-500">
																	اختيار
																</span>
															</button>
														))}
												</div>

												<div className="mt-4 rounded-xl border border-gray-200 p-3">
													<p className="text-sm font-semibold text-gray-800">
														+ إضافة منتج جديد
													</p>
													<div className="mt-2 flex gap-2">
														<input
															value={newProductName}
															onChange={event =>
																setNewProductName(event.target.value)
															}
															maxLength={MAX_PRODUCT_NAME_LENGTH}
															placeholder="اسم المنتج البديل"
															className="flex-1 rounded-md border border-brand-border px-3 py-2 text-sm focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
														/>
														<button
															type="button"
															onClick={handleCreateAndSelect}
															disabled={isPending || !canEditItemReplacement}
															className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
														>
															حفظ
														</button>
													</div>
												</div>

												{activeItem.pending_replacement_product_id && (
													<button
														type="button"
														onClick={() =>
															handleClearReplacement(activeItem.id)
														}
														disabled={isPending || !canEditItemReplacement}
														className="mt-3 w-full rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 disabled:opacity-60"
													>
														إلغاء طلب الاستبدال
													</button>
												)}
											</>
										)}

									{(activeItem.replacement_decision_status ===
										ReplacementDecisionStatus.APPROVED ||
										activeItem.replacement_decision_status ===
											ReplacementDecisionStatus.REJECTED) && (
										<button
											type="button"
											onClick={() =>
												handleResetReplacementDecision(activeItem.id)
											}
											disabled={isPending || !canEditItemReplacement}
											className="mt-4 w-full rounded-md bg-brand-primary px-4 py-3 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
										>
											إعادة فتح قرار الاستبدال
										</button>
									)}
								</>
							)}

							{activeSheet === "price" && (
								<>
									<div className="mt-2 rounded-xl border border-gray-200 p-3">
										<label className="mb-2 block text-sm font-medium text-gray-700">
											السعر النهائي للصنف (ج.م)
										</label>
										<input
											type="number"
											inputMode="decimal"
											min="0"
											step="0.01"
											value={priceInput}
											onChange={event => {
												setPriceInput(event.target.value);
												setPriceError(null);
											}}
											placeholder="مثال: 45"
											className="w-full rounded-md border border-brand-border px-3 py-3 text-sm focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
										/>
										<p className="mt-2 text-xs text-gray-500">
											سيتم حفظ السعر كإجمالي هذا الصنف.
										</p>
									</div>

									<div className="mt-3">
										<p className="mb-2 text-xs font-semibold text-gray-500">
											أسعار سريعة
										</p>
										<div className="grid grid-cols-4 gap-2">
											{PRICE_CHIP_VALUES.map(value => (
												<button
													key={value}
													type="button"
													onClick={() => {
														setPriceInput(String(value));
														setPriceError(null);
													}}
													className="rounded-lg border border-gray-300 px-2 py-2 text-sm font-semibold text-gray-700"
												>
													{value}
												</button>
											))}
										</div>
									</div>

									{priceError && (
										<p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
											{priceError}
										</p>
									)}

									<button
										type="button"
										onClick={handleSaveLinePrice}
										disabled={isPending}
										className="mt-4 w-full rounded-md bg-brand-primary px-4 py-3 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
									>
										حفظ السعر
									</button>
								</>
							)}
						</div>
					</div>
				</div>
			)}
		</section>
	);
}
