import Link from "next/link";
import { redirect } from "next/navigation";
import { adminService } from "@/services/api/admin.service";
import type {
  AdminCatalogCategory,
  AdminCatalogItem,
  AdminCatalogSource,
} from "@/services/api/admin.service";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import {
  adminCreateCatalogItemAction,
} from "@/actions/admin-server";
import AdminCatalogItemsBulkClient from "./_components/AdminCatalogItemsBulkClient";

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

const DEFAULT_PAGE_SIZE = 20;
const SUPERMARKET_SOURCE = "talabat_csv";
const PHARMACY_SOURCE = "chefaa_csv";

const SOURCE_TABS: Array<{
  label: string;
  source: AdminCatalogSource;
  description: string;
}> = [
  {
    label: "سوبر ماركت",
    source: SUPERMARKET_SOURCE,
    description: "كتالوج السوبر ماركت المستورد من talabat_csv",
  },
  {
    label: "صيدلية",
    source: PHARMACY_SOURCE,
    description: "كتالوج الصيدليات المستورد من chefaa_csv",
  },
];

const emptyMeta = (page: number, limit: number): PaginationMeta => ({
  page,
  limit,
  total: 0,
  totalPages: 1,
});

const parsePositiveInteger = (
  value: SearchParamValue,
  fallback: number,
) => {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getSearchValue = (value: SearchParamValue) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const parseSource = (value: SearchParamValue): AdminCatalogSource =>
  value === PHARMACY_SOURCE ? PHARMACY_SOURCE : SUPERMARKET_SOURCE;

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
  source,
  search,
  category,
  page,
  limit,
}: {
  source: AdminCatalogSource;
  search?: string;
  category?: string;
  page: number;
  limit: number;
}): Promise<PageData> {
  const [itemsResponse, categoriesResponse] = await Promise.all([
    adminService.getAdminCatalogItems({
      source,
      search,
      category,
      page,
      limit,
    }),
    adminService.getAdminCatalogCategories(source),
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
  const source = parseSource(searchParams.source);
  const search = getSearchValue(searchParams.search);
  const category = getSearchValue(searchParams.category);
  const page = parsePositiveInteger(searchParams.page, 1);
  const limit = parsePositiveInteger(searchParams.limit, DEFAULT_PAGE_SIZE);
  const activeTab = SOURCE_TABS.find((tab) => tab.source === source) || SOURCE_TABS[0];

  let data: PageData;
  try {
    data = await fetchData({ source, search, category, page, limit });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-brand-text">
          عناصر الكتالوج
        </h1>
        <p className="text-sm text-brand-muted">
          إدارة عناصر الكتالوج العالمية حسب نوع المتجر مع عزل مصدر السوبر
          ماركت عن مصدر الصيدليات.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SOURCE_TABS.map((tab) => (
          <Link
            key={tab.source}
            href={buildUrl({ source: tab.source, page: 1, limit })}
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

      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-lg font-bold text-brand-text">
            إضافة عنصر جديد - {activeTab.label}
          </h2>
          <p className="text-sm text-brand-muted">{activeTab.description}</p>
        </div>

        <form
          action={adminCreateCatalogItemAction}
          encType="multipart/form-data"
          className="grid gap-4 md:grid-cols-6"
        >
          <input type="hidden" name="source" value={source} />
          <input type="hidden" name="is_active" value="true" />
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
            <span className="text-sm font-medium text-brand-text">العملة</span>
            <input
              name="currency"
              defaultValue="EGP"
              maxLength={3}
              className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-brand-text">
              رقم خارجي
            </span>
            <input
              name="external_id"
              className="h-10 w-full rounded-md border border-brand-border px-3 text-sm"
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
          <label className="space-y-1 md:col-span-2">
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
          <label className="flex items-end gap-2 pb-2 text-sm font-medium text-brand-text">
            <input
              name="is_essential"
              type="checkbox"
              className="h-4 w-4 rounded border-brand-border"
            />
            أساسي
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
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              إضافة
            </Button>
          </div>
        </form>
      </Card>

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
            <input type="hidden" name="source" value={source} />
            <label className="w-full space-y-1 sm:w-1/3">
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
              wrapperClassName="sm:w-1/3"
              inputClassName="h-10 px-3 text-sm"
              placeholder="اكتب للبحث في التصنيفات"
            />
            <Button type="submit">بحث</Button>
            <Link
              href={buildUrl({ source, page: 1, limit })}
              className="inline-flex h-10 items-center justify-center rounded-md border border-brand-border px-4 text-sm font-semibold text-brand-text transition-colors hover:bg-brand-soft"
            >
              مسح
            </Link>
          </form>

          <AdminCatalogItemsBulkClient
            items={data.items}
            categoryNames={categoryNames}
            meta={data.meta}
            params={{ source, search, category }}
          />
        </div>
      </Card>
    </div>
  );
}
