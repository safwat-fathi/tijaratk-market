"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Package,
  PackagePlus,
  RotateCcw,
} from "lucide-react";
import BottomSheet from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import SafeImage from "@/components/ui/SafeImage";
import {
  bulkAddEssentialItemsAction,
  loadBulkEssentialStagesAction,
} from "@/actions/product-actions";
import { formatCurrency } from "@/lib/utils/currency";
import type { BulkEssentialStage } from "@/types/models/product";

type BulkEssentialWizardProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSkip?: () => void;
  onCategoryAdded?: (count: number) => void;
};

type StageStatus = "pending" | "added" | "skipped" | "error";

const buildInitialSelections = (stages: BulkEssentialStage[]) =>
  stages.reduce<Record<string, Record<number, boolean>>>((acc, stage) => {
    acc[stage.category] = stage.default_selected_catalog_item_ids.reduce<
      Record<number, boolean>
    >((selectedIds, itemId) => {
      selectedIds[itemId] = true;
      return selectedIds;
    }, {});
    return acc;
  }, {});

export default function BulkEssentialWizard({
  isOpen,
  onClose,
  onSuccess,
  onSkip,
  onCategoryAdded,
}: BulkEssentialWizardProps) {
  const [stages, setStages] = useState<BulkEssentialStage[]>([]);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [selectedByCategory, setSelectedByCategory] = useState<
    Record<string, Record<number, boolean>>
  >({});
  const [stageStatuses, setStageStatuses] = useState<
    Record<string, StageStatus>
  >({});
  const [stageResults, setStageResults] = useState<Record<string, string>>({});
  const [isLoadingStages, setIsLoadingStages] = useState(false);
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasLoadedStagesRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadStages = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    hasLoadedStagesRef.current = true;
    setIsLoadingStages(true);
    setErrorMessage(null);
    setStages([]);
    setActiveStageIndex(0);
    setSelectedByCategory({});
    setStageStatuses({});
    setStageResults({});

    try {
      const result = await loadBulkEssentialStagesAction();
      if (requestIdRef.current !== requestId) return;

      if (!result.success || !result.data) {
        setErrorMessage(result.message || "تعذر تحميل المنتجات الأساسية");
        hasLoadedStagesRef.current = false;
        return;
      }

      setStages(result.data);
      setSelectedByCategory(buildInitialSelections(result.data));
    } catch {
      if (requestIdRef.current === requestId) {
        setErrorMessage("تعذر تحميل المنتجات الأساسية");
        hasLoadedStagesRef.current = false;
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoadingStages(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void loadStages();
  }, [isOpen, loadStages]);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    requestIdRef.current += 1;
    setIsLoadingStages(false);
  }, [isOpen]);

  const activeStage = stages[activeStageIndex];
  const activeSelection = useMemo(
    () => (activeStage ? selectedByCategory[activeStage.category] ?? {} : {}),
    [activeStage, selectedByCategory],
  );
  const selectedIds = useMemo(
    () =>
      Object.entries(activeSelection)
        .filter(([, isSelected]) => isSelected)
        .map(([id]) => Number(id)),
    [activeSelection],
  );
  const completedCount = stages.filter(
    (stage) => stageStatuses[stage.category] === "added",
  ).length;
  const canGoNext = activeStageIndex < stages.length - 1;
  const canGoPrevious = activeStageIndex > 0;

  const updateStageSelection = (
    category: string,
    buildNextSelection: (
      currentSelection: Record<number, boolean>,
    ) => Record<number, boolean>,
  ) => {
    setSelectedByCategory((current) => ({
      ...current,
      [category]: buildNextSelection(current[category] ?? {}),
    }));
  };

  const toggleItem = (itemId: number) => {
    if (!activeStage) return;

    updateStageSelection(activeStage.category, (current) => ({
      ...current,
      [itemId]: !current[itemId],
    }));
  };

  const selectAll = () => {
    if (!activeStage) return;

    updateStageSelection(activeStage.category, () =>
      activeStage.items.reduce<Record<number, boolean>>((acc, item) => {
        acc[item.id] = true;
        return acc;
      }, {}),
    );
  };

  const deselectAll = () => {
    if (!activeStage) return;
    updateStageSelection(activeStage.category, () => ({}));
  };

  const resetTopSelection = () => {
    if (!activeStage) return;

    updateStageSelection(activeStage.category, () =>
      activeStage.default_selected_catalog_item_ids.reduce<
        Record<number, boolean>
      >((acc, itemId) => {
        acc[itemId] = true;
        return acc;
      }, {}),
    );
  };

  const goToNextStage = () => {
    if (canGoNext) {
      setActiveStageIndex((current) => current + 1);
    }
  };

  const addSelectedProducts = async () => {
    if (!activeStage || selectedIds.length === 0) {
      return;
    }

    setIsAddingStage(true);
    setErrorMessage(null);

    const result = await bulkAddEssentialItemsAction({
      category: activeStage.category,
      catalogItemIds: selectedIds,
    });

    setIsAddingStage(false);

    if (!result.success || !result.data) {
      setStageStatuses((current) => ({
        ...current,
        [activeStage.category]: "error",
      }));
      setErrorMessage(result.message || "تعذر إضافة منتجات هذا القسم");
      return;
    }

    const addedCount = result.data.count;
    setStageStatuses((current) => ({
      ...current,
      [activeStage.category]: addedCount > 0 ? "added" : "skipped",
    }));
    setStageResults((current) => ({
      ...current,
      [activeStage.category]:
        addedCount > 0
          ? `تمت إضافة ${addedCount} منتج`
          : "كل المنتجات المختارة موجودة بالفعل",
    }));
    onCategoryAdded?.(addedCount);
    onSuccess();

    if (canGoNext) {
      goToNextStage();
    }
  };

  const handleClose = () => {
    if (isAddingStage) return;
    onClose();
  };

  const handleSkip = () => {
    if (isAddingStage) return;
    if (onSkip) {
      onSkip();
    } else {
      onClose();
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      title="التشكيلة الأساسية"
      onClose={handleClose}
    >
      <div className="space-y-5 pt-2 pb-6">
        {isLoadingStages ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
            <p className="text-sm font-semibold text-gray-700">
              جاري تحميل مجموعات المنتجات...
            </p>
          </div>
        ) : null}

        {!isLoadingStages && stages.length === 0 ? (
          <div className="space-y-4 py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-500">
              <PackagePlus className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900">
                لا توجد تشكيلة أساسية متاحة
              </h3>
              <p className="text-sm text-gray-500">
                التشكيلة الأساسية متاحة حاليًا لمحلات السوبر ماركت فقط.
              </p>
            </div>
            {errorMessage ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {errorMessage}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={handleSkip} className="w-full" size="lg">
                تخطي هذه الخطوة
              </Button>
              {errorMessage ? (
                <Button
                  onClick={loadStages}
                  className="w-full"
                  size="lg"
                  variant="secondary"
                >
                  إعادة المحاولة
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {!isLoadingStages && activeStage ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-brand-primary">
                  قسم {activeStageIndex + 1} من {stages.length}
                </p>
                <h3 className="text-lg font-bold text-gray-900">
                  {activeStage.category}
                </h3>
                <p className="text-sm text-gray-500">
                  {activeStage.total} منتج متاح، {selectedIds.length} مختار
                </p>
              </div>
              <div className="rounded-lg bg-gray-100 px-3 py-2 text-center">
                <p className="text-xs text-gray-500">تمت الإضافة</p>
                <p className="text-sm font-bold text-gray-900">
                  {completedCount}/{stages.length}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="rounded-lg border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-700"
              >
                اختيار الكل
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="rounded-lg border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-700"
              >
                إلغاء الكل
              </button>
              <button
                type="button"
                onClick={resetTopSelection}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                الافتراضي
              </button>
            </div>

            {stageResults[activeStage.category] ? (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                {stageResults[activeStage.category]}
              </div>
            ) : null}

            {errorMessage ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
              {activeStage.items.map((item) => {
                const isSelected = Boolean(activeSelection[item.id]);
                return (
                  <label
                    key={item.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                      isSelected
                        ? "border-brand-primary bg-brand-soft/20"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleItem(item.id)}
                      className="h-5 w-5 shrink-0 accent-brand-primary"
                    />
                    <SafeImage
                      src={item.image_url}
                      alt={item.name}
                      width={48}
                      height={48}
                      containerClassName="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-400"
                      imageClassName="h-12 w-12 shrink-0 rounded-lg object-cover"
                      fallback={<Package className="h-5 w-5" />}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(item.price)}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="space-y-2 pt-1">
              <Button
                onClick={addSelectedProducts}
                className="w-full"
                size="lg"
                disabled={isAddingStage || selectedIds.length === 0}
              >
                {isAddingStage
                  ? "جاري إضافة القسم..."
                  : `إضافة ${selectedIds.length} منتج من هذا القسم`}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveStageIndex((current) => current - 1)}
                  disabled={!canGoPrevious || isAddingStage}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40"
                >
                  السابق
                </button>
                <button
                  type="button"
                  onClick={goToNextStage}
                  disabled={!canGoNext || isAddingStage}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40"
                >
                  التالي
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}
