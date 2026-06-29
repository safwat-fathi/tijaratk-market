"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckSquare, Square, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import SafeImage from "@/components/ui/SafeImage";
import { AdminPagination } from "../../_components/AdminPagination";
import {
  adminBulkUpdateCatalogItemsAction,
  adminDeleteCatalogItemAction,
  adminUpdateCatalogItemAction,
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
    source: string;
    search?: string;
    category?: string;
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
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkCategory, setBulkCategory] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const visibleIds = useMemo(() => items.map((item) => item.id), [items]);
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

  const runBulkAction = (payload: {
    category?: string;
    is_active?: boolean;
    is_essential?: boolean;
  }) => {
    setMessage(null);
    startTransition(async () => {
      const response = await adminBulkUpdateCatalogItemsAction({
        ids: selectedIds,
        ...payload,
      });
      if (!response.success) {
        setMessage(response.message || "تعذر تحديث العناصر المحددة");
        return;
      }

      setSelectedIds([]);
      setBulkCategory("");
      setMessage("تم تحديث العناصر المحددة");
    });
  };

  return (
    <>
      {message ? (
        <p className="rounded-md bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-primary">
          {message}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-brand-border">
          <thead className="bg-brand-soft">
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
                تعديل
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border bg-white">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  لا توجد عناصر كتالوج لهذا المصدر
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <CatalogItemRow
                  key={item.id}
                  item={item}
                  categoryNames={categoryNames}
                  isSelected={selectedSet.has(item.id)}
                  onToggle={() => toggleId(item.id)}
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

      {selectedIds.length > 0 ? (
        <div className="sticky bottom-3 z-40 rounded-lg border border-brand-border bg-white p-3 shadow-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-brand-text">
                {selectedIds.length} محدد
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-brand-border text-brand-text"
                aria-label="مسح التحديد"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-end">
              <Combobox
                name="bulk_category"
                label="تغيير التصنيف"
                options={categoryNames}
                defaultValue={bulkCategory}
                onValueChange={setBulkCategory}
                wrapperClassName="min-w-56"
                inputClassName="h-10 px-3 text-sm"
                placeholder="اختر التصنيف"
              />
              <Button
                type="button"
                disabled={isPending || !bulkCategory.trim()}
                onClick={() => runBulkAction({ category: bulkCategory })}
              >
                تطبيق التصنيف
              </Button>
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
      ) : null}
    </>
  );
}

function CatalogItemRow({
  item,
  categoryNames,
  isSelected,
  onToggle,
}: {
  item: AdminCatalogItem;
  categoryNames: string[];
  isSelected: boolean;
  onToggle: () => void;
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
      <td className="min-w-72 px-4 py-3">
        <div className="flex items-center gap-3">
          <SafeImage
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
      <td className="px-4 py-3 text-sm text-brand-text">
        {formatPrice(item.price)} {item.currency || ""}
      </td>
      <td className="px-4 py-3 text-sm">
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
      <td className="px-4 py-3 text-sm">
        <span
          className={`rounded-full px-2 py-1 text-xs font-semibold ${
            item.is_essential
              ? "bg-red-100 text-red-800"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {item.is_essential ? "نعم" : "لا"}
        </span>
      </td>
      <td className="min-w-[32rem] px-4 py-3">
        <form
          action={adminUpdateCatalogItemAction.bind(null, item.id)}
          encType="multipart/form-data"
          className="grid gap-3 md:grid-cols-6"
        >
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-medium text-brand-muted">الاسم</span>
            <input
              name="name"
              defaultValue={item.name}
              required
              className="h-9 w-full rounded-md border border-brand-border px-2 text-sm"
            />
          </label>
          <Combobox
            name="category"
            label="التصنيف"
            options={categoryNames}
            defaultValue={item.category}
            wrapperClassName="md:col-span-2"
            inputClassName="h-9 px-2 text-sm"
            placeholder="التصنيف"
            required
          />
          <label className="space-y-1">
            <span className="text-xs font-medium text-brand-muted">السعر</span>
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={formatPrice(item.price)}
              className="h-9 w-full rounded-md border border-brand-border px-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-brand-muted">العملة</span>
            <input
              name="currency"
              defaultValue={item.currency || "EGP"}
              maxLength={3}
              className="h-9 w-full rounded-md border border-brand-border px-2 text-sm"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-medium text-brand-muted">
              رقم خارجي
            </span>
            <input
              name="external_id"
              defaultValue={item.external_id || ""}
              className="h-9 w-full rounded-md border border-brand-border px-2 text-sm"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-medium text-brand-muted">
              رابط الصورة
            </span>
            <input
              name="image_url"
              defaultValue={item.image_url || ""}
              className="h-9 w-full rounded-md border border-brand-border px-2 text-sm"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-medium text-brand-muted">
              رفع صورة
            </span>
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="block h-9 w-full rounded-md border border-brand-border bg-white px-2 py-1 text-xs text-brand-text file:ms-2 file:rounded-md file:border-0 file:bg-brand-primary file:px-2 file:py-1 file:text-xs file:font-semibold file:text-white"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-brand-text">
            <input
              name="is_active"
              type="checkbox"
              defaultChecked={item.is_active}
              className="h-4 w-4 rounded border-brand-border"
            />
            نشط
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-brand-text">
            <input
              name="is_essential"
              type="checkbox"
              defaultChecked={item.is_essential}
              className="h-4 w-4 rounded border-brand-border"
            />
            أساسي
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-brand-muted">ترتيب</span>
            <input
              name="essential_sort_order"
              type="number"
              step="1"
              defaultValue={item.essential_sort_order ?? ""}
              className="h-9 w-full rounded-md border border-brand-border px-2 text-sm"
            />
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" size="sm">
              حفظ
            </Button>
          </div>
        </form>
        <form
          action={adminDeleteCatalogItemAction.bind(null, item.id)}
          className="mt-2"
        >
          <button
            type="submit"
            className="text-sm font-semibold text-red-700 hover:text-red-800"
          >
            تعطيل
          </button>
        </form>
      </td>
    </tr>
  );
}
