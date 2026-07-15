'use client';

import { useDebounce } from 'use-debounce';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
import BottomSheet from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import {
  getReplacementButtonLabel,
  ItemPriceEditor,
  MAX_ITEM_PRICE,
  OrderItemActionCard,
  OrderItemBottomSheet,
  ReplacementProductResults,
  ReplacementSearchField,
} from '@/components/orders/OrderItemManagementUI';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { useDragToClose } from '@/lib/hooks/useDragToClose';
import { OrderStatus, ReplacementDecisionStatus } from '@/types/enums';
import { OrderItem } from '@/types/models/order';
import { Product } from '@/types/models/product';

const MIN_SEARCH_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_RESULTS_LIMIT = 20;
const MAX_SEARCH_LENGTH = 120;
const MAX_PRODUCT_NAME_LENGTH = 120;

type OrderItemsReplacementProps = {
  orderId: number;
  orderStatus: OrderStatus;
  initialItems: OrderItem[];
  products: Product[];
};

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
  const [outOfStockConfirmationItemId, setOutOfStockConfirmationItemId] =
    useState<number | null>(null);
  const [outOfStockError, setOutOfStockError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [debouncedSearch] = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
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
  const deliverableItemCount = useMemo(
    () => items.filter((item) => !item.is_out_of_stock).length,
    [items],
  );
  const outOfStockConfirmationItem = useMemo(
    () =>
      items.find((item) => item.id === outOfStockConfirmationItemId) || null,
    [items, outOfStockConfirmationItemId],
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

  const closeOutOfStockConfirmation = () => {
    if (isPending) {
      return;
    }

    setOutOfStockConfirmationItemId(null);
    setOutOfStockError(null);
  };

  const submitMarkOutOfStock = (item: OrderItem, cancelsOrder: boolean) => {
    setOutOfStockError(null);

    startTransition(async () => {
      const response = await markOrderItemOutOfStockAction(orderId, item.id);

      if (!response.success) {
        const errorMessage =
          response.error || 'تعذر تحديد الصنف كغير متوفر';
        if (cancelsOrder) {
          setOutOfStockError(errorMessage);
        } else {
          setFeedback(errorMessage);
        }
        return;
      }

      applyOutOfStock(item.id);
      if (cancelsOrder) {
        setOutOfStockConfirmationItemId(null);
        setOutOfStockError(null);
        setFeedback('تم تحديد الصنف كغير متوفر وإلغاء الطلب');
        router.refresh();
        return;
      }

      setFeedback(`تم تحديد ${item.name_snapshot} كغير متوفر وإيقافه من المتجر`);
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

    if (deliverableItemCount === 1) {
      setOutOfStockConfirmationItemId(item.id);
      setOutOfStockError(null);
      return;
    }

    submitMarkOutOfStock(item, false);
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
						const decisionStatus = getItemDecisionStatus(item);
						const isDecisionLocked =
							decisionStatus === ReplacementDecisionStatus.APPROVED ||
							decisionStatus === ReplacementDecisionStatus.REJECTED;
						const isOutOfStock = Boolean(item.is_out_of_stock);

						return (
							<OrderItemActionCard
								key={item.id}
								item={item}
								replacementAction={{
									label: getReplacementButtonLabel(item),
									disabled:
										isDecisionLocked || !canEditItemReplacement,
									onClick: () => openReplacementSheet(item.id),
								}}
								priceAction={{
									label: "تسعير المنتج",
									disabled: !canEditItemPrice || isOutOfStock,
									onClick: () => openPriceSheet(item.id),
								}}
								unavailableAction={{
									label: "غير متوفر",
									disabled:
										!canMarkOutOfStock || isPending || isOutOfStock,
									onClick: () => handleMarkOutOfStock(item),
								}}
								helperMessages={[
									...(!canEditItemPrice
										? ["تعديل السعر متاح في حالتي جديد ومؤكد فقط"]
										: []),
									...(!canEditItemReplacement
										? ["الاستبدال متاح في حالتي جديد ومؤكد فقط"]
										: []),
								]}
								onResetDecision={() =>
									handleResetReplacementDecision(item.id)
								}
								resetDisabled={isPending || !canEditItemReplacement}
							/>
						);
					})
				) : (
					<p className="italic text-gray-400">لا توجد عناصر</p>
				)}
			</div>

			{activeItem && activeSheet ? (
				<OrderItemBottomSheet
					item={activeItem}
					kind={activeSheet}
					isSearchFocused={isSearchFocused}
					sheetRef={sheetRef}
					onClose={closeSheet}
					headerContent={
						activeSheet === "replacement" &&
						activeItem.replacement_decision_status !==
							ReplacementDecisionStatus.APPROVED &&
						activeItem.replacement_decision_status !==
							ReplacementDecisionStatus.REJECTED &&
						canEditItemReplacement ? (
							<ReplacementSearchField
								value={searchQuery}
								inputRef={searchInputRef}
								maxLength={MAX_SEARCH_LENGTH}
								onChange={setSearchQuery}
								onClear={handleClearReplacementSearch}
								onFocusChange={setIsSearchFocused}
							/>
						) : null
					}
				>
					{activeSheet === "replacement" ? (
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
												<ReplacementProductResults
													options={replacementOptions}
													loading={isReplacementResultsLoading}
													error={replacementResultsError}
													isTextSearchActive={isTextSearchActive}
													category={activeItemCategory}
													disabled={isPending || !canEditItemReplacement}
													busyMessage={isPending ? "جاري حفظ البديل..." : undefined}
													onSelect={option => {
														const product = replacementOptions.find(
															candidate => candidate.id === option.id,
														);
														if (product) {
															handleSelectReplacement(activeItem.id, product);
														}
													}}
												/>

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
					) : (
						<ItemPriceEditor
							value={priceInput}
							error={priceError}
							disabled={isPending}
							onChange={value => {
								setPriceInput(value);
								setPriceError(null);
							}}
							onSave={handleSaveLinePrice}
						/>
					)}
				</OrderItemBottomSheet>
			) : null}

			<BottomSheet
				isOpen={Boolean(outOfStockConfirmationItem)}
				title="إلغاء الطلب؟"
				closeLabel="رجوع"
				onClose={closeOutOfStockConfirmation}
				footer={
					<div className="grid gap-2 pb-3 sm:grid-cols-2">
						<Button
							type="button"
							variant="destructive"
							className="min-h-12 w-full sm:order-2"
							disabled={isPending || !outOfStockConfirmationItem}
							onClick={() => {
								if (outOfStockConfirmationItem) {
									submitMarkOutOfStock(outOfStockConfirmationItem, true);
								}
							}}
						>
							{isPending
								? "جاري الإلغاء..."
								: "تحديد غير متوفر وإلغاء الطلب"}
						</Button>
						<Button
							type="button"
							variant="outline"
							className="min-h-12 w-full sm:order-1"
							disabled={isPending}
							onClick={closeOutOfStockConfirmation}
						>
							رجوع
						</Button>
					</div>
				}
			>
				<div className="space-y-4 text-right">
					<div className="rounded-xl border border-status-error/20 bg-status-error/10 p-3">
						<p className="text-sm font-semibold text-status-error">
							هذا هو الصنف الأخير المتاح في الطلب. إذا تابعت، سيتم إلغاء
							الطلب بالكامل.
						</p>
						{outOfStockConfirmationItem && (
							<p className="mt-2 text-sm text-status-error/80">
								الصنف: {outOfStockConfirmationItem.name_snapshot}
							</p>
						)}
					</div>

					{outOfStockError && (
						<p className="rounded-lg border border-status-error/20 bg-status-error/10 px-3 py-2 text-sm font-semibold text-status-error">
							{outOfStockError}
						</p>
					)}
				</div>
			</BottomSheet>
			</section>
	);
}
