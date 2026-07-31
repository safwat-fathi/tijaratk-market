import { Card } from "@/components/ui/Card";
import { AdminPagination } from "../_components/AdminPagination";
import { adminService, type AdminProduct } from "@/services/api/admin.service";

export const metadata = { title: "المنتجات" };

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    tenantName?: string;
    productName?: string;
    tenantCategory?: "grocery" | "pharmacy";
    page?: string;
    limit?: string;
  }>;
};

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const page = parsePositiveInteger(query.page, 1);
  const limit = parsePositiveInteger(query.limit, 20);
  const response = await adminService.getProducts(
    query.tenantName,
    query.productName,
    query.tenantCategory,
    page,
    limit,
  );
  const payload = response.data;
  const products: AdminProduct[] = Array.isArray(payload) ? payload : payload?.data || [];
  const meta = Array.isArray(payload) || !payload?.meta
    ? { page, limit, total: products.length, totalPages: 1 }
    : payload.meta;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">منتجات المتاجر</h1>
        <p className="text-sm text-gray-500">
          هذا عرض رقابي فقط. ابدأ جلسة موثقة من صفحة التاجر لتنفيذ أي تعديل.
        </p>
      </div>

      <Card className="p-5">
        <form method="get" className="grid gap-3 md:grid-cols-4">
          <input name="tenantName" defaultValue={query.tenantName} placeholder="اسم المتجر" className="rounded-md border border-gray-300 px-3 py-2" />
          <input name="productName" defaultValue={query.productName} placeholder="اسم المنتج" className="rounded-md border border-gray-300 px-3 py-2" />
          <select name="tenantCategory" defaultValue={query.tenantCategory || ""} className="rounded-md border border-gray-300 bg-white px-3 py-2">
            <option value="">كل الأنواع</option>
            <option value="grocery">سوبر ماركت</option>
            <option value="pharmacy">صيدلية</option>
          </select>
          <button type="submit" className="rounded-md bg-brand-primary px-4 py-2 font-semibold text-white">بحث</button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-right text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3">المنتج</th>
                <th className="px-4 py-3">المتجر</th>
                <th className="px-4 py-3">السعر</th>
                <th className="px-4 py-3">الإتاحة</th>
                <th className="px-4 py-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-3 font-semibold text-gray-900">{product.name}</td>
                  <td className="px-4 py-3">
                    {product.tenant?.id ? (
                      <a href={`/admin/merchants/${product.tenant.id}`} className="text-brand-primary hover:underline">
                        {product.tenant.name || `متجر #${product.tenant.id}`}
                      </a>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3">{String(product.current_price ?? "-")}</td>
                  <td className="px-4 py-3">{product.is_available ? "متاح" : "غير متاح"}</td>
                  <td className="px-4 py-3">{product.status || "-"}</td>
                </tr>
              ))}
              {products.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">لا توجد نتائج.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="p-4">
          <AdminPagination
            basePath="/admin/products"
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={meta.limit}
            params={{
              tenantName: query.tenantName,
              productName: query.productName,
              tenantCategory: query.tenantCategory,
            }}
          />
        </div>
      </Card>
    </div>
  );
}
