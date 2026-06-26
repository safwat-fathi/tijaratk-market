import { adminService } from "@/services/api/admin.service";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import { redirect } from "next/navigation";
import { AdminPagination } from "../_components/AdminPagination";
import {
  adminCreateProductAction,
  adminUpdateProductAction,
} from "@/actions/admin-server";
import type { AdminTenant } from "@/services/api/admin.service";

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

type AdminProductsData = {
  products: AdminProduct[];
  merchants: AdminTenant[];
  meta: PaginationMeta;
};

async function fetchAdminProductsData({
  tenantName,
  productName,
  page,
  limit,
}: {
  tenantName?: string;
  productName?: string;
  page: number;
  limit: number;
}): Promise<AdminProductsData> {
  let meta: PaginationMeta = {
    page,
    limit,
    total: 0,
    totalPages: 1,
  };

  const [productsResponse, merchantsResponse] = await Promise.all([
    adminService.getProducts(
      tenantName,
      productName,
      page,
      limit,
    ),
    adminService.getTenants(),
  ]);

  if (!productsResponse.success && productsResponse.message === "Unauthorized") {
    redirect("/admin/login");
  }

  let products: AdminProduct[] = [];
  if (productsResponse.success && productsResponse.data) {
    const payload = productsResponse.data as ApiListPayload<AdminProduct>;
    products = Array.isArray(payload) ? payload : payload.data || [];
    if (!Array.isArray(payload) && payload.meta) {
      meta = payload.meta;
    }
  }

  const merchants =
    merchantsResponse.success && merchantsResponse.data
      ? merchantsResponse.data
      : [];

  return { products, merchants, meta };
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
  let data: AdminProductsData;

  try {
    data = await fetchAdminProductsData({
      tenantName,
      productName,
      page,
      limit,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Failed to fetch products:", error);
    data = {
      products: [],
      merchants: [],
      meta: {
        page,
        limit,
        total: 0,
        totalPages: 1,
      },
    };
  }

  const { products, merchants, meta } = data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-text">إدارة المنتجات</h1>

      <Card className="p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-bold text-brand-text">
          إضافة منتج لتاجر
        </h2>
        <form action={adminCreateProductAction} className="grid gap-4 md:grid-cols-6">
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-brand-text">التاجر</span>
            <select
              name="tenant_id"
              required
              className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
            >
              <option value="">اختر التاجر</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-brand-text">اسم المنتج</span>
            <input
              name="name"
              required
              className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-brand-text">السعر</span>
            <input
              name="current_price"
              type="number"
              min="0"
              step="0.01"
              className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-brand-text">التصنيف</span>
            <input
              name="category"
              className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 md:col-span-5">
            <input
              name="is_available"
              type="checkbox"
              defaultChecked
              className="h-4 w-4 accent-brand-primary"
            />
            <span className="text-sm font-medium text-brand-text">متاح للبيع</span>
          </label>
          <Button type="submit" className="w-full md:w-auto">
            إضافة
          </Button>
        </form>
      </Card>

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
                  <th className="px-6 py-3 text-right text-xs font-medium text-brand-text uppercase">
                    تعديل
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-brand-border">
                {products.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
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
                          <label className="space-y-1">
                            <span className="text-xs font-medium text-brand-text">التصنيف</span>
                            <input
                              name="category"
                              defaultValue={product.category || ""}
                              className="h-9 w-full rounded-md border border-brand-border px-2 text-xs"
                            />
                          </label>
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
