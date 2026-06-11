import { adminService } from "@/services/api/admin.service";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import { redirect } from "next/navigation";
import { AdminPagination } from "../_components/AdminPagination";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

type AdminProduct = {
  id: number;
  name: string;
  category?: string | null;
  current_price?: number | string | null;
  status?: string | null;
  tenant?: {
    name?: string | null;
  } | null;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ApiListPayload<T> = T[] | { data?: T[]; meta?: PaginationMeta };

const DEFAULT_PAGE_SIZE = 20;

function parsePositiveInteger(
  value: string | string[] | undefined,
  fallback: number,
) {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default async function AdminProductsPage(props: Props) {
  const searchParams = await props.searchParams;
  const tenantName =
    typeof searchParams.tenantName === "string"
      ? searchParams.tenantName
      : undefined;
  const productName =
    typeof searchParams.productName === "string"
      ? searchParams.productName
      : undefined;
  const page = parsePositiveInteger(searchParams.page, 1);
  const limit = parsePositiveInteger(searchParams.limit, DEFAULT_PAGE_SIZE);

  let products: AdminProduct[] = [];
  let meta: PaginationMeta = {
    page,
    limit,
    total: 0,
    totalPages: 1,
  };

  try {
    const response = await adminService.getProducts(
      tenantName,
      productName,
      page,
      limit,
    );
    if (response.success && response.data) {
      const payload = response.data as ApiListPayload<AdminProduct>;
      products = Array.isArray(payload) ? payload : payload.data || [];
      if (!Array.isArray(payload) && payload.meta) {
        meta = payload.meta;
      }
    } else if (!response.success && response.message === "Unauthorized") {
      redirect("/admin/login");
    }
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Failed to fetch products:", error);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-text">إدارة المنتجات</h1>

      <Card className="p-4 sm:p-6 overflow-hidden">
        <div className="space-y-4">
          <form
            method="GET"
            action="/admin/products"
            className="flex flex-col sm:flex-row gap-4 items-end"
          >
            <div className="w-full sm:w-1/3 space-y-1">
              <label className="text-sm font-medium text-brand-text">
                اسم المنتج
              </label>
              <input
                type="text"
                name="productName"
                defaultValue={productName}
                className="w-full h-10 px-3 rounded-md border border-brand-border focus:brand-focus text-sm"
                placeholder="ابحث باسم المنتج"
              />
            </div>
            <div className="w-full sm:w-1/3 space-y-1">
              <label className="text-sm font-medium text-brand-text">
                التاجر
              </label>
              <input
                type="text"
                name="tenantName"
                defaultValue={tenantName}
                className="w-full h-10 px-3 rounded-md border border-brand-border focus:brand-focus text-sm"
                placeholder="ابحث باسم التاجر"
              />
            </div>
            <div className="w-full sm:w-auto">
              <Button
                type="submit"
                variant="primary"
                className="w-full bg-brand-primary hover:bg-brand-primary-hover"
              >
                بحث
              </Button>
            </div>
          </form>

          <div className="overflow-x-auto mt-6">
            <table className="min-w-full divide-y divide-brand-border">
              <thead className="bg-brand-soft">
                <tr>
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-brand-border">
                {products.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-sm text-gray-500"
                    >
                      لا توجد منتجات
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id}>
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
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            product.status === "active"
                              ? "bg-status-success/20 text-status-success"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {product.status === "active" ? "نشط" : "مؤرشف"}
                        </span>
                      </td>
                    </tr>
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
            params={{ tenantName, productName }}
          />
        </div>
      </Card>
    </div>
  );
}
