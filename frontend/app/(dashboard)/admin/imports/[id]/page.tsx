import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { adminService } from "@/services/api/admin.service";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import { CancelImportButton } from "../_components/CancelImportButton";
import { AutoRefresh } from "../_components/AutoRefresh";
import type { ImportRowError, ImportRun, ImportStatus } from "@/types/models/import";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<ImportStatus, string> = {
  pending: "في الانتظار",
  processing: "قيد المعالجة",
  success: "نجح",
  failed: "فشل",
  partial_success: "نجاح جزئي",
  cancelled: "تم الإلغاء",
};

const FORMAT_LABELS: Record<NonNullable<ImportRun["format"]>, string> = {
  talabat: "Talabat",
  chefaa: "Chefaa",
  carrefour: "Carrefour",
};

async function getImportData(id: number): Promise<{
  importRun: ImportRun;
  errors: ImportRowError[];
}> {
  try {
    const [importResponse, errorsResponse] = await Promise.all([
      adminService.getImport(id),
      adminService.getImportErrors(id),
    ]);

    if (!importResponse.success && importResponse.message === "Unauthorized") {
      redirect("/admin/login");
    }

    if (!importResponse.success || !importResponse.data) {
      notFound();
    }

    return {
      importRun: importResponse.data,
      errors: errorsResponse.success && errorsResponse.data ? errorsResponse.data : [],
    };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Failed to fetch import:", error);
    notFound();
  }
}

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export default async function AdminImportDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const importId = Number(id);
  if (!Number.isFinite(importId)) {
    notFound();
  }

  const { importRun, errors } = await getImportData(importId);
  const isPolling = importRun.status === "pending" || importRun.status === "processing";

  return (
    <div className="space-y-6">
      {isPolling ? <AutoRefresh intervalMs={3000} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/imports" className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:text-red-800">
            <ArrowRight className="h-4 w-4" />
            العودة للاستيراد
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            تفاصيل الاستيراد #{importRun.id}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {(importRun.status === "processing" || importRun.status === "pending") ? (
            <CancelImportButton importId={importRun.id} />
          ) : null}
          <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700">
            {STATUS_LABELS[importRun.status] || importRun.status}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-gray-500">تمت المعالجة</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {importRun.processed_rows} / {importRun.total_rows}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">ناجحة</p>
          <p className="mt-2 text-2xl font-bold text-green-700">
            {importRun.success_rows}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">فاشلة</p>
          <p className="mt-2 text-2xl font-bold text-red-700">
            {importRun.failed_rows}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">تم إنشاؤها / تحديثها</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {importRun.created_rows} / {importRun.updated_rows}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-gray-500">تم إنشاؤها</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {importRun.created_rows}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">تم تحديثها</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {importRun.updated_rows}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500">تم تخطيها / تعطيلها</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {importRun.skipped_rows}
          </p>
        </Card>
      </div>

      <Card className="p-6">
        <dl className="grid gap-4 md:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-500">اسم الملف</dt>
            <dd className="mt-1 font-medium text-gray-900">
              {importRun.original_file_name}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">وضع الاستيراد</dt>
            <dd className="mt-1 font-medium text-gray-900">{importRun.mode}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">صيغة الملف</dt>
            <dd className="mt-1 font-medium text-gray-900">
              {importRun.format ? FORMAT_LABELS[importRun.format] : "تلقائي"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">بدأ في</dt>
            <dd className="mt-1 font-medium text-gray-900">
              {formatDate(importRun.started_at)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">انتهى في</dt>
            <dd className="mt-1 font-medium text-gray-900">
              {formatDate(importRun.finished_at)}
            </dd>
          </div>
        </dl>
        {importRun.error_message ? (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {importRun.error_message}
          </p>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">أخطاء الصفوف</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  الصف
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  الخطأ
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  المنتج
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {errors.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">
                    لا توجد أخطاء مسجلة.
                  </td>
                </tr>
              ) : (
                errors.map((error) => (
                  <tr key={error.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {error.row_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-red-700">
                      {error.error_message}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {String(error.row_data.name || "-")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
