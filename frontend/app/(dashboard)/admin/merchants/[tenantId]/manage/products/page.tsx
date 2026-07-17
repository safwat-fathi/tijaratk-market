import { redirect } from "next/navigation";
import {
  addManagedCatalogProductAction,
  createManagedProductAction,
  updateManagedProductAvailabilityAction,
  updateManagedProductDetailsAction,
  updateManagedProductPriceAction,
  updateManagedProductStatusAction,
} from "@/actions/admin-server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminService } from "@/services/api/admin.service";
import { ManagedProductCategoryMoveSheet } from "./ManagedProductCategoryMoveSheet";

export const dynamic = "force-dynamic";

export default async function ManagedProductsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId: tenantIdValue } = await params;
  const tenantId = Number(tenantIdValue);
  const [
    sessionResponse,
    activeResponse,
    archivedResponse,
    catalogResponse,
    categoriesResponse,
  ] = await Promise.all([
    adminService.getCurrentManagementSession(),
    adminService.getManagedProducts(tenantId, "active"),
    adminService.getManagedProducts(tenantId, "archived"),
    adminService.getManagedCatalog(tenantId, 24),
    adminService.getManagedProductCategories(tenantId),
  ]);
  if (!sessionResponse.data || !activeResponse.success || !archivedResponse.success) {
    redirect(`/api/auth/admin/managed-session/revoke?redirect=${encodeURIComponent(`/admin/merchants/${tenantId}`)}`);
  }

  const permissions = new Set(sessionResponse.data.permissions);
  const products = [...(activeResponse.data || []), ...(archivedResponse.data || [])];
  const catalogItems = catalogResponse.success ? catalogResponse.data?.data || [] : [];
  const productCategories = categoriesResponse.success
    ? categoriesResponse.data || []
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">منتجات المتجر</h1>
        <p className="text-sm text-gray-500">البيانات المعروضة مقيدة بالمتجر النشط في الجلسة.</p>
      </div>

      {permissions.has("products.create") ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-bold text-gray-900">إضافة منتج يدوي</h2>
            <form action={createManagedProductAction.bind(null, tenantId)} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input name="name" required maxLength={120} placeholder="اسم المنتج" className="rounded-md border border-gray-300 px-3 py-2" />
              <input name="category" maxLength={64} placeholder="التصنيف" className="rounded-md border border-gray-300 px-3 py-2" />
              <input name="current_price" type="number" min="0.01" step="0.01" placeholder="السعر" className="rounded-md border border-gray-300 px-3 py-2" />
              <Button type="submit">إضافة المنتج</Button>
            </form>
          </Card>

          <Card className="p-5">
            <h2 className="font-bold text-gray-900">إضافة من كتالوج المنصة</h2>
            <p className="mt-1 text-xs text-gray-500">يظهر فقط المصدر المسموح لنوع هذا المتجر.</p>
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {catalogItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 p-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.category} · {item.price || "بدون سعر"}</p>
                  </div>
                  <form action={addManagedCatalogProductAction.bind(null, tenantId, item.id)}>
                    <Button type="submit" size="sm" variant="outline">إضافة</Button>
                  </form>
                </div>
              ))}
              {catalogItems.length === 0 ? <p className="text-sm text-gray-500">لا يوجد كتالوج جاهز لهذا النوع من المتاجر.</p> : null}
            </div>
          </Card>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-right text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3">المنتج</th>
                <th className="px-4 py-3">السعر</th>
                <th className="px-4 py-3">الإتاحة</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-3">
                    {permissions.has("products.update") ? (
                      <>
                        <form action={updateManagedProductDetailsAction.bind(null, tenantId, product.id)} className="space-y-2">
                          <input name="name" required maxLength={120} defaultValue={product.name} className="block w-44 rounded-md border border-gray-300 px-2 py-1 font-semibold" />
                          <Button type="submit" size="sm" variant="outline">حفظ البيانات</Button>
                        </form>
                        <p className="mt-2 text-xs text-gray-500">
                          {product.category || "بدون تصنيف"}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.category || "بدون تصنيف"}</p>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {permissions.has("products.update_price") ? (
                      <form action={updateManagedProductPriceAction.bind(null, tenantId, product.id)} className="flex min-w-40 gap-2">
                        <input name="current_price" type="number" min="0.01" step="0.01" required defaultValue={product.current_price == null ? "" : String(product.current_price)} className="w-24 rounded-md border border-gray-300 px-2 py-1" />
                        <Button type="submit" size="sm" variant="outline">حفظ</Button>
                      </form>
                    ) : String(product.current_price || "-")}
                  </td>
                  <td className="px-4 py-3">{product.is_available ? "متاح" : "غير متاح"}</td>
                  <td className="px-4 py-3">{product.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {permissions.has("products.update") ? (
                        <ManagedProductCategoryMoveSheet
                          tenantId={tenantId}
                          productId={product.id}
                          productName={product.name}
                          currentCategory={product.category || ""}
                          categories={productCategories}
                        />
                      ) : null}
                      {permissions.has("products.update_availability") ? (
                        <form action={updateManagedProductAvailabilityAction.bind(null, tenantId, product.id, !product.is_available)}>
                          <Button type="submit" size="sm" variant="outline">{product.is_available ? "إخفاء" : "إتاحة"}</Button>
                        </form>
                      ) : null}
                      {permissions.has("products.archive") ? (
                        <form action={updateManagedProductStatusAction.bind(null, tenantId, product.id, product.status === "archived" ? "active" : "archived")}>
                          <Button type="submit" size="sm" variant="outline">{product.status === "archived" ? "استعادة" : "أرشفة"}</Button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">لا توجد منتجات.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
