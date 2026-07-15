import { adminService } from "@/services/api/admin.service";
import { Card } from "@/components/ui/Card";
import {
  getAdminManagedPermissionLabel,
} from "@/constants/admin-managed-permissions";
import { Button } from "@/components/ui/Button";
import {
  decideTenantApplicationAction,
  toggleTenantStatusAction,
} from "@/actions/admin-server";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import { redirect } from "next/navigation";
import { PlanSelect } from "./_components/PlanSelect";
import { TenantAreaForm } from "./_components/TenantAreaForm";
import { DirectoryStatusForm } from "./_components/DirectoryStatusForm";
import { ExternalLink } from "lucide-react";
import type {
  AdminDirectoryArea,
  AdminPlan,
  AdminTenant,
} from "@/services/api/admin.service";
import { AdminPagination } from "../_components/AdminPagination";
import { AdminMerchantFilters } from "./_components/AdminMerchantFilters";

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

const DEFAULT_PAGE_SIZE = 20;

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

const parseOptionalPositiveInteger = (value: SearchParamValue) => {
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const parseOptionalText = (value: SearchParamValue) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

async function getTenants(
  page: number,
  limit: number,
  search?: string,
  tenantId?: number,
  category?: string,
  status?: string,
  areaId?: number,
) {
  try {
    const response = await adminService.getTenants({
      page,
      limit,
      search,
      tenantId,
      category,
      status,
      areaId,
    });
    if (response.success && response.data) {
      if (Array.isArray(response.data)) {
        return {
          merchants: response.data,
          meta: {
            page,
            limit,
            total: response.data.length,
            totalPages: Math.max(1, Math.ceil(response.data.length / limit)),
          },
        };
      }

      return {
        merchants: response.data.data,
        meta: response.data.meta,
      };
    }
    if (!response.success && response.message === "Unauthorized") {
      redirect("/admin/login");
    }
    return {
      merchants: [],
      meta: emptyMeta(page, limit),
    };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Failed to fetch tenants:", error);
    return {
      merchants: [],
      meta: emptyMeta(page, limit),
    };
  }
}

async function getPlansList() {
  try {
    const response = await adminService.getPlans();
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Failed to fetch plans:", error);
    return [];
  }
}

async function getDirectoryAreas() {
  try {
    const response = await adminService.getDirectoryAreas();
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Failed to fetch directory areas:", error);
    return [];
  }
}

function MerchantStatusBadge({ status }: { status: AdminTenant["status"] }) {
  const labels: Record<AdminTenant["status"], string> = {
    pending: "قيد المراجعة",
    active: "نشط",
    inactive: "غير نشط",
    suspended: "موقوف",
    rejected: "مرفوض",
  };
  const className =
    status === "active"
      ? "bg-green-100 text-green-800"
      : status === "pending"
        ? "bg-amber-100 text-amber-900"
        : status === "rejected"
          ? "bg-rose-100 text-rose-800"
          : status === "inactive"
            ? "bg-gray-100 text-gray-800"
            : "bg-red-100 text-red-800";

  return (
    <span
      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${className}`}
    >
      {labels[status]}
    </span>
  );
}

function CancellationPolicySummary({ merchant }: { merchant: AdminTenant }) {
  const policy = merchant.cancellation_policy;
  if (!policy) {
    return <span className="text-xs text-gray-400">لا توجد بيانات</span>;
  }

  let tone = "border-gray-200 bg-gray-50 text-gray-700";
  if (policy.status === "suspended") {
    tone = "border-red-200 bg-red-50 text-red-800";
  } else if (policy.status === "warning") {
    tone = "border-amber-200 bg-amber-50 text-amber-900";
  }

  return (
    <div
      className={`rounded-md border px-2 py-2 text-xs font-semibold ${tone}`}
    >
      <div>
        إلغاءات: {policy.count} / {policy.suspension_threshold}
      </div>
      <div className="mt-1 font-medium">
        {policy.is_probation ? "تحت المراقبة بعد إعادة التفعيل" : "دورة شهرية"}
      </div>
      {policy.last_event_type ? (
        <div className="mt-1 font-medium text-gray-500">
          آخر حدث: {policy.last_event_type}
        </div>
      ) : null}
    </div>
  );
}

function ToggleTenantStatusForm({ merchant }: { merchant: AdminTenant }) {
  if (merchant.status === "pending") {
    return (
      <div className="flex flex-wrap gap-2">
        <form
          action={decideTenantApplicationAction.bind(
            null,
            merchant.id,
            "active",
          )}
        >
          <Button type="submit" size="sm">
            اعتماد الطلب
          </Button>
        </form>
        <form
          action={decideTenantApplicationAction.bind(
            null,
            merchant.id,
            "rejected",
          )}
        >
          <Button type="submit" variant="outline" size="sm">
            رفض الطلب
          </Button>
        </form>
      </div>
    );
  }

  return (
    <form
      action={toggleTenantStatusAction.bind(null, merchant.id, merchant.status)}
    >
      <Button
        type="submit"
        variant={merchant.status === "active" ? "outline" : "primary"}
        size="sm"
        className="w-full md:w-auto"
      >
        {merchant.status === "active"
          ? "إيقاف"
          : merchant.status === "suspended"
            ? "إعادة تفعيل"
            : merchant.status === "rejected"
              ? "اعتماد الطلب"
              : "تفعيل"}
      </Button>
    </form>
  );
}

export default async function AdminMerchants(props: Props) {
  const profileResponse = await adminService.getCurrentAdmin();
  if (profileResponse.data?.role === "operations_admin") {
    const assignedResponse = await adminService.getAssignedTenants();
    const assignedMerchants = assignedResponse.success && assignedResponse.data
      ? assignedResponse.data
      : [];

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المتاجر المسندة إليك</h1>
          <p className="mt-1 text-sm text-gray-600">
            لا يمكنك إدارة متجر إلا بعد بدء جلسة موثقة من صفحة المتجر.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assignedMerchants.map((merchant) => (
            <Card key={merchant.id} className="space-y-4 p-5">
              <div>
                <h2 className="font-bold text-gray-900">{merchant.name}</h2>
                <p className="text-sm text-gray-500">{merchant.category}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {merchant.access.permissions.map((permission) => (
                  <span
                    key={permission}
                    className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600"
                  >
                    {getAdminManagedPermissionLabel(permission)}
                  </span>
                ))}
              </div>
              <a
                href={`/admin/merchants/${merchant.id}`}
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-brand-primary px-4 text-sm font-semibold text-white hover:bg-brand-primary-hover"
              >
                فتح المتجر
              </a>
            </Card>
          ))}
          {assignedMerchants.length === 0 ? (
            <Card className="p-8 text-center text-sm text-gray-500">
              لم يتم إسناد متاجر إلى حسابك حتى الآن.
            </Card>
          ) : null}
        </div>
      </div>
    );
  }

  const searchParams = await props.searchParams;
  const page = parsePositiveInteger(searchParams.page, 1);
  const limit = parsePositiveInteger(searchParams.limit, DEFAULT_PAGE_SIZE);
  const search = parseOptionalText(searchParams.search);
  const tenantId = parseOptionalPositiveInteger(searchParams.tenantId);
  const category = parseOptionalText(searchParams.category);
  const status = parseOptionalText(searchParams.status);
  const areaId = parseOptionalPositiveInteger(searchParams.areaId);
  const paginationParams = {
    search,
    tenantId: tenantId ? String(tenantId) : undefined,
    category,
    status,
    areaId: areaId ? String(areaId) : undefined,
  };

  const [tenantsData, plans, areas]: [
    { merchants: AdminTenant[]; meta: PaginationMeta },
    AdminPlan[],
    AdminDirectoryArea[],
  ] = await Promise.all([
    getTenants(page, limit, search, tenantId, category, status, areaId),
    getPlansList(),
    getDirectoryAreas(),
  ]);
  const { merchants, meta } = tenantsData;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">إدارة التجار</h1>

      <AdminMerchantFilters areas={areas} />

      <div className="space-y-4 md:hidden">
        {merchants.length === 0 ? (
          <Card className="p-6 text-center text-sm text-gray-500">
            لا يوجد تجار
          </Card>
        ) : (
          merchants.map((merchant) => (
            <Card key={merchant.id} className="space-y-5 p-4">
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-base font-bold text-gray-900">
                      {merchant.name}
                    </h2>
                    <a
                      href={`/${merchant.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 break-all text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      /{merchant.slug}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <MerchantStatusBadge status={merchant.status} />
                </div>
                <p className="break-all text-sm text-gray-600">
                  {merchant.phone}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-gray-50 px-2 py-3">
                  <div className="text-xs font-medium text-gray-500">
                    المنتجات
                  </div>
                  <div className="mt-1 text-sm font-bold text-gray-900">
                    {merchant._count?.products || 0}
                  </div>
                </div>
                <div className="rounded-md bg-gray-50 px-2 py-3">
                  <div className="text-xs font-medium text-gray-500">
                    الطلبات
                  </div>
                  <div className="mt-1 text-sm font-bold text-gray-900">
                    {merchant._count?.orders || 0}
                  </div>
                </div>
                <div className="rounded-md bg-gray-50 px-2 py-3">
                  <div className="text-xs font-medium text-gray-500">
                    العملاء
                  </div>
                  <div className="mt-1 text-sm font-bold text-gray-900">
                    {merchant._count?.customers || 0}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <TenantAreaForm tenant={merchant} areas={areas} />

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-600">
                    حالة الدليل
                  </div>
                  <DirectoryStatusForm tenant={merchant} />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-600">
                    سياسة الإلغاء
                  </div>
                  <CancellationPolicySummary merchant={merchant} />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-600">
                    الباقة
                  </div>
                  <PlanSelect
                    tenantId={merchant.id}
                    currentPlanId={merchant.tenant_subscriptions?.[0]?.plan_id}
                    plans={plans}
                  />
                </div>

                <div className="flex gap-2 items-start flex-wrap">
                  <a
                    href={`/admin/merchants/${merchant.id}`}
                    className="inline-flex min-h-9 items-center rounded-md bg-brand-primary px-3 text-xs font-semibold text-white"
                  >
                    إدارة المتجر
                  </a>
                  <ToggleTenantStatusForm merchant={merchant} />
                </div>
              </div>
            </Card>
          ))
        )}
        <AdminPagination
          basePath="/admin/merchants"
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={meta.limit}
          params={paginationParams}
        />
      </div>

      <Card className="hidden overflow-hidden md:block">
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الاسم
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    رقم الهاتف
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    المنتجات
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الطلبات
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    العملاء
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    المناطق
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    حالة الدليل
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    سياسة الإلغاء
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الباقة
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الحالة
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    إجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {merchants.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-6 py-8 text-center text-sm text-gray-500"
                    >
                      لا يوجد تجار
                    </td>
                  </tr>
                ) : (
                  merchants.map((merchant) => (
                    <tr key={merchant.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {merchant.name}
                        <div className="mt-0.5">
                          <a
                            href={`/${merchant.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            /{merchant.slug}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {merchant.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {merchant._count?.products || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {merchant._count?.orders || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {merchant._count?.customers || 0}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <TenantAreaForm tenant={merchant} areas={areas} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <DirectoryStatusForm tenant={merchant} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <CancellationPolicySummary merchant={merchant} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <PlanSelect
                          tenantId={merchant.id}
                          currentPlanId={
                            merchant.tenant_subscriptions?.[0]?.plan_id
                          }
                          plans={plans}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <MerchantStatusBadge status={merchant.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-start gap-2">
                          <a
                            href={`/admin/merchants/${merchant.id}`}
                            className="inline-flex min-h-9 items-center rounded-md bg-brand-primary px-3 text-xs font-semibold text-white"
                          >
                            إدارة المتجر
                          </a>
                          <ToggleTenantStatusForm merchant={merchant} />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 pb-4">
            <AdminPagination
              basePath="/admin/merchants"
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              limit={meta.limit}
              params={paginationParams}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
