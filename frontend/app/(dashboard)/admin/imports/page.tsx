import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { uploadCatalogImportAction } from "@/actions/admin-server";
import { adminService } from "@/services/api/admin.service";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import { CancelImportButton } from "./_components/CancelImportButton";
import type { ImportRun, ImportStatus } from "@/types/models/import";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<ImportStatus, string> = {
  pending: "في الانتظار",
  processing: "قيد المعالجة",
  success: "نجح",
  failed: "فشل",
  partial_success: "نجاح جزئي",
  cancelled: "تم الإلغاء",
};

async function getImports(): Promise<ImportRun[]> {
  try {
    const response = await adminService.getImports();
    if (response.success && response.data) {
      return response.data;
    }
    if (!response.success && response.message === "Unauthorized") {
      redirect("/admin/login");
    }
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Failed to fetch imports:", error);
  }

  return [];
}

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export default async function AdminImportsPage() {
  const imports = await getImports();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">استيراد الكتالوج</h1>
        <p className="mt-1 text-sm text-gray-500">
          ارفع ملف CSV من Talabat أو Chefaa أو Carrefour لتحديث منتجات الكتالوج العامة. اختر الصيغة عند رفع ملفات Chefaa لتوجيهها إلى كتالوج الصيدليات.
        </p>
      </div>

      <Card className="p-6">
        <form action={uploadCatalogImportAction} className="space-y-4">
          <input type="hidden" name="type" value="catalog_items" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[1fr_1fr_180px_160px_auto] lg:items-end">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">
                ملف CSV
              </span>
              <input
                required
                type="file"
                name="file"
                accept=".csv,text/csv"
                className="block w-full h-11 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 file:ml-3 file:rounded-md file:border-0 file:bg-gray-900 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-white"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">
                صور المنتجات (اختياري)
              </span>
              <input
                type="file"
                name="images"
                multiple
                accept="image/jpeg,image/png,image/webp,image/heic"
                className="block w-full h-11 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 file:ml-3 file:rounded-md file:border-0 file:bg-gray-900 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-white"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">
                وضع الاستيراد
              </span>
              <select
                name="mode"
                defaultValue="upsert"
                className="block w-full h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
              >
                <option value="upsert">إضافة وتحديث</option>
                <option value="replace_source">استبدال كتالوج المصدر المحدد</option>
                <option value="create_only">إضافة فقط</option>
                <option value="update_only">تحديث فقط</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">
                نوع الكتالوج
              </span>
              <select
                name="catalogType"
                defaultValue="grocery"
                className="block w-full h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
              >
                <option value="grocery">بقالة (سوبر ماركت)</option>
                <option value="pharmacy">صيدلية</option>
              </select>
            </label>

            <Button type="submit" className="h-11">
              رفع وبدء الاستيراد
            </Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">سجل الاستيراد</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  الملف
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  الحالة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  الصفوف
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  التاريخ
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  التفاصيل
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {imports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    لا توجد عمليات استيراد حتى الآن.
                  </td>
                </tr>
              ) : (
                imports.map((importRun) => (
                  <tr key={importRun.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {importRun.original_file_name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {STATUS_LABELS[importRun.status] || importRun.status}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {importRun.processed_rows} / {importRun.total_rows}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {formatDate(importRun.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <div className="flex items-center justify-end gap-3">
                        {(importRun.status === "processing" || importRun.status === "pending") ? (
                          <CancelImportButton importId={importRun.id} />
                        ) : null}
                        <Link
                          href={`/admin/imports/${importRun.id}`}
                          className="font-semibold text-red-700 hover:text-red-800"
                        >
                          عرض
                        </Link>
                      </div>
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
