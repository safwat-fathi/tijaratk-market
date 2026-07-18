"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import BottomSheet from "@/components/ui/BottomSheet";
import type { Product, CatalogItem } from "@/types/models/product";
import {
  addManagedCatalogProductAction,
  createManagedProductAction,
  updateManagedProductAvailabilityAction,
  updateManagedProductDetailsAction,
  updateManagedProductPriceAction,
  updateManagedProductStatusAction,
  bulkUpdateManagedProductsAction,
} from "@/actions/admin-server";

type ProductsClientViewProps = {
  tenantId: number;
  permissions: Set<string>;
  productsData: Product[];
  productsMeta: any;
  catalogData: CatalogItem[];
  catalogMeta: any;
  productCategories: string[];
};

export default function ProductsClientView({
  tenantId,
  permissions,
  productsData,
  productsMeta,
  catalogData,
  catalogMeta,
  productCategories,
}: ProductsClientViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [addTab, setAddTab] = useState<"catalog" | "manual">("catalog");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");

  const currentStatus = searchParams.get("status") || "active";
  const productsSearch = searchParams.get("products_search") || "";
  const productsCategory = searchParams.get("products_category") || "";

  const updateUrlParams = (updates: Record<string, string | null>) => {
    setSelectedIds(new Set()); // Reset selection on any query change
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleProductsSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateUrlParams({ products_search: formData.get("search") as string, products_page: "1" });
  };

  const handleCatalogCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateUrlParams({ catalog_category: e.target.value, catalog_page: "1" });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === productsData.length && productsData.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(productsData.map((p) => p.id)));
    }
  };

  const toggleSelectProduct = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkAction = async (payload: any) => {
    if (selectedIds.size === 0) return;
    startTransition(async () => {
      const result = await bulkUpdateManagedProductsAction(tenantId, {
        ids: Array.from(selectedIds),
        ...payload,
      });
      if (result.success) {
        setSelectedIds(new Set());
        setIsCategoryModalOpen(false);
      } else {
        alert(result.message);
      }
    });
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">منتجات المتجر</h1>
          <p className="text-sm text-gray-500">البيانات المعروضة مقيدة بالمتجر النشط في الجلسة.</p>
        </div>
        {permissions.has("products.create") && (
          <Button onClick={() => setIsAddProductOpen(true)} className="shadow-sm">
            إضافة منتج
          </Button>
        )}
      </div>

      <Card className="overflow-hidden border-gray-200/60 shadow-sm backdrop-blur-sm bg-white/80">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 p-4 bg-gray-50/50">
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg shrink-0">
            <button
              onClick={() => updateUrlParams({ status: "active", products_page: "1" })}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${currentStatus === "active" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              نشط
            </button>
            <button
              onClick={() => updateUrlParams({ status: "archived", products_page: "1" })}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${currentStatus === "archived" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              مؤرشف
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <form onSubmit={handleProductsSearch} className="flex gap-2">
              <input
                name="search"
                defaultValue={productsSearch}
                placeholder="ابحث عن منتج..."
                className="rounded-md border border-gray-300 bg-white/60 px-3 py-1.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent/50 transition-all w-full sm:w-48"
              />
              <Button type="submit" variant="outline" size="sm">بحث</Button>
            </form>
            <select
              value={productsCategory}
              onChange={(e) => updateUrlParams({ products_category: e.target.value, products_page: "1" })}
              className="rounded-md border border-gray-300 bg-white/60 px-3 py-1.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent/50 transition-all w-full sm:w-auto max-w-40"
            >
              <option value="">كل التصنيفات</option>
              {productCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedIds.size > 0 && permissions.has("products.update") && (
          <div className="bg-brand-soft border-b border-brand-accent/20 px-4 py-2 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-brand-text">
                تم تحديد {selectedIds.size} عنصر
              </span>
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-brand-text/70 hover:text-brand-text underline transition-colors"
              >
                إلغاء التحديد
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 text-xs bg-white"
                disabled={isPending}
                onClick={() => setIsCategoryModalOpen(true)}
              >
                نقل لتصنيف
              </Button>
              {permissions.has("products.update_availability") && (
                <>
                  <Button size="sm" variant="outline" className="h-8 text-xs bg-white" disabled={isPending} onClick={() => handleBulkAction({ is_available: true })}>
                    إتاحة
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs bg-white" disabled={isPending} onClick={() => handleBulkAction({ is_available: false })}>
                    إخفاء
                  </Button>
                </>
              )}
              {permissions.has("products.archive") && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 text-xs bg-white"
                  disabled={isPending}
                  onClick={() => handleBulkAction({ status: currentStatus === "active" ? "archived" : "active" })}
                >
                  {currentStatus === "active" ? "أرشفة" : "استعادة"}
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto relative">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50/50 text-right text-xs text-gray-500 font-medium">
              <tr>
                {permissions.has("products.update") && (
                  <th className="px-4 py-3 w-10">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-brand-accent focus:ring-brand-accent/50 cursor-pointer"
                      checked={selectedIds.size === productsData.length && productsData.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                <th className="px-4 py-3">المنتج</th>
                <th className="px-4 py-3">السعر</th>
                <th className="px-4 py-3">الإتاحة</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {productsData.map((product) => (
                <tr key={product.id} className={`transition-colors ${selectedIds.has(product.id) ? 'bg-brand-soft/30' : 'hover:bg-gray-50/30'}`}>
                  {permissions.has("products.update") && (
                    <td className="px-4 py-3">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-brand-accent focus:ring-brand-accent/50 cursor-pointer"
                        checked={selectedIds.has(product.id)}
                        onChange={() => toggleSelectProduct(product.id)}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{product.category || "بدون تصنيف"}</p>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-700">
                    {product.current_price != null ? `${product.current_price} ج.م` : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${product.is_available ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20" : "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10"}`}>
                      {product.is_available ? "متاح" : "غير متاح"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${product.status === 'active' ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10" : "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-500/10"}`}>
                      {product.status === 'active' ? 'نشط' : 'مؤرشف'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {permissions.has("products.update") && (
                        <Button onClick={() => setEditingProduct(product)} size="sm" variant="outline" className="h-8 text-xs bg-white">
                          تعديل
                        </Button>
                      )}
                      {permissions.has("products.update_availability") && (
                        <form action={updateManagedProductAvailabilityAction.bind(null, tenantId, product.id, !product.is_available)}>
                          <Button type="submit" size="sm" variant="outline" className="h-8 text-xs bg-white">
                            {product.is_available ? "إخفاء" : "إتاحة"}
                          </Button>
                        </form>
                      )}
                      {permissions.has("products.archive") && (
                        <form action={updateManagedProductStatusAction.bind(null, tenantId, product.id, product.status === "archived" ? "active" : "archived")}>
                          <Button type="submit" size="sm" variant="outline" className="h-8 text-xs bg-white">
                            {product.status === "archived" ? "استعادة" : "أرشفة"}
                          </Button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {productsData.length === 0 && (
                <tr><td colSpan={permissions.has("products.update") ? 6 : 5} className="px-4 py-12 text-center text-gray-500 bg-gray-50/30">لا توجد منتجات تطابق بحثك.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {productsMeta && productsMeta.last_page > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 sm:px-6 bg-gray-50/30">
            <div className="text-sm text-gray-500">
              صفحة <span className="font-medium text-gray-900">{productsMeta.page}</span> من <span className="font-medium text-gray-900">{productsMeta.last_page}</span>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={productsMeta.page <= 1}
                onClick={() => updateUrlParams({ products_page: String(productsMeta.page - 1) })}
              >
                السابق
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={!productsMeta.has_next}
                onClick={() => updateUrlParams({ products_page: String(productsMeta.page + 1) })}
              >
                التالي
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Bulk Category Move Sheet */}
      <BottomSheet
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="نقل لتصنيف آخر"
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-gray-600">سيتم نقل {selectedIds.size} منتجات إلى التصنيف الذي تختاره.</p>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">التصنيف الجديد</label>
            <input 
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              placeholder="اكتب اسم التصنيف"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-accent/50" 
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {productCategories.map(cat => (
                <button 
                  key={cat} 
                  onClick={() => setBulkCategory(cat)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors"
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <Button 
            className="w-full" 
            disabled={!bulkCategory.trim() || isPending}
            onClick={() => handleBulkAction({ category: bulkCategory })}
          >
            {isPending ? "جاري الحفظ..." : "نقل المنتجات"}
          </Button>
        </div>
      </BottomSheet>

      {/* Add Product Bottom Sheet */}
      <BottomSheet
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        title="إضافة منتج جديد"
      >
        <div className="mb-4 flex border-b border-gray-200">
          <button
            onClick={() => setAddTab("catalog")}
            className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${addTab === "catalog" ? "border-brand-accent text-brand-accent" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            من كتالوج المنصة
          </button>
          <button
            onClick={() => setAddTab("manual")}
            className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${addTab === "manual" ? "border-brand-accent text-brand-accent" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            إضافة يدوية
          </button>
        </div>

        {addTab === "catalog" ? (
          <div className="space-y-4">
            <div className="flex gap-3">
              <select
                onChange={handleCatalogCategoryChange}
                defaultValue={searchParams.get("catalog_category") || ""}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
              >
                <option value="">كل التصنيفات (كتالوج)</option>
                {productCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              {catalogData.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.category} · {item.price ? `${item.price} ج.م` : "بدون سعر"}</p>
                  </div>
                  <form action={addManagedCatalogProductAction.bind(null, tenantId, item.id)}>
                    <Button type="submit" size="sm" variant="outline" className="h-8">إضافة</Button>
                  </form>
                </div>
              ))}
              {catalogData.length === 0 && <p className="text-sm text-center text-gray-500 py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">لا توجد عناصر.</p>}
            </div>

            {catalogMeta && catalogMeta.last_page > 1 && (
              <div className="flex justify-between items-center pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={catalogMeta.page <= 1}
                  onClick={() => updateUrlParams({ catalog_page: String(catalogMeta.page - 1) })}
                >
                  السابق
                </Button>
                <span className="text-xs text-gray-500">{catalogMeta.page} / {catalogMeta.last_page}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={!catalogMeta.has_next}
                  onClick={() => updateUrlParams({ catalog_page: String(catalogMeta.page + 1) })}
                >
                  التالي
                </Button>
              </div>
            )}
          </div>
        ) : (
          <form action={createManagedProductAction.bind(null, tenantId)} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">اسم المنتج</label>
              <input name="name" required maxLength={120} className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-accent/50" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">التصنيف</label>
              <input name="category" maxLength={64} className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-accent/50" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">السعر (ج.م)</label>
              <input name="current_price" type="number" min="0.01" step="0.01" className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-accent/50" />
            </div>
            <Button type="submit" className="w-full">حفظ المنتج</Button>
          </form>
        )}
      </BottomSheet>

      {/* Edit Product Bottom Sheet */}
      <BottomSheet
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        title="تعديل المنتج"
      >
        {editingProduct && (
          <div className="space-y-6 pt-2">
            <form action={updateManagedProductDetailsAction.bind(null, tenantId, editingProduct.id)} className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <h3 className="font-semibold text-sm text-gray-900 mb-2">البيانات الأساسية</h3>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">اسم المنتج</label>
                <input name="name" required maxLength={120} defaultValue={editingProduct.name} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/50" />
              </div>
              <Button type="submit" size="sm" className="w-full mt-2">حفظ البيانات الأساسية</Button>
            </form>

            {permissions.has("products.update_price") && (
              <form action={updateManagedProductPriceAction.bind(null, tenantId, editingProduct.id)} className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <h3 className="font-semibold text-sm text-gray-900 mb-2">تعديل السعر</h3>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">السعر الحالي (ج.م)</label>
                  <input name="current_price" type="number" min="0.01" step="0.01" required defaultValue={editingProduct.current_price == null ? "" : String(editingProduct.current_price)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/50" />
                </div>
                <Button type="submit" size="sm" className="w-full mt-2">حفظ السعر</Button>
              </form>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
