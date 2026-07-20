"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Square, X, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import ImageThumbnail from "@/components/ui/ImageThumbnail";
import BottomSheet from "@/components/ui/BottomSheet";
import Toast from "@/components/ui/Toast";
import { AdminPagination } from "../../_components/AdminPagination";
import {
  adminBulkUpdateCatalogItemsAction,
  adminDeleteCatalogItemAction,
  adminUpdateCatalogItemAction,
  adminUpdateCatalogItemPayloadAction,
} from "@/actions/admin-server";
import type { AdminCatalogItem } from "@/services/api/admin.service";
import { resolveImageUrl } from "@/app/(dashboard)/merchant/(features)/products/new/_utils/product-onboarding";

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type Props = {
  items: AdminCatalogItem[];
  categoryNames: string[];
  meta: PaginationMeta;
  params: {
    catalogType: string;
    search?: string;
    category?: string;
    status?: "all" | "active" | "inactive";
    essentialStatus?: "all" | "essential" | "non_essential";
  };
};

const formatPrice = (price?: number | string | null) =>
  price === null || price === undefined || price === "" ? "" : String(price);

export default function AdminCatalogItemsBulkClient({
  items,
  categoryNames,
  meta,
  params,
}: Props) {
  const router = useRouter();
  const [currentItems, setCurrentItems] = useState(items);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkCategory, setBulkCategory] = useState("");
  const [toastData, setToastData] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingItem, setEditingItem] = useState<AdminCatalogItem | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editIsActive, setEditIsActive] = useState(false);
  const [editIsEssential, setEditIsEssential] = useState(false);
  const [isBulkSheetOpen, setIsBulkSheetOpen] = useState(false);

  useEffect(() => {
    setCurrentItems(items);
    setSelectedIds([]);
  }, [items]);

  const visibleIds = useMemo(
    () => currentItems.map((item) => item.id),
    [currentItems],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));

  const toggleId = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  };

  const toggleVisible = () => {
    setSelectedIds(allVisibleSelected ? [] : visibleIds);
  };

  const openEditItem = (item: AdminCatalogItem) => {
    setEditingItem(item);
    setEditCategory(item.category);
    setEditIsActive(item.is_active);
    setEditIsEssential(item.is_essential);
  };

  const runBulkAction = (payload: {
    category?: string;
    is_active?: boolean;
    is_essential?: boolean;
  }) => {
    setToastData(null);
    if (payload.category && !categoryNames.includes(payload.category)) {
      setToastData({
        message: "اختر تصنيفًا متاحًا من القائمة.",
        type: "error",
      });
      return;
    }
    startTransition(async () => {
      try {
        const response = await adminBulkUpdateCatalogItemsAction({
          ids: selectedIds,
          ...payload,
        });
        if (!response.success) {
          setToastData({ message: response.message || "تعذر تحديث العناصر المحددة", type: "error" });
          return;
        }

        setSelectedIds([]);
        setBulkCategory("");
        setIsBulkSheetOpen(false);
        setToastData({ message: "تم تحديث العناصر المحددة", type: "success" });
        router.refresh();
      } catch (e: any) {
        setToastData({ message: e.message || "حدث خطأ أثناء التحديث", type: "error" });
      }
    });
  };

  return (
    <>
      {toastData ? (
        <Toast
          message={toastData.message}
          type={toastData.type}
          onClose={() => setToastData(null)}
          position="top"
        />
      ) : null}

      {selectedIds.length > 0 ? (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-brand-primary/20 bg-brand-soft/50 p-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand-text transition-colors hover:bg-gray-200"
              aria-label="مسح التحديد"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold text-brand-text">
              {selectedIds.length} محدد
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setIsBulkSheetOpen(true)}
          >
            إجراءات متعددة
          </Button>
        </div>
      ) : null}

      <div className="max-h-[60vh] overflow-auto rounded-md border border-brand-border">
        <table className="min-w-full divide-y divide-brand-border">
          <thead className="sticky top-0 z-10 bg-brand-soft shadow-sm">
            <tr>
              <th className="w-12 px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={toggleVisible}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-brand-border bg-white text-brand-text"
                  aria-label="تحديد العناصر الظاهرة"
                >
                  {allVisibleSelected ? (
                    <CheckSquare className="h-5 w-5" />
                  ) : (
                    <Square className="h-5 w-5" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
                المنتج
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
                التصنيف
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
                السعر
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
                الحالة
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
                أساسي
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
                إجراءات
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border bg-white">
            {currentItems.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  لا توجد عناصر كتالوج لهذا المصدر
                </td>
              </tr>
            ) : (
              currentItems.map((item) => (
                <CatalogItemRow
                  key={item.id}
                  item={item}
                  isSelected={selectedSet.has(item.id)}
                  onToggle={() => toggleId(item.id)}
                  onEdit={() => openEditItem(item)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination
        basePath="/admin/catalog-items"
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        limit={meta.limit}
        params={params}
      />

      <BottomSheet
        isOpen={isBulkSheetOpen}
        onClose={() => setIsBulkSheetOpen(false)}
        title="إجراءات متعددة"
      >
        <div className="flex flex-col gap-4 pb-2">
          <div className="space-y-3 rounded-lg border border-brand-border p-4">
            <h3 className="text-sm font-bold text-brand-text">تغيير التصنيف</h3>
            <Combobox
              name="bulk_category"
              label="تغيير التصنيف"
              options={categoryNames}
              value={bulkCategory}
              onValueChange={setBulkCategory}
              allowCustomValue={false}
              wrapperClassName="w-full"
              inputClassName="h-10 px-3 text-sm"
              placeholder="اختر التصنيف"
            />
            <Button
              type="button"
              className="w-full"
              disabled={isPending || !bulkCategory.trim()}
              onClick={() => runBulkAction({ category: bulkCategory })}
            >
              تطبيق التصنيف
            </Button>
          </div>

          <div className="space-y-3 rounded-lg border border-brand-border p-4">
            <h3 className="text-sm font-bold text-brand-text">تغيير الحالة</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => runBulkAction({ is_active: true })}
              >
                تنشيط
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => runBulkAction({ is_active: false })}
              >
                تعطيل
              </Button>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-brand-border p-4">
            <h3 className="text-sm font-bold text-brand-text">حالة الأساسي</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => runBulkAction({ is_essential: true })}
              >
                أساسي
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => runBulkAction({ is_essential: false })}
              >
                غير أساسي
              </Button>
            </div>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={editingItem !== null}
        onClose={() => setEditingItem(null)}
        title="تعديل العنصر"
      >
        {editingItem && (
          <div className="space-y-4 pb-2">
            <form
              action={async (formData) => {
                if (!categoryNames.includes(editCategory)) {
                  setToastData({
                    message: "اختر تصنيفًا متاحًا من القائمة قبل الحفظ.",
                    type: "error",
                  });
                  return;
                }

                const file = formData.get("file");
                let result;
                if (file instanceof File && file.size > 0) {
                  formData.set("is_active", String(editIsActive));
                  formData.set("is_essential", String(editIsEssential));
                  result = await adminUpdateCatalogItemAction(
                    editingItem.id,
                    formData,
                  );
                } else {
                  const priceValue = formData.get("price");
                  const sortValue = formData.get("essential_sort_order");
                  result = await adminUpdateCatalogItemPayloadAction(
                    editingItem.id,
                    {
                      name: String(formData.get("name") || ""),
                      category: String(formData.get("category") || ""),
                      price:
                        typeof priceValue === "string" && priceValue.trim()
                          ? Number(priceValue)
                          : null,
                      currency: String(formData.get("currency") || ""),
                      image_url: String(formData.get("image_url") || ""),
                      external_id: String(formData.get("external_id") || ""),
                      is_active: editIsActive,
                      is_essential: editIsEssential,
                      essential_sort_order:
                        typeof sortValue === "string" && sortValue.trim()
                          ? Number(sortValue)
                          : null,
                    },
                  );
                }

                if (!result.success) {
                  setToastData({ message: result.message, type: "error" });
                  return;
                }

                const updatedItem = result.data;
                if (updatedItem) {
                  setCurrentItems((prev) =>
                    prev.map((item) =>
                      item.id === updatedItem.id ? updatedItem : item,
                    ),
                  );
                }
                setEditingItem(null);
                setToastData({
                  message: "تم تعديل العنصر بنجاح",
                  type: "success",
                });
                router.refresh();
              }}
              encType="multipart/form-data"
              className="grid gap-4 md:grid-cols-2"
            >
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-brand-text">الاسم</span>
                <input
                  name="name"
                  defaultValue={editingItem.name}
                  required
                  className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
                />
              </label>
              <Combobox
                key={editingItem.id}
                name="category"
                label="التصنيف"
                options={categoryNames}
                value={editCategory}
                onValueChange={setEditCategory}
                allowCustomValue={false}
                wrapperClassName="md:col-span-2"
                inputClassName="h-10 px-3 text-sm"
                placeholder="التصنيف"
                required
              />
              {!categoryNames.includes(editingItem.category) ? (
                <p className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  التصنيف المحفوظ حاليًا هو «{editingItem.category}»، لكنه لم يعد
                  متاحًا. اختر تصنيفًا نشطًا قبل الحفظ.
                </p>
              ) : null}
              <label className="space-y-1">
                <span className="text-sm font-medium text-brand-text">السعر</span>
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={formatPrice(editingItem.price)}
                  className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-brand-text">العملة</span>
                <input
                  name="currency"
                  defaultValue={editingItem.currency || "EGP"}
                  maxLength={3}
                  className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-brand-text">
                  رقم خارجي
                </span>
                <input
                  name="external_id"
                  defaultValue={editingItem.external_id || ""}
                  className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-brand-text">
                  رابط الصورة
                </span>
                <input
                  name="image_url"
                  defaultValue={editingItem.image_url || ""}
                  className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-brand-text">
                  رفع صورة
                </span>
                <input
                  name="file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  className="block h-10 w-full rounded-md border border-brand-border bg-white px-3 py-1.5 text-sm text-brand-text file:ms-3 file:rounded-md file:border-0 file:bg-brand-primary file:px-3 file:py-1 file:text-sm file:font-semibold file:text-white"
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-brand-text">
                <input type="hidden" name="is_active" value="false" />
                <input
                  name="is_active"
                  type="checkbox"
                  value="true"
                  checked={editIsActive}
                  onChange={(event) => setEditIsActive(event.target.checked)}
                  className="h-4 w-4 rounded border-brand-border"
                />
                نشط
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-brand-text">
                <input type="hidden" name="is_essential" value="false" />
                <input
                  name="is_essential"
                  type="checkbox"
                  value="true"
                  checked={editIsEssential}
                  onChange={(event) => setEditIsEssential(event.target.checked)}
                  className="h-4 w-4 rounded border-brand-border"
                />
                أساسي
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-brand-text">ترتيب</span>
                <input
                  name="essential_sort_order"
                  type="number"
                  step="1"
                  defaultValue={editingItem.essential_sort_order ?? ""}
                  className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
                />
              </label>
              <div className="md:col-span-2 pt-2">
                <Button type="submit" className="w-full">
                  حفظ التعديلات
                </Button>
              </div>
            </form>

            <form
              action={async () => {
                const result = await adminDeleteCatalogItemAction(
                  editingItem.id,
                );
                if (!result.success) {
                  setToastData({ message: result.message, type: "error" });
                  return;
                }

                setEditingItem(null);
                setToastData({
                  message: "تم إلغاء تفعيل العنصر بنجاح",
                  type: "success",
                });
                router.refresh();
              }}
              className="mt-2 pt-4 border-t border-brand-border"
            >
              <p className="mb-3 text-xs leading-5 text-brand-muted">
                إلغاء التفعيل يخفي العنصر من الكتالوج النشط ولا يحذف السجل نهائيًا.
              </p>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-md bg-red-50 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
                إلغاء التفعيل
              </button>
            </form>
          </div>
        )}
      </BottomSheet>
    </>
  );
}

function CatalogItemRow({
  item,
  isSelected,
  onToggle,
  onEdit,
}: {
  item: AdminCatalogItem;
  isSelected: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <tr className={item.is_active ? "" : "bg-gray-50"}>
      <td className="px-4 py-3 align-top">
        <button
          type="button"
          onClick={onToggle}
          className={`inline-flex h-10 w-10 items-center justify-center rounded-md border ${
            isSelected
              ? "border-brand-primary bg-brand-primary text-white"
              : "border-brand-border bg-white text-brand-text"
          }`}
          aria-label="تحديد عنصر الكتالوج"
        >
          {isSelected ? (
            <CheckSquare className="h-5 w-5" />
          ) : (
            <Square className="h-5 w-5" />
          )}
        </button>
      </td>
      <td className="min-w-[200px] px-4 py-3">
        <div className="flex items-center gap-3">
          <ImageThumbnail
            src={resolveImageUrl(item.image_url)}
            alt={item.name}
            width={48}
            height={48}
            sizes="48px"
            loading="lazy"
            quality={70}
            imageClassName="h-12 w-12 rounded object-cover ring-1 ring-gray-200"
            draggable={false}
            fallback={
              <span className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-xs text-gray-500">
                صورة
              </span>
            }
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-brand-text">
              {item.name}
            </p>
            <p className="truncate text-xs text-brand-muted">
              {item.external_id || item.source}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-brand-text">{item.category}</td>
      <td className="px-4 py-3 text-sm text-brand-text whitespace-nowrap">
        {formatPrice(item.price)} {item.currency || ""}
      </td>
      <td className="px-4 py-3 text-sm whitespace-nowrap">
        <span
          className={`rounded-full px-2 py-1 text-xs font-semibold ${
            item.is_active
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {item.is_active ? "نشط" : "غير نشط"}
        </span>
      </td>
      <td className="px-4 py-3 text-sm whitespace-nowrap">
        <span
          className={`rounded-full px-2 py-1 text-xs font-semibold ${
            item.is_essential
              ? "bg-brand-soft text-brand-primary"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {item.is_essential ? "نعم" : "لا"}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <Button size="sm" variant="secondary" onClick={onEdit} className="gap-2">
          <Edit className="h-4 w-4" />
          تعديل
        </Button>
      </td>
    </tr>
  );
}
