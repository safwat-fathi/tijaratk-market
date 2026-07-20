"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import type { AdminDirectoryArea, AdminMissingDeliveryAreaRequest } from "@/services/api/admin.service";
import { resolveMissingDeliveryAreaRequestAction } from "@/actions/admin-server";

export default function MissingDeliveryAreaRequestsManager({ initialRequests, areas }: { initialRequests: AdminMissingDeliveryAreaRequest[]; areas: AdminDirectoryArea[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<"all" | "pending" | "resolved">("pending");
  const [selectedAreas, setSelectedAreas] = useState<Record<number, string>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requests = useMemo(() => status === "all" ? initialRequests : initialRequests.filter((request) => request.status === status), [initialRequests, status]);
  const childAreasByMain = useMemo(() => new Map(initialRequests.map((request) => [request.main_area_id, areas.filter((area) => area.is_active && area.parent_area_id === request.main_area_id)])), [areas, initialRequests]);

  const resolve = async (request: AdminMissingDeliveryAreaRequest) => {
    const areaId = Number(selectedAreas[request.id]);
    if (!areaId) { setError("اختر المنطقة الفرعية التي تمت إضافتها أولاً."); return; }
    setLoadingId(request.id); setError(null);
    try { await resolveMissingDeliveryAreaRequestAction(request.id, areaId); router.refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر حل الطلب."); }
    finally { setLoadingId(null); }
  };

  return <div className="space-y-4">
    <Select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="max-w-xs"><option value="pending">قيد المراجعة</option><option value="resolved">تم الحل</option><option value="all">الكل</option></Select>
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
    {requests.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">لا توجد طلبات بهذه الحالة.</p> : requests.map((request) => {
      const children = childAreasByMain.get(request.main_area_id) ?? [];
      return <article key={request.id} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-gray-900">{request.requested_area_name} <span className="font-normal text-gray-500">ضمن {request.main_area.name_ar}</span></h2><p className="mt-1 text-sm text-gray-600">{request.tenant.name} · {request.tenant.phone}</p></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{request.status === "pending" ? "قيد المراجعة" : "تم الحل"}</span></div>
        {request.note ? <p className="text-sm text-gray-600">ملاحظة: {request.note}</p> : null}
        <p className="text-xs text-gray-500">أُرسل في {new Date(request.created_at).toLocaleDateString("ar-EG")}</p>
        {request.status === "resolved" ? <p className="text-sm font-medium text-emerald-700">تم الربط بـ {request.resolved_area?.name_ar ?? "منطقة فرعية"} بواسطة {request.resolved_by_admin?.name ?? "الإدارة"}.</p> : <div className="flex flex-col gap-2 sm:flex-row"><Select value={selectedAreas[request.id] ?? ""} onChange={(event) => setSelectedAreas((current) => ({ ...current, [request.id]: event.target.value }))}><option value="" disabled>{children.length ? "اختر المنطقة الفرعية المضافة" : "أضف منطقة فرعية أولاً من إدارة المناطق"}</option>{children.map((area) => <option key={area.id} value={area.id}>{area.name_ar}</option>)}</Select><Button type="button" disabled={loadingId === request.id || children.length === 0} onClick={() => resolve(request)}>{loadingId === request.id ? "جارٍ الحفظ..." : "حل الطلب"}</Button></div>}
      </article>;
    })}
  </div>;
}
