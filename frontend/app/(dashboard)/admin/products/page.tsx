import { adminService } from "@/services/api/admin.service";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import { redirect } from "next/navigation";
import type { AdminTenant } from "@/services/api/admin.service";
import AdminProductsOnboardingClient from "./_components/AdminProductsOnboardingClient";
import AdminProductsBulkTable from "./_components/AdminProductsBulkTable";

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
const SUPERMARKET_CATALOG_SOURCE = "talabat_csv";
type TenantCategoryFilter = "grocery" | "pharmacy";

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

function parseTenantCategoryFilter(
  value: string | string[] | undefined,
): TenantCategoryFilter | undefined {
  return value === "grocery" || value === "pharmacy" ? value : undefined;
}

async function fetchAdminProductsData({
  tenantName,
  productName,
  tenantCategory,
  page,
  limit,
  includeProducts,
}: {
  tenantName?: string;
  productName?: string;
  tenantCategory?: TenantCategoryFilter;
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
          tenantCategory,
          page,
          limit,
        )
      : Promise.resolve(null),
    adminService.getTenants(),
    adminService.getAdminCatalogCategories(SUPERMARKET_CATALOG_SOURCE),
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
  const tenantCategory = parseTenantCategoryFilter(searchParams.tenantCategory);
  const page = parsePositiveInteger(searchParams.page, 1);
  const limit = parsePositiveInteger(searchParams.limit, DEFAULT_PAGE_SIZE);
  const showAllProducts = searchParams.view === "all-products";
  let data: AdminProductsData;

  try {
    data = await fetchAdminProductsData({
      tenantName,
      productName,
      tenantCategory,
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
  const merchantNameOptions = Array.from(
    new Set(merchants.map((merchant) => merchant.name).filter(Boolean)),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-brand-text">منتجات النظام</h1>
          <a
            href="/api/admin/products/import-template"
            download
            className="inline-flex items-center justify-center rounded-md border border-brand-border bg-white px-4 py-2 text-sm font-semibold text-brand-text transition hover:border-brand-accent hover:bg-brand-soft/60 shadow-sm"
          >
            <svg className="me-2 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            تحميل قالب الاستيراد CSV
          </a>
        </div>
        <p className="text-sm text-brand-muted">
          إدارة جميع المنتجات عبر المتاجر أو التركيز على تاجر محدد
        </p>
      </div>

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
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px_auto] lg:items-end"
            >
              <input type="hidden" name="view" value="all-products" />
              <div className="space-y-1">
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
              <Combobox
                name="tenantName"
                label="التاجر"
                options={merchantNameOptions}
                defaultValue={tenantName}
                wrapperClassName="space-y-1"
                labelClassName="text-sm"
                inputClassName="h-10 px-3 text-sm"
                placeholder="ابحث باسم التاجر"
              />
              <div className="space-y-1">
                <label className="text-sm font-medium text-brand-text">
                  نوع المتجر
                </label>
                <select
                  name="tenantCategory"
                  defaultValue={tenantCategory || ""}
                  className="h-10 w-full rounded-md border border-brand-border px-3 text-sm focus:brand-focus"
                >
                  <option value="">الكل</option>
                  <option value="grocery">سوبر ماركت</option>
                  <option value="pharmacy">صيدلية</option>
                </select>
              </div>
              <div>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full bg-brand-primary hover:bg-brand-primary-hover"
                >
                  بحث
                </Button>
              </div>
            </form>

          <AdminProductsBulkTable
            products={products}
            categories={categories}
            meta={meta}
            params={{
              tenantName,
              productName,
              tenantCategory,
              view: "all-products",
            }}
          />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
