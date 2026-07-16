import { adminService } from "@/services/api/admin.service";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPagination } from "../_components/AdminPagination";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

type AdminOrder = {
  id: number;
  tenant_id?: number;
  tenant?: {
    id: number;
    name?: string | null;
  } | null;
  customer_name?: string | null;
  created_at: string | Date;
  total?: number | string | null;
  status?: string | null;
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
  const clientName =
    typeof searchParams.clientName === "string"
      ? searchParams.clientName
      : undefined;
  const totalCost =
    typeof searchParams.totalCost === "string"
      ? searchParams.totalCost
      : undefined;
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
    const response = await adminService.getOrders(
      clientName,
      totalCost,
      page,
      limit,
    );
    if (response.success && response.data) {
      const payload = response.data as ApiListPayload<AdminOrder>;
      orders = Array.isArray(payload) ? payload : payload.data || [];
      if (!Array.isArray(payload) && payload.meta) {
        meta = payload.meta;
      }
    } else if (!response.success && response.message === "Unauthorized") {
      redirect("/admin/login");
    }
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Failed to fetch orders:", error);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-text">الطلبات المكتملة</h1>

      <Card className="p-4 sm:p-6 overflow-hidden">
        <div className="space-y-4">
          <form
            method="GET"
            action="/admin/orders"
            className="flex flex-col sm:flex-row gap-4 items-end"
          >
            <div className="w-full sm:w-1/3 space-y-1">
              <label className="text-sm font-medium text-brand-text">
                اسم العميل
              </label>
              <input
                type="text"
                name="clientName"
                defaultValue={clientName}
                className="w-full h-10 px-3 rounded-md border border-brand-border focus:brand-focus text-sm"
                placeholder="ابحث باسم العميل"
              />
            </div>
            <div className="w-full sm:w-1/3 space-y-1">
              <label className="text-sm font-medium text-brand-text">
                التكلفة الإجمالية
              </label>
              <input
                type="number"
                name="totalCost"
                defaultValue={totalCost}
                className="w-full h-10 px-3 rounded-md border border-brand-border focus:brand-focus text-sm"
                placeholder="مثال: 500"
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
                    const createdAt = new Date(order.created_at);

                    return (
                      <tr key={order.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-text">
                          #{order.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">
                          {order.customer_name || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">
                          {tenantId ? (
                            <Link
                              href={`/admin/merchants/${tenantId}`}
                              className="text-brand-primary hover:underline"
                            >
                              {tenantName}
                            </Link>
                          ) : (
                            tenantName
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">
                          <time dateTime={createdAt.toISOString()}>
                            {ORDER_DATE_TIME_FORMATTER.format(createdAt)}
                          </time>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-text">
                          {order.total} EGP
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              order.status === "completed"
                                ? "bg-status-success/20 text-status-success"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <AdminPagination
            basePath="/admin/orders"
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={meta.limit}
            params={{ clientName, totalCost }}
          />
        </div>
      </Card>
    </div>
  );
}
