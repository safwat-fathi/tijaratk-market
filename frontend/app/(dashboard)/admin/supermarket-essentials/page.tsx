import Link from "next/link";
import { redirect } from "next/navigation";
import { adminService } from "@/services/api/admin.service";
import type {
  AdminCatalogCategory,
  AdminCatalogItem,
} from "@/services/api/admin.service";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import SafeImage from "@/components/ui/SafeImage";
import { ScrollableTabList, TabButton } from "@/components/ui/ScrollableTabs";
import { Combobox } from "@/components/ui/Combobox";
import { AdminPagination } from "../_components/AdminPagination";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import { resolveImageUrl } from "@/app/(dashboard)/merchant/(features)/products/new/_utils/product-onboarding";
import {
  adminCreateSupermarketEssentialAction,
  adminDeleteSupermarketEssentialAction,
  adminMarkCatalogItemEssentialAction,
  adminUpdateSupermarketEssentialAction,
} from "@/actions/admin-server";

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

type PageData = {
  essentials: AdminCatalogItem[];
  candidates: AdminCatalogItem[];
  categories: AdminCatalogCategory[];
  essentialsMeta: PaginationMeta;
  candidatesMeta: PaginationMeta;
};

const DEFAULT_PAGE_SIZE = 20;
const CANDIDATE_LIMIT = 50;

const emptyMeta = (page: number, limit: number): PaginationMeta => ({
  page,
  limit,
  total: 0,
  totalPages: 1,
});

const parsePositiveInteger = (
  value: string | string[] | undefined,
  fallback: number,
) => {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getSearchValue = (value: string | string[] | undefined) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const formatPrice = (price?: number | string | null) =>
  price === null || price === undefined || price === "" ? "" : String(price);

const buildUrl = (
  params: Record<string, string | number | undefined>,
  basePath = "/admin/supermarket-essentials",
) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });

  const search = query.toString();
  return search ? `${basePath}?${search}` : basePath;
};

async function fetchData({
  search,
  category,
  candidateSearch,
  candidateCategory,
  page,
  candidatePage,
  limit,
}: {
  search?: string;
  category?: string;
  candidateSearch?: string;
  candidateCategory?: string;
  page: number;
  candidatePage: number;
  limit: number;
}): Promise<PageData> {
  const [essentialsResponse, candidatesResponse, categoriesResponse] =
    await Promise.all([
      adminService.getSupermarketEssentials({
        search,
        category,
        page,
        limit,
      }),
      adminService.getSupermarketCatalogCandidates({
        search: candidateSearch,
        category: candidateCategory,
        page: candidatePage,
        limit: CANDIDATE_LIMIT,
      }),
      adminService.getSupermarketCatalogCategories(),
    ]);

  if (
    !essentialsResponse.success &&
    essentialsResponse.message === "Unauthorized"
  ) {
    redirect("/admin/login");
  }

  return {
    essentials:
      essentialsResponse.success && essentialsResponse.data?.data
        ? essentialsResponse.data.data
        : [],
    candidates:
      candidatesResponse.success && candidatesResponse.data?.data
        ? candidatesResponse.data.data
        : [],
    categories:
      categoriesResponse.success && categoriesResponse.data
        ? categoriesResponse.data
        : [],
    essentialsMeta:
      essentialsResponse.success && essentialsResponse.data?.meta
        ? essentialsResponse.data.meta
        : emptyMeta(page, limit),
    candidatesMeta:
      candidatesResponse.success && candidatesResponse.data?.meta
        ? candidatesResponse.data.meta
        : emptyMeta(candidatePage, CANDIDATE_LIMIT),
  };
}

export default async function SupermarketEssentialsPage(props: Props) {
  const searchParams = await props.searchParams;
  const search = getSearchValue(searchParams.search);
  const category = getSearchValue(searchParams.category);
  const candidateSearch = getSearchValue(searchParams.candidateSearch);
  const candidateCategory = getSearchValue(searchParams.candidateCategory);
  const page = parsePositiveInteger(searchParams.page, 1);
  const candidatePage = parsePositiveInteger(searchParams.candidatePage, 1);
  const limit = parsePositiveInteger(searchParams.limit, DEFAULT_PAGE_SIZE);

  let data: PageData;
  try {
    data = await fetchData({
      search,
      category,
      candidateSearch,
      candidateCategory,
      page,
      candidatePage,
      limit,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Failed to fetch supermarket essentials:", error);
    data = {
      essentials: [],
      candidates: [],
      categories: [],
      essentialsMeta: emptyMeta(page, limit),
      candidatesMeta: emptyMeta(candidatePage, CANDIDATE_LIMIT),
    };
  }

  const {
    essentials,
    candidates,
    categories,
    essentialsMeta,
    candidatesMeta,
  } = data;

  const categoryNames = categories.map((c) => c.category);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-brand-text">
          أساسيات السوبر ماركت
        </h1>
        <p className="text-sm text-brand-muted">
          إدارة المنتجات العالمية التي تظهر لتجار السوبر ماركت في إضافة
          التشكيلة الأساسية.
        </p>
      </div>

      <Card className="p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-bold text-brand-text">
          إضافة منتج أساسي جديد
        </h2>
        <form
          action={adminCreateSupermarketEssentialAction}
          encType="multipart/form-data"
          className="grid gap-4 md:grid-cols-6"
        >
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-brand-text">
              اسم المنتج
            </span>
            <input
              name="name"
              required
              className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
            />
          </label>
          <Combobox
            name="category"
            label="التصنيف"
            options={categoryNames}
            wrapperClassName="md:col-span-2"
            inputClassName="h-10 px-3 text-sm"
            placeholder="اكتب للبحث في التصنيفات"
            required
          />
          <label className="space-y-1">
            <span className="text-sm font-medium text-brand-text">السعر</span>
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-brand-text">الترتيب</span>
            <input
              name="essential_sort_order"
              type="number"
              step="1"
              className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
            />
          </label>
          <label className="space-y-1 md:col-span-3">
            <span className="text-sm font-medium text-brand-text">
              رفع صورة
            </span>
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="block h-10 w-full rounded-md border border-brand-border bg-white px-3 py-1.5 text-sm text-brand-text file:ms-3 file:rounded-md file:border-0 file:bg-brand-primary file:px-3 file:py-1 file:text-sm file:font-semibold file:text-white"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-brand-text">
              رابط الصورة
            </span>
            <input
              name="image_url"
              className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              إضافة
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-lg font-bold text-brand-text">
            اختيار من كتالوج السوبر ماركت
          </h2>
          <p className="text-sm text-brand-muted">
            يعرض هذا القسم المنتجات غير المضافة بعد إلى الأساسيات. إجمالي
            النتائج الحالية: {candidatesMeta.total}
          </p>
        </div>

        <form
          method="GET"
          action="/admin/supermarket-essentials"
          className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <label className="w-full space-y-1 sm:max-w-sm">
            <span className="text-sm font-medium text-brand-text">
              بحث في الكتالوج
            </span>
            <input
              name="candidateSearch"
              defaultValue={candidateSearch}
              className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
              placeholder="اسم منتج موجود"
            />
          </label>
          <input
            type="hidden"
            name="candidateCategory"
            value={candidateCategory || ""}
          />
          <input type="hidden" name="search" value={search || ""} />
          <input type="hidden" name="category" value={category || ""} />
          <Button type="submit">بحث</Button>
        </form>

        <CategoryTabs
          categories={categories}
          activeCategory={candidateCategory}
          search={search}
          category={category}
          candidateSearch={candidateSearch}
        />

        <CandidateTable candidates={candidates} />

        <CandidatePagination
          page={candidatesMeta.page}
          totalPages={candidatesMeta.totalPages}
          total={candidatesMeta.total}
          limit={candidatesMeta.limit}
          params={{ search, category, candidateSearch, candidateCategory }}
        />
      </Card>

      <Card className="overflow-hidden p-4 sm:p-6">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-brand-text">
              المنتجات الأساسية المختارة
            </h2>
            <p className="text-sm text-brand-muted">
              هذه هي المنتجات التي ستظهر في التشكيلة الأساسية. العدد الحالي:
              {" "}
              {essentialsMeta.total}
            </p>
          </div>

          <form
            method="GET"
            action="/admin/supermarket-essentials"
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <label className="w-full space-y-1 sm:w-1/3">
              <span className="text-sm font-medium text-brand-text">
                اسم المنتج
              </span>
              <input
                name="search"
                defaultValue={search}
                className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
                placeholder="ابحث في الأساسيات"
              />
            </label>
            <Combobox
              name="category"
              label="التصنيف"
              options={categoryNames}
              defaultValue={category || ""}
              wrapperClassName="sm:w-1/3"
              inputClassName="h-10 px-3 text-sm"
              placeholder="اكتب للبحث في التصنيفات"
            />
            <input
              type="hidden"
              name="candidateSearch"
              value={candidateSearch || ""}
            />
            <input
              type="hidden"
              name="candidateCategory"
              value={candidateCategory || ""}
            />
            <Button type="submit">بحث</Button>
          </form>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-brand-border">
              <thead className="bg-brand-soft">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
                    المنتج
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
                    السعر
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
                    التصنيف
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
                    الترتيب
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
                    الحالة
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
                    تعديل
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border bg-white">
                {essentials.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      لا توجد منتجات أساسية مختارة
                    </td>
                  </tr>
                ) : (
                  essentials.map((item) => (
                    <EssentialRow key={item.id} item={item} categoryNames={categoryNames} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <AdminPagination
            basePath="/admin/supermarket-essentials"
            page={essentialsMeta.page}
            totalPages={essentialsMeta.totalPages}
            total={essentialsMeta.total}
            limit={essentialsMeta.limit}
            params={{ search, category, candidateSearch, candidateCategory }}
          />
        </div>
      </Card>
    </div>
  );
}

function CategoryTabs({
  categories,
  activeCategory,
  search,
  category,
  candidateSearch,
}: {
  categories: AdminCatalogCategory[];
  activeCategory?: string;
  search?: string;
  category?: string;
  candidateSearch?: string;
}) {
  const totalCount = categories.reduce((sum, item) => sum + item.count, 0);
  const commonParams = {
    search,
    category,
    candidateSearch,
  };

  return (
    <ScrollableTabList className="mb-4 mt-2">
      <TabButton
        href={buildUrl({ ...commonParams, candidatePage: 1 })}
        variant="pill"
        isActive={!activeCategory}
        className="rounded-2xl"
      >
        <span>الكل</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
          {totalCount}
        </span>
      </TabButton>
      {categories.map((item) => (
        <TabButton
          key={item.category}
          href={buildUrl({
            ...commonParams,
            candidateCategory: item.category,
            candidatePage: 1,
          })}
          variant="pill"
          isActive={activeCategory === item.category}
          className="rounded-2xl"
        >
          <span className="flex items-center gap-2">
            <SafeImage
              src={resolveImageUrl(item.image_url)}
              alt={item.category}
              width={32}
              height={32}
              sizes="32px"
              loading="lazy"
              quality={70}
              imageClassName="h-8 w-8 rounded object-cover ring-1 ring-gray-200"
              fallback={
                <span className="flex h-8 w-8 items-center justify-center rounded bg-gray-100 text-xs">
                  🛒
                </span>
              }
            />
            <span>{item.category}</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
              {item.count}
            </span>
          </span>
        </TabButton>
      ))}
    </ScrollableTabList>
  );
}

function CandidateTable({ candidates }: { candidates: AdminCatalogItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-brand-border">
        <thead className="bg-brand-soft">
          <tr>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
              المنتج
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
              التصنيف
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
              السعر
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-brand-text">
              إجراء
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-border bg-white">
          {candidates.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-6 text-center text-sm text-gray-500"
              >
                لا توجد نتائج متاحة
              </td>
            </tr>
          ) : (
            candidates.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-sm font-medium text-brand-text">
                  <div className="flex items-center gap-3">
                    <SafeImage
                      src={resolveImageUrl(item.image_url)}
                      alt={item.name}
                      width={44}
                      height={44}
                      sizes="44px"
                      loading="lazy"
                      quality={70}
                      imageClassName="h-11 w-11 rounded-lg border border-gray-200 object-cover"
                      fallback={
                        <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-[10px] text-gray-500">
                          صورة
                        </span>
                      }
                    />
                    <span>{item.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-brand-text">
                  {item.category}
                </td>
                <td className="px-4 py-3 text-sm text-brand-text">
                  {formatPrice(item.price) || "-"}
                </td>
                <td className="px-4 py-3">
                  <form action={adminMarkCatalogItemEssentialAction}>
                    <input
                      type="hidden"
                      name="catalog_item_id"
                      value={item.id}
                    />
                    <Button type="submit" size="sm" variant="outline">
                      جعله أساسي
                    </Button>
                  </form>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function CandidatePagination({
  page,
  totalPages,
  total,
  limit,
  params,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  params: Record<string, string | undefined>;
}) {
  const safeTotalPages = Math.max(1, totalPages);
  const hasPrevious = page > 1;
  const hasNext = page < safeTotalPages;
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const hrefForPage = (nextPage: number) =>
    buildUrl({ ...params, candidatePage: nextPage });
  const controlClass =
    "inline-flex h-10 items-center rounded-md border border-brand-border px-4 text-sm font-medium transition-colors";
  const activeClass = "bg-white text-brand-text hover:bg-brand-soft";
  const disabledClass = "cursor-not-allowed bg-gray-50 text-gray-400";

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-brand-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-gray-600">
        عرض {start} - {end} من {total}
      </p>
      <div className="flex items-center gap-2">
        {hasPrevious ? (
          <Link
            href={hrefForPage(page - 1)}
            className={`${controlClass} ${activeClass}`}
          >
            السابق
          </Link>
        ) : (
          <span className={`${controlClass} ${disabledClass}`}>السابق</span>
        )}
        <span className="min-w-24 text-center text-sm font-medium text-brand-text">
          {page} / {safeTotalPages}
        </span>
        {hasNext ? (
          <Link
            href={hrefForPage(page + 1)}
            className={`${controlClass} ${activeClass}`}
          >
            التالي
          </Link>
        ) : (
          <span className={`${controlClass} ${disabledClass}`}>التالي</span>
        )}
      </div>
    </div>
  );
}

function EssentialRow({ item, categoryNames }: { item: AdminCatalogItem; categoryNames: string[] }) {
  return (
    <tr>
      <td className="px-4 py-3 text-sm font-medium text-brand-text">
        {item.name}
      </td>
      <td className="px-4 py-3 text-sm text-brand-text">
        {formatPrice(item.price) || "-"}
      </td>
      <td className="px-4 py-3 text-sm text-brand-text">{item.category}</td>
      <td className="px-4 py-3 text-sm text-brand-text">
        {item.essential_sort_order ?? "-"}
      </td>
      <td className="px-4 py-3 text-sm">
        <span
          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
            item.is_active
              ? "bg-status-success/20 text-status-success"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          {item.is_active ? "نشط" : "غير نشط"}
        </span>
      </td>
      <td className="min-w-[820px] px-4 py-3 text-sm">
        <div className="flex gap-2">
          <form
            action={adminUpdateSupermarketEssentialAction.bind(null, item.id)}
            encType="multipart/form-data"
            className="grid flex-1 grid-cols-9 items-end gap-2"
          >
            <label className="col-span-2 space-y-1">
              <span className="text-xs font-medium text-brand-text">الاسم</span>
              <input
                name="name"
                required
                defaultValue={item.name}
                className="h-9 w-full rounded-md border border-brand-border px-2 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-brand-text">السعر</span>
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                defaultValue={formatPrice(item.price)}
                className="h-9 w-full rounded-md border border-brand-border px-2 text-xs"
              />
            </label>
            <Combobox
              name="category"
              label="التصنيف"
              options={categoryNames}
              required
              defaultValue={item.category}
              wrapperClassName="space-y-1"
              labelClassName="text-xs"
              inputClassName="h-9 px-2 text-xs"
              placeholder="اكتب للبحث في التصنيفات"
            />
            <label className="space-y-1">
              <span className="text-xs font-medium text-brand-text">الترتيب</span>
              <input
                name="essential_sort_order"
                type="number"
                step="1"
                defaultValue={item.essential_sort_order ?? ""}
                className="h-9 w-full rounded-md border border-brand-border px-2 text-xs"
              />
            </label>
            <label className="col-span-2 space-y-1">
              <span className="text-xs font-medium text-brand-text">
                رفع صورة
              </span>
              <input
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="h-9 w-full rounded-md border border-brand-border bg-white px-2 py-1 text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-brand-text">
                رابط الصورة
              </span>
              <input
                name="image_url"
                defaultValue={item.image_url || ""}
                className="h-9 w-full rounded-md border border-brand-border px-2 text-xs"
              />
            </label>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1 text-xs font-medium text-brand-text">
                <input
                  name="is_active"
                  type="checkbox"
                  defaultChecked={item.is_active}
                  className="h-4 w-4 accent-brand-primary"
                />
                نشط
              </label>
              <Button type="submit" size="sm">
                حفظ
              </Button>
            </div>
          </form>
          <form action={adminDeleteSupermarketEssentialAction.bind(null, item.id)}>
            <Button type="submit" size="sm" variant="destructive">
              إزالة
            </Button>
          </form>
        </div>
      </td>
    </tr>
  );
}
