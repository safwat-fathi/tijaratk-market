import { redirect } from "next/navigation";
import { adminService } from "@/services/api/admin.service";
import type { AdminCatalogItem } from "@/services/api/admin.service";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AdminPagination } from "../_components/AdminPagination";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
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

const DEFAULT_PAGE_SIZE = 20;
const CANDIDATE_LIMIT = 10;

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

async function fetchData({
  search,
  category,
  candidateSearch,
  page,
  limit,
}: {
  search?: string;
  category?: string;
  candidateSearch?: string;
  page: number;
  limit: number;
}) {
  const [essentialsResponse, candidatesResponse] = await Promise.all([
    adminService.getSupermarketEssentials({
      search,
      category,
      page,
      limit,
    }),
    adminService.getSupermarketCatalogCandidates({
      search: candidateSearch,
      category,
      page: 1,
      limit: CANDIDATE_LIMIT,
    }),
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
    meta:
      essentialsResponse.success && essentialsResponse.data?.meta
        ? essentialsResponse.data.meta
        : emptyMeta(page, limit),
  };
}

export default async function SupermarketEssentialsPage(props: Props) {
  const searchParams = await props.searchParams;
  const search = getSearchValue(searchParams.search);
  const category = getSearchValue(searchParams.category);
  const candidateSearch = getSearchValue(searchParams.candidateSearch);
  const page = parsePositiveInteger(searchParams.page, 1);
  const limit = parsePositiveInteger(searchParams.limit, DEFAULT_PAGE_SIZE);

  let data: Awaited<ReturnType<typeof fetchData>>;
  try {
    data = await fetchData({
      search,
      category,
      candidateSearch,
      page,
      limit,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Failed to fetch supermarket essentials:", error);
    data = {
      essentials: [],
      candidates: [],
      meta: emptyMeta(page, limit),
    };
  }

  const { essentials, candidates, meta } = data;

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
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-brand-text">التصنيف</span>
            <input
              name="category"
              required
              className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
            />
          </label>
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
          <label className="space-y-1 md:col-span-5">
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
        <h2 className="mb-4 text-lg font-bold text-brand-text">
          اختيار من كتالوج السوبر ماركت
        </h2>
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
          <input type="hidden" name="search" value={search || ""} />
          <input type="hidden" name="category" value={category || ""} />
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
                      {item.name}
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
      </Card>

      <Card className="overflow-hidden p-4 sm:p-6">
        <div className="space-y-4">
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
            <label className="w-full space-y-1 sm:w-1/3">
              <span className="text-sm font-medium text-brand-text">
                التصنيف
              </span>
              <input
                name="category"
                defaultValue={category}
                className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
                placeholder="مثال: أرز ومكرونة"
              />
            </label>
            <input
              type="hidden"
              name="candidateSearch"
              value={candidateSearch || ""}
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
                      لا توجد منتجات أساسية
                    </td>
                  </tr>
                ) : (
                  essentials.map((item) => (
                    <EssentialRow key={item.id} item={item} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <AdminPagination
            basePath="/admin/supermarket-essentials"
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={meta.limit}
            params={{ search, category, candidateSearch }}
          />
        </div>
      </Card>
    </div>
  );
}

function EssentialRow({ item }: { item: AdminCatalogItem }) {
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
      <td className="min-w-[720px] px-4 py-3 text-sm">
        <div className="flex gap-2">
          <form
            action={adminUpdateSupermarketEssentialAction.bind(null, item.id)}
            className="grid flex-1 grid-cols-8 items-end gap-2"
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
            <label className="space-y-1">
              <span className="text-xs font-medium text-brand-text">
                التصنيف
              </span>
              <input
                name="category"
                required
                defaultValue={item.category}
                className="h-9 w-full rounded-md border border-brand-border px-2 text-xs"
              />
            </label>
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
