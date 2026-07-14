import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { adminService } from "@/services/api/admin.service";
import type {
  AdminAuditLog,
  AdminAuditOutcome,
} from "@/types/models/admin-audit-log";
import type { AdminRole } from "@/types/models/activity-log";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "سجل نشاط الإدارة",
  description: "سجل تدقيق إجراءات مسؤولي منصة تجارتك",
};

type AuditSearchParams = {
  admin_id?: string;
  role?: string;
  tenant_id?: string;
  action?: string;
  outcome?: string;
  from?: string;
  to?: string;
  cursor?: string;
};

const roleLabels: Record<AdminRole, string> = {
  platform_admin: "مسؤول المنصة",
  operations_admin: "مسؤول العمليات",
};

const outcomeLabels: Record<AdminAuditOutcome, string> = {
  success: "ناجح",
  denied: "مرفوض",
};

const toPositiveInteger = (value?: string) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const toRole = (value?: string): AdminRole | undefined =>
  value === "platform_admin" || value === "operations_admin"
    ? value
    : undefined;

const toOutcome = (value?: string): AdminAuditOutcome | undefined =>
  value === "success" || value === "denied" ? value : undefined;

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const AuditItem = ({ item }: { item: AdminAuditLog }) => {
  const roleLabel = item.actor.role ? roleLabels[item.actor.role] : null;
  const denied = item.outcome === "denied";

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">{item.title}</h2>
          <p className="mt-1 text-sm text-gray-500" dir="ltr">
            {item.action}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            denied
              ? "bg-red-100 text-red-700"
              : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {outcomeLabels[item.outcome]}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-600">
        <span>
          بواسطة {item.actor.name || "غير معروف"}
          {roleLabel ? ` · ${roleLabel}` : ""}
        </span>
        {item.tenant ? <span>المتجر: {item.tenant.name}</span> : null}
        {item.entity_type ? (
          <span dir="ltr">
            {item.entity_type}
            {item.entity_id ? ` #${item.entity_id}` : ""}
          </span>
        ) : null}
        <time dateTime={item.created_at}>{formatDateTime(item.created_at)}</time>
      </div>

      {item.request_id || item.ip_address ? (
        <div
          className="mt-2 flex flex-wrap gap-x-3 text-xs text-gray-400"
          dir="ltr"
        >
          {item.request_id ? <span>request: {item.request_id}</span> : null}
          {item.ip_address ? <span>ip: {item.ip_address}</span> : null}
        </div>
      ) : null}
    </Card>
  );
};

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<AuditSearchParams>;
}) {
  const query = await searchParams;
  const profile = await adminService.getCurrentAdmin();
  if (!profile.success || !profile.data) redirect("/admin/login");
  if (profile.data.role !== "platform_admin") redirect("/admin/merchants");

  const response = await adminService.getAdminActivityLogs({
    admin_id: toPositiveInteger(query.admin_id),
    role: toRole(query.role),
    tenant_id: toPositiveInteger(query.tenant_id),
    action: query.action?.trim() || undefined,
    outcome: toOutcome(query.outcome),
    from: query.from || undefined,
    to: query.to || undefined,
    cursor: toPositiveInteger(query.cursor),
    limit: 50,
  });
  const items = response.success ? response.data?.items || [] : [];
  const nextCursor = response.success ? response.data?.next_cursor : null;
  const nextParams = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value && key !== "cursor") nextParams.set(key, value);
  });
  if (nextCursor) nextParams.set("cursor", String(nextCursor));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">سجل نشاط الإدارة</h1>
        <p className="mt-1 text-sm text-gray-500">
          يعرض إجراءات الإدارة وهوية المسؤول ودوره وقت تنفيذ الإجراء.
        </p>
      </div>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-4" method="get">
          <input
            name="admin_id"
            inputMode="numeric"
            defaultValue={query.admin_id}
            placeholder="رقم المسؤول"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="tenant_id"
            inputMode="numeric"
            defaultValue={query.tenant_id}
            placeholder="رقم المتجر"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            name="role"
            defaultValue={query.role || ""}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">كل الأدوار</option>
            <option value="platform_admin">مسؤول المنصة</option>
            <option value="operations_admin">مسؤول العمليات</option>
          </select>
          <select
            name="outcome"
            defaultValue={query.outcome || ""}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">كل النتائج</option>
            <option value="success">ناجح</option>
            <option value="denied">مرفوض</option>
          </select>
          <input
            name="action"
            defaultValue={query.action}
            placeholder="نوع الإجراء"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-2"
          />
          <input
            name="from"
            type="datetime-local"
            defaultValue={query.from}
            aria-label="من تاريخ"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="to"
            type="datetime-local"
            defaultValue={query.to}
            aria-label="إلى تاريخ"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2 md:col-span-4">
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              تطبيق الفلاتر
            </button>
            <Link
              href="/admin/activity"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
            >
              مسح
            </Link>
          </div>
        </form>
      </Card>

      <div className="space-y-3">
        {items.length > 0 ? (
          items.map((item) => <AuditItem key={item.id} item={item} />)
        ) : (
          <Card className="p-5 text-sm text-gray-500">
            لا توجد أحداث مطابقة.
          </Card>
        )}
      </div>

      {nextCursor ? (
        <Link
          href={`/admin/activity?${nextParams.toString()}`}
          className="inline-flex rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
        >
          عرض أحداث أقدم
        </Link>
      ) : null}
    </div>
  );
}
