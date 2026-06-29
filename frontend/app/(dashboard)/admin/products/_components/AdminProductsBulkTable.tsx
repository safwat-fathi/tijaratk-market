"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckSquare, Square, X } from "lucide-react";
import { adminBulkUpdateProductsAction, adminUpdateProductAction } from "@/actions/admin-server";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { AdminPagination } from "../../_components/AdminPagination";

type AdminProduct = {
  id: number;
  name: string;
  category?: string | null;
  current_price?: number | string | null;
  status?: string | null;
  is_available?: boolean;
  price_needs_review?: boolean;
  tenant_id?: number;
  tenant?: {
    id?: number;
    name?: string | null;
  } | null;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type Props = {
  products: AdminProduct[];
  categories: string[];
  meta: PaginationMeta;
  params: {
    tenantName?: string;
    productName?: string;
    tenantCategory?: string;
    view: "all-products";
  };
};

export default function AdminProductsBulkTable({
  products,
  categories,
  meta,
  params,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkCategory, setBulkCategory] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const visibleIds = useMemo(() => products.map((product) => product.id), [products]);
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

  const runBulkAction = (payload: {
    category?: string;
    is_available?: boolean;
    status?: "active" | "archived";
  }) => {
    setMessage(null);
    startTransition(async () => {
      const response = await adminBulkUpdateProductsAction({
        ids: selectedIds,
        ...payload,
      });
      if (!response.success) {
        setMessage(response.message || "تعذر تحديث المنتجات المحددة");
        return;
      }

      setSelectedIds([]);
      setBulkCategory("");
      setMessage("تم تحديث المنتجات المحددة");
    });
  };

  return (
    <>
      {message ? (
        <p className="rounded-md bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-primary">
          {message}
        </p>
      ) : null}

      <div className="overflow-x-auto mt-6">
        <table className="min-w-full divide-y divide-brand-border">
          <thead className="bg-brand-soft">
            <tr>
              <th className="w-12 px-6 py-3 text-right">
                <button
                  type="button"
                  onClick={() => setSelectedIds(allVisibleSelected ? [] : visibleIds)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-brand-border bg-white text-brand-text"
                  aria-label="تحديد المنتجات الظاهرة"
                >
                  {allVisibleSelected ? (
                    <CheckSquare className="h-5 w-5" />
                  ) : (
                    <Square className="h-5 w-5" />
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-brand-text uppercase">
                المنتج
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-brand-text uppercase">
                التاجر
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-brand-text uppercase">
                التصنيف
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-brand-text uppercase">
                السعر
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-brand-text uppercase">
                الحالة
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-brand-text uppercase">
                تعديل
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-brand-border">
            {products.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-8 text-center text-sm text-gray-500"
                >
                  لا توجد منتجات
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  categories={categories}
                  isSelected={selectedSet.has(product.id)}
                  onToggle={() => toggleId(product.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination
        basePath="/admin/products"
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
                options={categories}
                defaultValue={bulkCategory}
                onValueChange={setBulkCategory}
                wrapperClassName="min-w-56"
                inputClassName="h-10 px-3 text-sm"
                placeholder="اكتب أو اختر التصنيف"
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
                onClick={() => runBulkAction({ is_available: true })}
              >
                إتاحة
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => runBulkAction({ is_available: false })}
              >
                إيقاف
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => runBulkAction({ status: "active" })}
              >
                تنشيط
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => runBulkAction({ status: "archived" })}
              >
                أرشفة
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ProductRow({
  product,
  categories,
  isSelected,
  onToggle,
}: {
  product: AdminProduct;
  categories: string[];
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <tr>
      <td className="px-6 py-4 align-top">
        <button
          type="button"
          onClick={onToggle}
          className={`inline-flex h-10 w-10 items-center justify-center rounded-md border ${
            isSelected
              ? "border-brand-primary bg-brand-primary text-white"
              : "border-brand-border bg-white text-brand-text"
          }`}
          aria-label="تحديد المنتج"
        >
          {isSelected ? (
            <CheckSquare className="h-5 w-5" />
          ) : (
            <Square className="h-5 w-5" />
          )}
        </button>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-text">
        {product.name}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">
        {product.tenant?.name || "-"}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">
        {product.category}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">
        {product.current_price} EGP
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <div className="flex flex-wrap gap-2">
          <span
            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
              product.status === "active"
                ? "bg-status-success/20 text-status-success"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            {product.status === "active" ? "نشط" : "مؤرشف"}
          </span>
          {product.is_available === false ? (
            <span className="inline-flex rounded-full bg-status-error/15 px-2 py-1 text-xs font-semibold text-status-error">
              غير متاح
            </span>
          ) : null}
          {product.price_needs_review ? (
            <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
              راجع السعر
            </span>
          ) : null}
        </div>
      </td>
      <td className="min-w-[520px] px-6 py-4 text-sm">
        <form
          action={adminUpdateProductAction.bind(null, product.id)}
          className="grid grid-cols-6 items-end gap-2"
        >
          <label className="col-span-2 space-y-1">
            <span className="text-xs font-medium text-brand-text">الاسم</span>
            <input
              name="name"
              required
              defaultValue={product.name}
              className="h-9 w-full rounded-md border border-brand-border px-2 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-brand-text">السعر</span>
            <input
              name="current_price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={
                product.current_price !== null &&
                product.current_price !== undefined
                  ? String(product.current_price)
                  : ""
              }
              className="h-9 w-full rounded-md border border-brand-border px-2 text-xs"
            />
          </label>
          <Combobox
            name="category"
            label="التصنيف"
            options={categories}
            defaultValue={product.category || ""}
            wrapperClassName="space-y-1"
            labelClassName="text-xs"
            inputClassName="h-9 px-2 text-xs"
            placeholder="اكتب للبحث..."
          />
          <label className="space-y-1">
            <span className="text-xs font-medium text-brand-text">الحالة</span>
            <select
              name="status"
              defaultValue={product.status === "archived" ? "archived" : "active"}
              className="h-9 w-full rounded-md border border-brand-border px-2 text-xs"
            >
              <option value="active">نشط</option>
              <option value="archived">مؤرشف</option>
            </select>
          </label>
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-1 text-xs font-medium text-brand-text">
              <input
                name="is_available"
                type="checkbox"
                defaultChecked={product.is_available !== false}
                className="h-4 w-4 accent-brand-primary"
              />
              متاح
            </label>
            <Button type="submit" size="sm">
              حفظ
            </Button>
          </div>
        </form>
      </td>
    </tr>
  );
}
