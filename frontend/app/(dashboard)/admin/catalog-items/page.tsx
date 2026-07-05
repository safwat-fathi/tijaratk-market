import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Search, X } from "lucide-react";
import { adminService } from "@/services/api/admin.service";
import type {
  AdminCatalogCategory,
  AdminCatalogItem,
  AdminCatalogType,
} from "@/services/api/admin.service";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import AdminCatalogItemsBulkClient from "./_components/AdminCatalogItemsBulkClient";
import AdminCatalogItemCreateClient from "./_components/AdminCatalogItemCreateClient";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type SearchParamValue = string | string[] | undefined;

type PageData = {
  items: AdminCatalogItem[];
  categories: AdminCatalogCategory[];
  meta: PaginationMeta;
};

type CatalogItemStatusFilter = "all" | "active" | "inactive";
type CatalogItemEssentialStatusFilter = "all" | "essential" | "non_essential";

const DEFAULT_PAGE_SIZE = 20;
const GROCERY_CATALOG_TYPE = "grocery";
const PHARMACY_CATALOG_TYPE = "pharmacy";
const LEGACY_SUPERMARKET_SOURCE = "talabat_csv";
const LEGACY_PHARMACY_SOURCE = "chefaa_csv";

const SOURCE_TABS: Array<{
  label: string;
  catalogType: AdminCatalogType;
  description: string;
}> = [
  {
    label: "سوبر ماركت",
    catalogType: GROCERY_CATALOG_TYPE,
    description: "كتالوج منتجات السوبر ماركت",
  },
  {
    label: "صيدلية",
    catalogType: PHARMACY_CATALOG_TYPE,
    description: "كتالوج منتجات الصيدليات",
  },
];

const emptyMeta = (page: number, limit: number): PaginationMeta => ({
  page,
  limit,
  total: 0,
  totalPages: 1,
});

const parsePositiveInteger = (value: SearchParamValue, fallback: number) => {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getSearchValue = (value: SearchParamValue) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const parseCatalogType = ({
  catalogType,
  legacySource,
}: {
  catalogType: SearchParamValue;
  legacySource: SearchParamValue;
}): AdminCatalogType => {
  if (catalogType === PHARMACY_CATALOG_TYPE) return PHARMACY_CATALOG_TYPE;
  if (catalogType === GROCERY_CATALOG_TYPE) return GROCERY_CATALOG_TYPE;
  if (legacySource === LEGACY_PHARMACY_SOURCE) return PHARMACY_CATALOG_TYPE;
  return GROCERY_CATALOG_TYPE;
};

const parseStatus = (value: SearchParamValue): CatalogItemStatusFilter =>
  value === "active" || value === "inactive" ? value : "all";

const parseEssentialStatus = (
  value: SearchParamValue,
): CatalogItemEssentialStatusFilter =>
  value === "essential" || value === "non_essential" ? value : "all";

const buildUrl = (params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });

  const search = query.toString();
  return search ? `/admin/catalog-items?${search}` : "/admin/catalog-items";
};

async function fetchData({
  catalogType,
  search,
  category,
  status,
  essentialStatus,
  page,
  limit,
}: {
  catalogType: AdminCatalogType;
  search?: string;
  category?: string;
  status: CatalogItemStatusFilter;
  essentialStatus: CatalogItemEssentialStatusFilter;
  page: number;
  limit: number;
}): Promise<PageData> {
  const [itemsResponse, categoriesResponse] = await Promise.all([
    adminService.getAdminCatalogItems({
      catalogType,
      search,
      category,
      status,
      essentialStatus,
      page,
      limit,
    }),
    adminService.getAdminCatalogCategories(catalogType),
  ]);

  if (!itemsResponse.success && itemsResponse.message === "Unauthorized") {
    redirect("/admin/login");
  }

  return {
    items:
      itemsResponse.success && itemsResponse.data?.data
        ? itemsResponse.data.data
        : [],
    categories:
      categoriesResponse.success && categoriesResponse.data
        ? categoriesResponse.data
        : [],
    meta:
      itemsResponse.success && itemsResponse.data?.meta
        ? itemsResponse.data.meta
        : emptyMeta(page, limit),
  };
}

export default async function AdminCatalogItemsPage(props: Props) {
  const searchParams = await props.searchParams;
  const catalogType = parseCatalogType({
    catalogType: searchParams.catalogType,
    legacySource: searchParams.source,
  });
  const search = getSearchValue(searchParams.search);
  const category = getSearchValue(searchParams.category);
  const status = parseStatus(searchParams.status);
  const essentialStatus = parseEssentialStatus(searchParams.essentialStatus);
  const page = parsePositiveInteger(searchParams.page, 1);
  const limit = parsePositiveInteger(searchParams.limit, DEFAULT_PAGE_SIZE);
  const activeTab =
    SOURCE_TABS.find((tab) => tab.catalogType === catalogType) ||
    SOURCE_TABS[0];

  let data: PageData;
  try {
    data = await fetchData({
      catalogType,
      search,
      category,
      status,
      essentialStatus,
      page,
      limit,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Failed to fetch admin catalog items:", error);
    data = {
      items: [],
      categories: [],
      meta: emptyMeta(page, limit),
    };
  }

  const categoryNames = data.categories.map((item) => item.category);
  const exportHref = adminService.getAdminCatalogExportPath(catalogType);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-brand-text">عناصر الكتالوج</h1>
        <p className="text-sm text-brand-muted">
          إدارة عناصر الكتالوج العالمية حسب نوع المتجر مع عزل مصدر السوبر ماركت
          عن مصدر الصيدليات.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {SOURCE_TABS.map((tab) => (
            <Link
              key={tab.catalogType}
              href={buildUrl({
                catalogType: tab.catalogType,
                page: 1,
                limit,
              })}
              className={`rounded-md border px-4 py-2 text-sm font-semibold transition-colors ${
                catalogType === tab.catalogType
                  ? "border-brand-primary bg-brand-primary text-white"
                  : "border-brand-border bg-white text-brand-text hover:bg-brand-soft"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <a
            href={exportHref}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-brand-border bg-white px-4 py-2 text-sm font-semibold text-brand-text transition hover:border-brand-accent hover:bg-brand-soft/60"
          >
            <Download className="h-4 w-4" />
            تنزيل CSV للمنتجات
          </a>
          <AdminCatalogItemCreateClient
            source={
              catalogType === PHARMACY_CATALOG_TYPE
                ? LEGACY_PHARMACY_SOURCE
                : LEGACY_SUPERMARKET_SOURCE
            }
            activeTabLabel={activeTab.label}
            activeTabDescription={activeTab.description}
            categoryNames={categoryNames}
          />
        </div>
      </div>

      <Card className="overflow-hidden p-4 sm:p-6">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-brand-text">
              عناصر {activeTab.label}
            </h2>
            <p className="text-sm text-brand-muted">
              إجمالي النتائج الحالية: {data.meta.total}
            </p>
          </div>

          <form
            method="GET"
            action="/admin/catalog-items"
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="catalogType" value={catalogType} />
            <label className="w-full space-y-1 sm:w-1/4">
              <span className="text-sm font-medium text-brand-text">
                اسم المنتج
              </span>
              <input
                name="search"
                defaultValue={search}
                className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
                placeholder="ابحث في الكتالوج"
              />
            </label>
            <Combobox
              name="category"
              label="التصنيف"
              options={categoryNames}
              defaultValue={category || ""}
              wrapperClassName="sm:w-1/4"
              inputClassName="h-10 px-3 text-sm"
              placeholder="اكتب للبحث في التصنيفات"
            />
            <label className="w-full space-y-1 sm:w-48">
              <span className="text-sm font-medium text-brand-text">
                حالة التفعيل
              </span>
              <select
                name="status"
                defaultValue={status}
                className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
              >
                <option value="all">الكل</option>
                <option value="active">نشط فقط</option>
                <option value="inactive">غير نشط</option>
              </select>
            </label>
            <label className="w-full space-y-1 sm:w-48">
              <span className="text-sm font-medium text-brand-text">
                حالة الأساسي
              </span>
              <select
                name="essentialStatus"
                defaultValue={essentialStatus}
                className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
              >
                <option value="all">الكل</option>
                <option value="essential">أساسي فقط</option>
                <option value="non_essential">غير أساسي</option>
              </select>
            </label>
            <div className="flex items-center gap-2 mr-auto">
              <Button type="submit" size="sm" className="px-4">
                <Search className="h-4 w-4" />
                بحث
              </Button>
              <Link
                href={buildUrl({ catalogType, page: 1, limit })}
                className="inline-flex items-center justify-center gap-2 min-h-10 rounded-md border border-brand-border bg-white px-4 py-2 text-sm font-semibold text-brand-text transition-colors hover:bg-brand-soft"
              >
                <X className="h-4 w-4" />
                مسح
              </Link>
            </div>
          </form>

          <AdminCatalogItemsBulkClient
            items={data.items}
            categoryNames={categoryNames}
            meta={data.meta}
            params={{ catalogType, search, category, status, essentialStatus }}
          />
        </div>
      </Card>
    </div>
  );
}
