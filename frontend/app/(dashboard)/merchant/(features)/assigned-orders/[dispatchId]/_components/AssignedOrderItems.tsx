"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  resetAssignedReplacementAction,
  updateAssignedQuoteAction,
  updateAssignedReplacementAction,
} from "@/actions/assigned-orders";
import {
  getReplacementButtonLabel,
  ItemPriceEditor,
  MAX_ITEM_PRICE,
  OrderItemActionCard,
  OrderItemBottomSheet,
  ReplacementProductResults,
  ReplacementSearchField,
  type ReplacementOption,
} from "@/components/orders/OrderItemManagementUI";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { useDragToClose } from "@/lib/hooks/useDragToClose";
import { ReplacementDecisionStatus } from "@/types/enums";
import type { OrderItem } from "@/types/models/order";
import type {
  AssignedOrderReplacementProduct,
  DispatchAssignment,
} from "@/types/models/zone-storefront";

const MIN_SEARCH_CHARS = 2;
const MAX_SEARCH_LENGTH = 120;
const SUGGESTION_LIMIT = 20;

type AssignedOrderItemsProps = {
  dispatchId: number;
  assignment: DispatchAssignment;
  orderStatus: string;
  initialItems: OrderItem[];
  replacementProducts: AssignedOrderReplacementProduct[];
};

const normalizeCategory = (value?: string | null) => value?.trim() || undefined;

export default function AssignedOrderItems({
  dispatchId,
  assignment,
  orderStatus,
  initialItems,
  replacementProducts,
}: AssignedOrderItemsProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [quoteLines, setQuoteLines] = useState(assignment.quote_lines);
  const [assignmentVersion, setAssignmentVersion] = useState(assignment.version);
  const [activeItemId, setActiveItemId] = useState<number | null>(null);
  const [activeSheet, setActiveSheet] = useState<
    "replacement" | "price" | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);
  const [replacementError, setReplacementError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useBodyScrollLock(Boolean(activeSheet));

  useEffect(() => {
    setItems(initialItems);
    setQuoteLines(assignment.quote_lines);
    setAssignmentVersion(assignment.version);
  }, [assignment.quote_lines, assignment.version, initialItems]);

  const closeSheet = () => {
    setActiveItemId(null);
    setActiveSheet(null);
    setSearchQuery("");
    setIsSearchFocused(false);
    setPriceInput("");
    setPriceError(null);
    setReplacementError(null);
  };

  const sheetRef = useDragToClose<HTMLDivElement>({
    onClose: closeSheet,
    dragThreshold: 80,
    isOpen: Boolean(activeSheet),
  });

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeItemId) ?? null,
    [activeItemId, items],
  );
  const quoteByItem = useMemo(
    () => new Map(quoteLines.map((line) => [line.order_item_id, line])),
    [quoteLines],
  );
  const productsById = useMemo(
    () => new Map(replacementProducts.map((product) => [product.id, product])),
    [replacementProducts],
  );

  const canEditPrice = assignment.status === "pending";
  const canEditReplacement =
    assignment.status === "accepted" && orderStatus === "confirmed";

  const activeItemCategory = useMemo(() => {
    if (!activeItem) return undefined;
    for (const candidateId of [
      activeItem.product_id,
      activeItem.pending_replacement_product_id,
      activeItem.replaced_by_product_id,
    ]) {
      if (typeof candidateId !== "number") continue;
      const category = normalizeCategory(productsById.get(candidateId)?.category);
      if (category) return category;
    }
    return undefined;
  }, [activeItem, productsById]);

  const replacementOptions = useMemo(() => {
    if (!activeItem) return [];
    const excludedIds = new Set(
      [
        activeItem.product_id,
        activeItem.pending_replacement_product_id,
        activeItem.replaced_by_product_id,
      ].filter((id): id is number => typeof id === "number"),
    );
    const normalizedQuery = deferredSearchQuery.trim().toLocaleLowerCase("ar");
    const isTextSearchActive = normalizedQuery.length >= MIN_SEARCH_CHARS;

    return [...replacementProducts]
      .filter((product) => !excludedIds.has(product.id))
      .filter((product) =>
        isTextSearchActive
          ? product.name.toLocaleLowerCase("ar").includes(normalizedQuery)
          : true,
      )
      .sort((first, second) => {
        const firstCategoryMatch =
          normalizeCategory(first.category) === activeItemCategory ? 1 : 0;
        const secondCategoryMatch =
          normalizeCategory(second.category) === activeItemCategory ? 1 : 0;
        if (firstCategoryMatch !== secondCategoryMatch) {
          return secondCategoryMatch - firstCategoryMatch;
        }
        return first.name.localeCompare(second.name, "ar");
      })
      .slice(0, SUGGESTION_LIMIT);
  }, [
    activeItem,
    activeItemCategory,
    deferredSearchQuery,
    replacementProducts,
  ]);

  const isTextSearchActive =
    deferredSearchQuery.trim().length >= MIN_SEARCH_CHARS;

  const openPriceSheet = (item: OrderItem) => {
    if (!canEditPrice || item.is_out_of_stock) return;
    const currentPrice = quoteByItem.get(item.id)?.total_price ?? item.total_price;
    setActiveItemId(item.id);
    setActiveSheet("price");
    setPriceInput(
      currentPrice !== null && currentPrice !== undefined
        ? String(Number(currentPrice))
        : "",
    );
    setPriceError(null);
    setFeedback(null);
  };

  const openReplacementSheet = (item: OrderItem) => {
    if (!canEditReplacement || item.is_out_of_stock) return;
    setActiveItemId(item.id);
    setActiveSheet("replacement");
    setSearchQuery("");
    setReplacementError(null);
    setFeedback(null);
  };

  const handleSavePrice = () => {
    if (!activeItem || !canEditPrice) return;
    const parsedPrice = Number(priceInput);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setPriceError("ادخل سعرًا صحيحًا أكبر من صفر");
      return;
    }
    if (parsedPrice > MAX_ITEM_PRICE) {
      setPriceError(
        `الحد الأقصى للسعر هو ${MAX_ITEM_PRICE.toLocaleString("ar-EG")} ج.م`,
      );
      return;
    }
    const roundedPrice = Math.round((parsedPrice + Number.EPSILON) * 100) / 100;

    startTransition(async () => {
      const result = await updateAssignedQuoteAction(
        dispatchId,
        activeItem.id,
        roundedPrice,
        assignmentVersion,
      );
      if (!result.success) {
        setPriceError(result.message);
        return;
      }
      const refreshedAssignment = result.data.assignments.find(
        (candidate) => candidate.is_current,
      );
      if (refreshedAssignment) {
        setQuoteLines(refreshedAssignment.quote_lines);
        setAssignmentVersion(refreshedAssignment.version);
      }
      setFeedback(`تم تحديث سعر ${activeItem.name_snapshot}`);
      closeSheet();
      router.refresh();
    });
  };

  const applyPendingReplacement = (
    itemId: number,
    product: AssignedOrderReplacementProduct | null,
  ) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              replaced_by_product_id: null,
              replaced_by_product: null,
              pending_replacement_product_id: product?.id ?? null,
              pending_replacement_product: product
                ? {
                    id: product.id,
                    name: product.name,
                    image_url: product.image_url ?? null,
                  }
                : null,
              replacement_decision_status: product
                ? ReplacementDecisionStatus.PENDING
                : ReplacementDecisionStatus.NONE,
              replacement_decision_reason: null,
              replacement_decided_at: null,
            }
          : item,
      ),
    );
  };

  const handleSelectReplacement = (option: ReplacementOption) => {
    if (!activeItem || !canEditReplacement) return;
    const product = productsById.get(option.id);
    if (!product) return;
    setReplacementError(null);

    startTransition(async () => {
      const result = await updateAssignedReplacementAction(
        dispatchId,
        activeItem.id,
        product.id,
      );
      if (!result.success) {
        setReplacementError(result.message);
        return;
      }
      applyPendingReplacement(activeItem.id, product);
      setFeedback(`تم إرسال بديل ${product.name} لموافقة العميل`);
      closeSheet();
      router.refresh();
    });
  };

  const handleClearReplacement = () => {
    if (!activeItem || !canEditReplacement) return;
    setReplacementError(null);
    startTransition(async () => {
      const result = await updateAssignedReplacementAction(
        dispatchId,
        activeItem.id,
        null,
      );
      if (!result.success) {
        setReplacementError(result.message);
        return;
      }
      applyPendingReplacement(activeItem.id, null);
      setFeedback("تمت إزالة طلب الاستبدال");
      closeSheet();
      router.refresh();
    });
  };

  const handleResetReplacement = (itemId: number) => {
    if (!canEditReplacement) return;
    startTransition(async () => {
      const result = await resetAssignedReplacementAction(dispatchId, itemId);
      if (!result.success) {
        setFeedback(result.message);
        return;
      }
      setItems((currentItems) =>
        currentItems.map((item) =>
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
      setFeedback("تمت إعادة فتح الاستبدال للصنف");
      router.refresh();
    });
  };

  const getHelperMessages = () => {
    const messages = ["تحديد غير متوفر غير مدعوم للطلبات المسندة."];
    if (!canEditPrice) {
      messages.unshift("تم تثبيت السعر بعد قبول الطلب.");
    }
    if (!canEditReplacement) {
      messages.unshift(
        assignment.status === "pending"
          ? "الاستبدال متاح بعد قبول الطلب."
          : "الاستبدال متاح أثناء تجهيز الطلب المؤكد فقط.",
      );
    }
    return messages;
  };

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
        العناصر
      </h2>
      {feedback ? (
        <p className="mb-3 text-sm font-medium text-brand-primary">{feedback}</p>
      ) : null}
      <div className="space-y-3">
        {items.length > 0 ? (
          items.map((item) => {
            const decisionStatus =
              item.replacement_decision_status ??
              ReplacementDecisionStatus.NONE;
            const isDecisionLocked =
              decisionStatus === ReplacementDecisionStatus.APPROVED ||
              decisionStatus === ReplacementDecisionStatus.REJECTED;

            return (
              <OrderItemActionCard
                key={item.id}
                item={item}
                displayedPrice={
                  assignment.status === "pending"
                    ? quoteByItem.get(item.id)?.total_price ?? item.total_price
                    : item.total_price
                }
                replacementAction={{
                  label: getReplacementButtonLabel(item),
                  disabled:
                    !canEditReplacement ||
                    isDecisionLocked ||
                    Boolean(item.is_out_of_stock),
                  onClick: () => openReplacementSheet(item),
                }}
                priceAction={{
                  label: "تسعير المنتج",
                  disabled: !canEditPrice || Boolean(item.is_out_of_stock),
                  onClick: () => openPriceSheet(item),
                }}
                unavailableAction={{
                  label: "غير متوفر",
                  disabled: true,
                  onClick: () => undefined,
                }}
                helperMessages={getHelperMessages()}
                busy={isPending}
                onResetDecision={() => handleResetReplacement(item.id)}
                resetDisabled={!canEditReplacement}
                unavailableStateMessage="هذا الصنف غير متوفر ولن يدخل في إجمالي الطلب."
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
            activeSheet === "replacement" ? (
              <ReplacementSearchField
                value={searchQuery}
                inputRef={searchInputRef}
                maxLength={MAX_SEARCH_LENGTH}
                onChange={setSearchQuery}
                onClear={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                onFocusChange={setIsSearchFocused}
              />
            ) : null
          }
        >
          {activeSheet === "replacement" ? (
            <>
              {replacementError ? (
                <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {replacementError}
                </p>
              ) : null}
              <ReplacementProductResults
                options={replacementOptions}
                isTextSearchActive={isTextSearchActive}
                category={activeItemCategory}
                disabled={isPending || !canEditReplacement}
                busyMessage={isPending ? "جاري حفظ البديل..." : undefined}
                onSelect={handleSelectReplacement}
              />
              {activeItem.pending_replacement_product_id ? (
                <button
                  type="button"
                  onClick={handleClearReplacement}
                  disabled={isPending || !canEditReplacement}
                  className="mt-3 w-full rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 disabled:opacity-60"
                >
                  إلغاء طلب الاستبدال
                </button>
              ) : null}
            </>
          ) : (
            <ItemPriceEditor
              value={priceInput}
              error={priceError}
              disabled={isPending}
              onChange={(value) => {
                setPriceInput(value);
                setPriceError(null);
              }}
              onSave={handleSavePrice}
            />
          )}
        </OrderItemBottomSheet>
      ) : null}
    </section>
  );
}
