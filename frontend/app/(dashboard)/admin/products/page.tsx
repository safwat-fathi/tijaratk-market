import { adminService } from "@/services/api/admin.service";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import { redirect } from "next/navigation";
import { AdminPagination } from "../_components/AdminPagination";
import { adminUpdateProductAction } from "@/actions/admin-server";
import type { AdminTenant } from "@/services/api/admin.service";
import AdminProductsOnboardingClient from "./_components/AdminProductsOnboardingClient";

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
  categories: string[];
};

async function fetchAdminProductsData({
  tenantName,
  productName,
  page,
  limit,
  includeProducts,
}: {
  tenantName?: string;
  productName?: string;
  page: number;
  limit: number;
  includeProducts: boolean;
}): Promise<AdminProductsData> {
  let meta: PaginationMeta = {
    page,
    limit,
    total: 0,
    totalPages: 1,
  };

  const [productsResponse, merchantsResponse, categoriesResponse] = await Promise.all([
    includeProducts
      ? adminService.getProducts(
          tenantName,
          productName,
          page,
          limit,
        )
      : Promise.resolve(null),
    adminService.getTenants(),
    adminService.getSupermarketCatalogCategories(),
  ]);

  if (productsResponse && !productsResponse.success && productsResponse.message === "Unauthorized") {
    redirect("/admin/login");
  }

  let products: AdminProduct[] = [];
  if (productsResponse?.success && productsResponse.data) {
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

  const categories =
    categoriesResponse.success && categoriesResponse.data
      ? categoriesResponse.data.map((c) => c.category)
      : [];

  return { products, merchants, meta, categories };
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
  const showAllProducts = searchParams.view === "all-products";
  let data: AdminProductsData;

  try {
    data = await fetchAdminProductsData({
      tenantName,
      productName,
      page,
      limit,
      includeProducts: showAllProducts,
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
      categories: [],
    };
  }

  const { products, merchants, meta, categories } = data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-text">إدارة المنتجات</h1>

      {!showAllProducts ? (
        <AdminProductsOnboardingClient merchants={merchants} />
      ) : null}

      {showAllProducts ? (
        <Card className="p-4 sm:p-6 overflow-hidden">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-brand-text">
                  كل منتجات النظام
                </h2>
                <p className="text-sm text-muted-foreground">
                  عرض إداري منفصل للبحث والتعديل عبر كل التجار.
                </p>
              </div>
              <a
                href="/admin/products"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-brand-border bg-white px-5 py-3 text-sm font-semibold text-brand-text transition hover:border-brand-accent hover:bg-brand-soft/60"
              >
                الرجوع لإدارة تاجر
              </a>
            </div>
            <form
              method="GET"
              action="/admin/products"
              className="flex flex-col sm:flex-row gap-4 items-end"
            >
              <input type="hidden" name="view" value="all-products" />
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
            params={{ tenantName, productName, view: "all-products" }}
          />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
