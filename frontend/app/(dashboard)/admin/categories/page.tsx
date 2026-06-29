import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Combobox } from "@/components/ui/Combobox";
import { adminService } from "@/services/api/admin.service";
import type {
  AdminCatalogCategory,
  AdminCatalogSource,
  AdminTenant,
  AdminTenantProductCategory,
} from "@/services/api/admin.service";
import {
  adminCreateCatalogCategoryAction,
  adminCreateTenantProductCategoryAction,
  adminDeleteCatalogCategoryAction,
  adminDeleteTenantProductCategoryAction,
  adminUpdateCatalogCategoryAction,
  adminUpdateTenantProductCategoryAction,
} from "@/actions/admin-server";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

type SearchParamValue = string | string[] | undefined;

type PageData = {
  catalogCategories: AdminCatalogCategory[];
  tenants: AdminTenant[];
  tenantCategories: AdminTenantProductCategory[];
};

type UsageFilter = "all" | "empty" | "in-use";
type SortFilter = "name-asc" | "count-desc" | "count-asc";
type TenantCategoryFilter = "all" | "grocery" | "pharmacy" | "other";

type FilterState = {
  catalogSearch?: string;
  catalogUsage: UsageFilter;
  catalogSort: SortFilter;
  tenantSearch?: string;
  tenantUsage: UsageFilter;
  tenantSort: SortFilter;
  tenantCategory: TenantCategoryFilter;
};

type CategorySummary = {
  total: number;
  inUse: number;
  deletable: number;
  linkedCount: number;
};

const SUPERMARKET_SOURCE = "talabat_csv";
const PHARMACY_SOURCE = "chefaa_csv";

const SOURCE_TABS: Array<{ label: string; source: AdminCatalogSource }> = [
  { label: "سوبر ماركت", source: SUPERMARKET_SOURCE },
  { label: "صيدلية", source: PHARMACY_SOURCE },
];

const parseSource = (value: SearchParamValue): AdminCatalogSource =>
  value === PHARMACY_SOURCE ? PHARMACY_SOURCE : SUPERMARKET_SOURCE;

const parseTenantId = (value: SearchParamValue) => {
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const getSearchValue = (value: SearchParamValue) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const parseUsageFilter = (value: SearchParamValue): UsageFilter =>
  value === "empty" || value === "in-use" ? value : "all";

const parseSortFilter = (value: SearchParamValue): SortFilter =>
  value === "count-desc" || value === "count-asc" ? value : "name-asc";

const parseTenantCategoryFilter = (
  value: SearchParamValue,
): TenantCategoryFilter =>
  value === "grocery" || value === "pharmacy" || value === "other"
    ? value
    : "all";

const buildUrl = (params: {
  source?: AdminCatalogSource;
  tenantId?: number;
  catalogSearch?: string;
  catalogUsage?: UsageFilter;
  catalogSort?: SortFilter;
  tenantSearch?: string;
  tenantUsage?: UsageFilter;
  tenantSort?: SortFilter;
  tenantCategory?: TenantCategoryFilter;
}) => {
  const query = new URLSearchParams();
  if (params.source) query.set("source", params.source);
  if (params.tenantId) query.set("tenantId", String(params.tenantId));
  if (params.catalogSearch) query.set("catalogSearch", params.catalogSearch);
  if (params.catalogUsage && params.catalogUsage !== "all") {
    query.set("catalogUsage", params.catalogUsage);
  }
  if (params.catalogSort && params.catalogSort !== "name-asc") {
    query.set("catalogSort", params.catalogSort);
  }
  if (params.tenantSearch) query.set("tenantSearch", params.tenantSearch);
  if (params.tenantUsage && params.tenantUsage !== "all") {
    query.set("tenantUsage", params.tenantUsage);
  }
  if (params.tenantSort && params.tenantSort !== "name-asc") {
    query.set("tenantSort", params.tenantSort);
  }
  if (params.tenantCategory && params.tenantCategory !== "all") {
    query.set("tenantCategory", params.tenantCategory);
  }
  const search = query.toString();
  return search ? `/admin/categories?${search}` : "/admin/categories";
};

const normalizeForSearch = (value: string) => value.trim().toLowerCase();

const filterByUsage = <T extends { count: number }>(
  rows: T[],
  usage: UsageFilter,
) => {
  if (usage === "empty") return rows.filter((row) => row.count === 0);
  if (usage === "in-use") return rows.filter((row) => row.count > 0);
  return rows;
};

const sortByCountOrName = <T extends { count: number }>(
  rows: T[],
  getName: (row: T) => string,
  sort: SortFilter,
) =>
  [...rows].sort((left, right) => {
    if (sort === "count-desc") return right.count - left.count;
    if (sort === "count-asc") return left.count - right.count;
    return getName(left).localeCompare(getName(right), "ar");
  });

const filterCatalogCategories = (
  categories: AdminCatalogCategory[],
  filters: FilterState,
) => {
  const search = filters.catalogSearch
    ? normalizeForSearch(filters.catalogSearch)
    : "";
  const searched = search
    ? categories.filter((category) =>
        normalizeForSearch(category.category).includes(search),
      )
    : categories;

  return sortByCountOrName(
    filterByUsage(searched, filters.catalogUsage),
    (category) => category.category,
    filters.catalogSort,
  );
};

const filterTenantCategories = (
  categories: AdminTenantProductCategory[],
  filters: FilterState,
) => {
  const search = filters.tenantSearch
    ? normalizeForSearch(filters.tenantSearch)
    : "";
  const searched = search
    ? categories.filter((category) =>
        normalizeForSearch(category.name).includes(search),
      )
    : categories;

  return sortByCountOrName(
    filterByUsage(searched, filters.tenantUsage),
    (category) => category.name,
    filters.tenantSort,
  );
};

const summarizeCategories = (rows: { count: number }[]): CategorySummary => ({
  total: rows.length,
  inUse: rows.filter((row) => row.count > 0).length,
  deletable: rows.filter((row) => row.count === 0).length,
  linkedCount: rows.reduce((sum, row) => sum + row.count, 0),
});

async function fetchData(
  source: AdminCatalogSource,
  tenantId?: number,
): Promise<PageData> {
  const [catalogResponse, tenantsResponse, tenantCategoriesResponse] =
    await Promise.all([
      adminService.getAdminCatalogCategories(source),
      adminService.getTenants(),
      tenantId
        ? adminService.getAdminTenantProductCategories(tenantId)
        : Promise.resolve({ success: true, data: [] }),
    ]);

  if (!catalogResponse.success && catalogResponse.message === "Unauthorized") {
    redirect("/admin/login");
  }

  return {
    catalogCategories:
      catalogResponse.success && catalogResponse.data
        ? catalogResponse.data
        : [],
    tenants:
      tenantsResponse.success && tenantsResponse.data ? tenantsResponse.data : [],
    tenantCategories:
      tenantCategoriesResponse.success && tenantCategoriesResponse.data
        ? tenantCategoriesResponse.data
        : [],
  };
}

// The page composes two filtered admin tables; keeping the branch logic together
// makes the URL-driven state easier to audit.
// eslint-disable-next-line sonarjs/cognitive-complexity
export default async function AdminCategoriesPage(props: Props) {
  const searchParams = await props.searchParams;
  const source = parseSource(searchParams.source);
  const tenantId = parseTenantId(searchParams.tenantId);
  const filters: FilterState = {
    catalogSearch: getSearchValue(searchParams.catalogSearch),
    catalogUsage: parseUsageFilter(searchParams.catalogUsage),
    catalogSort: parseSortFilter(searchParams.catalogSort),
    tenantSearch: getSearchValue(searchParams.tenantSearch),
    tenantUsage: parseUsageFilter(searchParams.tenantUsage),
    tenantSort: parseSortFilter(searchParams.tenantSort),
    tenantCategory: parseTenantCategoryFilter(searchParams.tenantCategory),
  };

  let data: PageData;
  try {
    data = await fetchData(source, tenantId);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Failed to fetch admin categories:", error);
    data = { catalogCategories: [], tenants: [], tenantCategories: [] };
  }

  const selectedTenant = tenantId
    ? data.tenants.find((tenant) => tenant.id === tenantId)
    : undefined;
  const filteredTenants =
    filters.tenantCategory === "all"
      ? data.tenants
      : data.tenants.filter(
          (tenant) => (tenant.category || "other") === filters.tenantCategory,
        );
  const catalogCategoryOptions = data.catalogCategories.map(
    (category) => category.category,
  );
  const tenantCategoryOptions = data.tenantCategories.map(
    (category) => category.name,
  );
  const tenantOptions = filteredTenants.map((tenant) => ({
    value: tenant.id,
    label: tenant.name,
  }));
  const filteredCatalogCategories = filterCatalogCategories(
    data.catalogCategories,
    filters,
  );
  const filteredTenantCategories = filterTenantCategories(
    data.tenantCategories,
    filters,
  );
  const catalogSummary = summarizeCategories(data.catalogCategories);
  const tenantSummary = summarizeCategories(data.tenantCategories);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-brand-text">التصنيفات</h1>
        <p className="text-sm text-brand-muted">
          إدارة تصنيفات الكتالوج حسب المصدر وتصنيفات المنتجات الخاصة بكل تاجر.
        </p>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-brand-text">
              تصنيفات الكتالوج
            </h2>
            <p className="text-sm text-brand-muted">
              الحذف متاح فقط للتصنيفات التي لا تحتوي على عناصر نشطة.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SOURCE_TABS.map((tab) => (
              <Link
                key={tab.source}
                href={buildUrl({
                  source: tab.source,
                  tenantId,
                  catalogSearch: filters.catalogSearch,
                  catalogUsage: filters.catalogUsage,
                  catalogSort: filters.catalogSort,
                  tenantSearch: filters.tenantSearch,
                  tenantUsage: filters.tenantUsage,
                  tenantSort: filters.tenantSort,
                  tenantCategory: filters.tenantCategory,
                })}
                className={`rounded-md border px-4 py-2 text-sm font-semibold transition-colors ${
                  source === tab.source
                    ? "border-brand-primary bg-brand-primary text-white"
                    : "border-brand-border bg-white text-brand-text hover:bg-brand-soft"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>

        <SummaryChips
          linkedLabel="العناصر"
          summary={catalogSummary}
          className="mb-4"
        />

        <form
          action={adminCreateCatalogCategoryAction}
          className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]"
        >
          <input type="hidden" name="source" value={source} />
          <label className="space-y-1">
            <span className="text-sm font-medium text-brand-text">
              تصنيف جديد
            </span>
            <input
              name="name"
              required
              maxLength={64}
              className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" className="w-full sm:w-auto">
              إضافة
            </Button>
          </div>
        </form>

        <form
          method="GET"
          action="/admin/categories"
          className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem_auto_auto]"
        >
          <input type="hidden" name="source" value={source} />
          {tenantId ? (
            <input type="hidden" name="tenantId" value={tenantId} />
          ) : null}
          {filters.tenantSearch ? (
            <input type="hidden" name="tenantSearch" value={filters.tenantSearch} />
          ) : null}
          <input type="hidden" name="tenantUsage" value={filters.tenantUsage} />
          <input type="hidden" name="tenantSort" value={filters.tenantSort} />
          <input
            type="hidden"
            name="tenantCategory"
            value={filters.tenantCategory}
          />
          <Combobox
            name="catalogSearch"
            label="بحث التصنيفات"
            options={catalogCategoryOptions}
            defaultValue={filters.catalogSearch || ""}
            wrapperClassName="md:col-span-1"
            inputClassName="h-10 px-3 text-sm"
            placeholder="اكتب أو اختر تصنيفًا"
          />
          <label className="space-y-1">
            <span className="text-sm font-medium text-brand-text">
              الاستخدام
            </span>
            <select
              name="catalogUsage"
              defaultValue={filters.catalogUsage}
              className="h-10 w-full rounded-md border border-brand-border bg-white px-3 text-sm"
            >
              <option value="all">الكل</option>
              <option value="empty">قابل للحذف</option>
              <option value="in-use">به عناصر</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-brand-text">الترتيب</span>
            <select
              name="catalogSort"
              defaultValue={filters.catalogSort}
              className="h-10 w-full rounded-md border border-brand-border bg-white px-3 text-sm"
            >
              <option value="name-asc">الاسم</option>
              <option value="count-desc">الأكثر عناصر</option>
              <option value="count-asc">الأقل عناصر</option>
            </select>
          </label>
          <div className="flex items-end">
            <Button type="submit" variant="outline" className="w-full">
              تطبيق
            </Button>
          </div>
          <div className="flex items-end">
            <Link
              href={buildUrl({
                source,
                tenantId,
                tenantSearch: filters.tenantSearch,
                tenantUsage: filters.tenantUsage,
                tenantSort: filters.tenantSort,
                tenantCategory: filters.tenantCategory,
              })}
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-brand-border px-4 text-sm font-semibold text-brand-text transition-colors hover:bg-brand-soft"
            >
              مسح
            </Link>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-brand-border">
            <thead className="bg-brand-soft">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
                  التصنيف
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
                  العناصر
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border bg-white">
              {filteredCatalogCategories.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">
                    {data.catalogCategories.length === 0
                      ? "لا توجد تصنيفات لهذا المصدر"
                      : "لا توجد تصنيفات مطابقة للفلاتر"}
                  </td>
                </tr>
              ) : (
                filteredCatalogCategories.map((category) => (
                  <CatalogCategoryRow key={category.category} category={category} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-lg font-bold text-brand-text">
            تصنيفات منتجات التاجر
          </h2>
          <p className="text-sm text-brand-muted">
            اختر تاجرًا لإضافة أو تعديل تصنيفاته الخاصة.
          </p>
        </div>

        <SummaryChips
          linkedLabel="المنتجات"
          summary={tenantSummary}
          className="mb-4"
        />

        <form method="GET" action="/admin/categories" className="mb-5 grid gap-3 md:grid-cols-[10rem_minmax(0,1fr)_auto]">
          <input type="hidden" name="source" value={source} />
          {filters.catalogSearch ? (
            <input type="hidden" name="catalogSearch" value={filters.catalogSearch} />
          ) : null}
          <input type="hidden" name="catalogUsage" value={filters.catalogUsage} />
          <input type="hidden" name="catalogSort" value={filters.catalogSort} />
          <label className="space-y-1">
            <span className="text-sm font-medium text-brand-text">
              نوع المتجر
            </span>
            <select
              name="tenantCategory"
              defaultValue={filters.tenantCategory}
              className="h-10 w-full rounded-md border border-brand-border bg-white px-3 text-sm"
            >
              <option value="all">الكل</option>
              <option value="grocery">سوبر ماركت</option>
              <option value="pharmacy">صيدلية</option>
              <option value="other">أخرى</option>
            </select>
          </label>
          <Combobox
            name="tenantId"
            label="التاجر"
            options={tenantOptions}
            defaultValue={tenantId || ""}
            inputClassName="h-10 px-3 text-sm"
            placeholder="اختر تاجرًا"
          />
          <div className="flex items-end">
            <Button type="submit" variant="outline" className="w-full sm:w-auto">
              عرض
            </Button>
          </div>
        </form>

        {selectedTenant ? (
          <>
            <form
              method="GET"
              action="/admin/categories"
              className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem_auto_auto]"
            >
              <input type="hidden" name="source" value={source} />
              <input type="hidden" name="tenantId" value={selectedTenant.id} />
              {filters.catalogSearch ? (
                <input type="hidden" name="catalogSearch" value={filters.catalogSearch} />
              ) : null}
              <input type="hidden" name="catalogUsage" value={filters.catalogUsage} />
              <input type="hidden" name="catalogSort" value={filters.catalogSort} />
              <input
                type="hidden"
                name="tenantCategory"
                value={filters.tenantCategory}
              />
              <Combobox
                name="tenantSearch"
                label="بحث تصنيفات التاجر"
                options={tenantCategoryOptions}
                defaultValue={filters.tenantSearch || ""}
                inputClassName="h-10 px-3 text-sm"
                placeholder="اكتب أو اختر تصنيفًا"
              />
              <label className="space-y-1">
                <span className="text-sm font-medium text-brand-text">
                  الاستخدام
                </span>
                <select
                  name="tenantUsage"
                  defaultValue={filters.tenantUsage}
                  className="h-10 w-full rounded-md border border-brand-border bg-white px-3 text-sm"
                >
                  <option value="all">الكل</option>
                  <option value="empty">قابل للحذف</option>
                  <option value="in-use">به منتجات</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-brand-text">
                  الترتيب
                </span>
                <select
                  name="tenantSort"
                  defaultValue={filters.tenantSort}
                  className="h-10 w-full rounded-md border border-brand-border bg-white px-3 text-sm"
                >
                  <option value="name-asc">الاسم</option>
                  <option value="count-desc">الأكثر منتجات</option>
                  <option value="count-asc">الأقل منتجات</option>
                </select>
              </label>
              <div className="flex items-end">
                <Button type="submit" variant="outline" className="w-full">
                  تطبيق
                </Button>
              </div>
              <div className="flex items-end">
                <Link
                  href={buildUrl({
                    source,
                    tenantId: selectedTenant.id,
                    catalogSearch: filters.catalogSearch,
                    catalogUsage: filters.catalogUsage,
                    catalogSort: filters.catalogSort,
                    tenantCategory: filters.tenantCategory,
                  })}
                  className="inline-flex h-10 w-full items-center justify-center rounded-md border border-brand-border px-4 text-sm font-semibold text-brand-text transition-colors hover:bg-brand-soft"
                >
                  مسح
                </Link>
              </div>
            </form>

            <form
              action={adminCreateTenantProductCategoryAction.bind(
                null,
                selectedTenant.id,
              )}
              className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]"
            >
              <label className="space-y-1">
                <span className="text-sm font-medium text-brand-text">
                  تصنيف جديد لـ {selectedTenant.name}
                </span>
                <input
                  name="name"
                  required
                  maxLength={64}
                  className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
                />
              </label>
              <div className="flex items-end">
                <Button type="submit" className="w-full sm:w-auto">
                  إضافة
                </Button>
              </div>
            </form>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-border">
                <thead className="bg-brand-soft">
                  <tr>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
                      التصنيف
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
                      المنتجات
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
                      إجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border bg-white">
                  {filteredTenantCategories.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">
                        {data.tenantCategories.length === 0
                          ? "لا توجد تصنيفات خاصة بهذا التاجر"
                          : "لا توجد تصنيفات مطابقة للفلاتر"}
                      </td>
                    </tr>
                  ) : (
                    filteredTenantCategories.map((category) => (
                      <TenantCategoryRow
                        key={category.id}
                        tenantId={selectedTenant.id}
                        category={category}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="rounded-md border border-dashed border-brand-border px-4 py-8 text-center text-sm text-brand-muted">
            اختر تاجرًا لعرض تصنيفات منتجاته.
          </div>
        )}
      </Card>
    </div>
  );
}

function CatalogCategoryRow({ category }: { category: AdminCatalogCategory }) {
  const categoryId = category.id ?? 0;
  const canMutate = categoryId > 0;
  const canDelete = canMutate && category.count === 0;

  return (
    <tr>
      <td className="px-4 py-3 text-sm font-semibold text-brand-text">
        {category.category}
      </td>
      <td className="px-4 py-3 text-sm text-brand-muted">{category.count}</td>
      <td className="min-w-80 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <form
            action={adminUpdateCatalogCategoryAction.bind(null, categoryId)}
            className="flex flex-1 gap-2"
          >
            <input
              name="name"
              defaultValue={category.name || category.category}
              required
              maxLength={64}
              disabled={!canMutate}
              className="h-10 min-w-0 flex-1 rounded-md border border-brand-border px-3 text-sm"
            />
            <Button type="submit" size="sm" disabled={!canMutate}>
              حفظ
            </Button>
          </form>
          <form action={adminDeleteCatalogCategoryAction.bind(null, categoryId)}>
            <Button type="submit" size="sm" variant="destructive" disabled={!canDelete}>
              حذف
            </Button>
          </form>
        </div>
      </td>
    </tr>
  );
}

function SummaryChips({
  linkedLabel,
  summary,
  className = "",
}: {
  linkedLabel: string;
  summary: CategorySummary;
  className?: string;
}) {
  const chips = [
    { label: "التصنيفات", value: summary.total },
    { label: "مستخدمة", value: summary.inUse },
    { label: "قابلة للحذف", value: summary.deletable },
    { label: linkedLabel, value: summary.linkedCount },
  ];

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="inline-flex items-center gap-2 rounded-md border border-brand-border bg-brand-soft px-3 py-1.5 text-sm text-brand-text"
        >
          <span className="font-semibold">{chip.value}</span>
          <span className="text-brand-muted">{chip.label}</span>
        </span>
      ))}
    </div>
  );
}

function TenantCategoryRow({
  tenantId,
  category,
}: {
  tenantId: number;
  category: AdminTenantProductCategory;
}) {
  const canDelete = category.count === 0;

  return (
    <tr>
      <td className="px-4 py-3 text-sm font-semibold text-brand-text">
        {category.name}
      </td>
      <td className="px-4 py-3 text-sm text-brand-muted">{category.count}</td>
      <td className="min-w-80 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <form
            action={adminUpdateTenantProductCategoryAction.bind(
              null,
              tenantId,
              category.id,
            )}
            className="flex flex-1 gap-2"
          >
            <input
              name="name"
              defaultValue={category.name}
              required
              maxLength={64}
              className="h-10 min-w-0 flex-1 rounded-md border border-brand-border px-3 text-sm"
            />
            <Button type="submit" size="sm">
              حفظ
            </Button>
          </form>
          <form
            action={adminDeleteTenantProductCategoryAction.bind(
              null,
              tenantId,
              category.id,
            )}
          >
            <Button type="submit" size="sm" variant="destructive" disabled={!canDelete}>
              حذف
            </Button>
          </form>
        </div>
      </td>
    </tr>
  );
}
