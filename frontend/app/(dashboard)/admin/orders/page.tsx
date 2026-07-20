import {
  adminService,
  type AdminOrder,
  type AdminOrdersFilters,
} from "@/services/api/admin.service";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { statusLabels } from "@/components/ui/StatusBadge";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import { OrderStatus } from "@/types/enums";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPagination } from "../_components/AdminPagination";
import { AdminOrderRow } from "./_components/AdminOrderRow";

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

type ApiListPayload<T> = T[] | { data?: T[]; meta?: PaginationMeta };

const DEFAULT_PAGE_SIZE = 20;
const ORDER_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ar-EG", {
  dateStyle: "medium",
  timeStyle: "short",
});
const ORDER_TOTAL_FORMATTER = new Intl.NumberFormat("ar-EG", {
  style: "currency",
  currency: "EGP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const ORDER_STATUSES = Object.values(OrderStatus);

function getStringParam(value: string | string[] | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getFilterError(filters: AdminOrdersFilters) {
  if (filters.from && filters.to && filters.from > filters.to) {
    return "يجب أن يكون تاريخ البداية قبل تاريخ النهاية أو مساويًا له.";
  }

  const minTotal = filters.minTotal ? Number(filters.minTotal) : undefined;
  const maxTotal = filters.maxTotal ? Number(filters.maxTotal) : undefined;
  if (
    minTotal !== undefined &&
    maxTotal !== undefined &&
    Number.isFinite(minTotal) &&
    Number.isFinite(maxTotal) &&
    minTotal > maxTotal
  ) {
    return "يجب ألا يزيد الحد الأدنى للإجمالي عن الحد الأقصى.";
  }

  return undefined;
}

function parsePositiveInteger(
  value: string | string[] | undefined,
  fallback: number,
) {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default async function AdminOrdersPage(props: Props) {
  const searchParams = await props.searchParams;
  const statusParam = getStringParam(searchParams.status);
  const filters: AdminOrdersFilters = {
    search: getStringParam(searchParams.search),
    storeName: getStringParam(searchParams.storeName),
    status: ORDER_STATUSES.includes(statusParam as OrderStatus)
      ? statusParam
      : undefined,
    from: getStringParam(searchParams.from),
    to: getStringParam(searchParams.to),
    minTotal: getStringParam(searchParams.minTotal),
    maxTotal: getStringParam(searchParams.maxTotal),
  };
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const filterError = getFilterError(filters);
  const page = parsePositiveInteger(searchParams.page, 1);
  const limit = parsePositiveInteger(searchParams.limit, DEFAULT_PAGE_SIZE);

  let orders: AdminOrder[] = [];
  let meta: PaginationMeta = {
    page,
    limit,
    total: 0,
    totalPages: 1,
  };

  try {
    if (!filterError) {
      const response = await adminService.getOrders(filters, page, limit);
      if (response.success && response.data) {
        const payload = response.data as ApiListPayload<AdminOrder>;
        orders = Array.isArray(payload) ? payload : payload.data || [];
        if (!Array.isArray(payload) && payload.meta) {
          meta = payload.meta;
        }
      } else if (!response.success && response.message === "Unauthorized") {
        redirect("/admin/login");
      }
    }
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Failed to fetch orders:", error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text">الطلبات</h1>
        <p className="mt-1 text-sm text-gray-500">
          ابحث وفلتر جميع طلبات المتاجر من مكان واحد.
        </p>
      </div>

      <Card className="p-4 sm:p-6 overflow-hidden">
        <div className="space-y-4">
          <form
            method="GET"
            action="/admin/orders"
            className="space-y-4"
          >
            <fieldset className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <legend className="sr-only">فلاتر الطلبات</legend>

              <div className="space-y-1 xl:col-span-2">
                <label
                  htmlFor="orders-search"
                  className="text-sm font-medium text-brand-text"
                >
                  البحث
                </label>
                <input
                  id="orders-search"
                  type="search"
                  name="search"
                  defaultValue={filters.search}
                  aria-describedby="orders-search-help"
                  className="h-11 w-full rounded-md border border-brand-border px-3 text-sm focus:brand-focus"
                  placeholder="رقم الطلب أو اسم العميل أو رقم الهاتف"
                />
                <p id="orders-search-help" className="text-xs text-gray-500">
                  يمكنك كتابة رقم الطلب مع أو بدون علامة #.
                </p>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="store-name"
                  className="text-sm font-medium text-brand-text"
                >
                  المتجر
                </label>
                <input
                  id="store-name"
                  type="search"
                  name="storeName"
                  defaultValue={filters.storeName}
                  className="h-11 w-full rounded-md border border-brand-border px-3 text-sm focus:brand-focus"
                  placeholder="ابحث باسم المتجر"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="order-status"
                  className="text-sm font-medium text-brand-text"
                >
                  الحالة
                </label>
                <select
                  id="order-status"
                  name="status"
                  defaultValue={filters.status || ""}
                  className="h-11 w-full rounded-md border border-brand-border bg-white px-3 text-sm focus:brand-focus"
                >
                  <option value="">كل الحالات</option>
                  {ORDER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="orders-from"
                  className="text-sm font-medium text-brand-text"
                >
                  من تاريخ
                </label>
                <input
                  id="orders-from"
                  type="date"
                  name="from"
                  defaultValue={filters.from}
                  max={filters.to}
                  className="h-11 w-full rounded-md border border-brand-border px-3 text-sm focus:brand-focus"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="orders-to"
                  className="text-sm font-medium text-brand-text"
                >
                  إلى تاريخ
                </label>
                <input
                  id="orders-to"
                  type="date"
                  name="to"
                  defaultValue={filters.to}
                  min={filters.from}
                  className="h-11 w-full rounded-md border border-brand-border px-3 text-sm focus:brand-focus"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="minimum-total"
                  className="text-sm font-medium text-brand-text"
                >
                  الحد الأدنى للإجمالي
                </label>
                <input
                  id="minimum-total"
                  type="number"
                  name="minTotal"
                  min="0"
                  step="0.01"
                  defaultValue={filters.minTotal}
                  className="h-11 w-full rounded-md border border-brand-border px-3 text-sm focus:brand-focus"
                  placeholder="مثال: 100"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="maximum-total"
                  className="text-sm font-medium text-brand-text"
                >
                  الحد الأقصى للإجمالي
                </label>
                <input
                  id="maximum-total"
                  type="number"
                  name="maxTotal"
                  min="0"
                  step="0.01"
                  defaultValue={filters.maxTotal}
                  className="h-11 w-full rounded-md border border-brand-border px-3 text-sm focus:brand-focus"
                  placeholder="مثال: 1000"
                />
              </div>
            </fieldset>

            {filterError ? (
              <p role="alert" className="text-sm font-medium text-red-700">
                {filterError}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="w-full sm:w-auto"
              >
                تطبيق الفلاتر
              </Button>
              <Link
                href="/admin/orders"
                aria-disabled={!hasActiveFilters}
                className={`inline-flex min-h-10 w-full items-center justify-center rounded-md border px-4 text-sm font-semibold transition-colors sm:w-auto ${
                  hasActiveFilters
                    ? "border-brand-border bg-white text-brand-text hover:bg-brand-soft"
                    : "pointer-events-none border-gray-200 bg-gray-50 text-gray-400"
                }`}
              >
                إعادة ضبط
              </Link>
            </div>
          </form>

          <div className="mt-6 hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-brand-border">
              <thead className="bg-brand-soft">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-brand-text uppercase">
                    رقم الطلب
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-brand-text uppercase">
                    العميل
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-brand-text uppercase">
                    المتجر
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-brand-text uppercase">
                    التاريخ والوقت
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-brand-text uppercase">
                    التكلفة
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-brand-text uppercase">
                    الحالة
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-brand-border">
                {orders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-sm text-gray-500"
                    >
                      لا توجد طلبات
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const tenantId = order.tenant?.id ?? order.tenant_id;
                    const tenantName =
                      order.tenant?.name ||
                      (tenantId ? `متجر #${tenantId}` : "-");
                    return (
                      <AdminOrderRow
                        key={order.id}
                        order={order}
                        tenantId={tenantId}
                        tenantName={tenantName}
                        formattedDate={ORDER_DATE_TIME_FORMATTER.format(new Date(order.created_at))}
                        formattedTotal={ORDER_TOTAL_FORMATTER.format(Number(order.total || 0))}
                        layout="desktop"
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 space-y-3 md:hidden">
            {orders.length === 0 ? (
              <div className="rounded-xl border border-brand-border bg-white px-6 py-10 text-center text-sm text-gray-500">
                لا توجد طلبات
              </div>
            ) : (
              orders.map((order) => {
                const tenantId = order.tenant?.id ?? order.tenant_id;
                const tenantName =
                  order.tenant?.name || (tenantId ? `متجر #${tenantId}` : "-");

                return (
                  <AdminOrderRow
                    key={order.id}
                    order={order}
                    tenantId={tenantId}
                    tenantName={tenantName}
                    formattedDate={ORDER_DATE_TIME_FORMATTER.format(new Date(order.created_at))}
                    formattedTotal={ORDER_TOTAL_FORMATTER.format(Number(order.total || 0))}
                    layout="mobile"
                  />
                );
              })
            )}
          </div>

          <AdminPagination
            basePath="/admin/orders"
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={meta.limit}
            params={{
              search: filters.search,
              storeName: filters.storeName,
              status: filters.status,
              from: filters.from,
              to: filters.to,
              minTotal: filters.minTotal,
              maxTotal: filters.maxTotal,
            }}
          />
        </div>
      </Card>
    </div>
  );
}
