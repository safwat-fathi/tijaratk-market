"use client";

import { useState } from "react";
import { AdminDirectoryArea } from "@/services/api/admin.service";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import {
  createDirectoryAreaAction,
  updateDirectoryAreaAction,
  deleteDirectoryAreaAction,
} from "@/actions/admin-server";

type AreasManagerProps = {
  initialAreas: AdminDirectoryArea[];
};

export default function AreasManager({ initialAreas }: AreasManagerProps) {
  const [areas, setAreas] = useState(initialAreas);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<AdminDirectoryArea | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleOpenModal = (area?: AdminDirectoryArea) => {
    setEditingArea(area || null);
    setIsModalOpen(true);
    setError("");
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingArea(null);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const payload = {
      name_ar: formData.get("name_ar") as string,
      name_en: formData.get("name_en") as string,
      slug: formData.get("slug") as string,
      city: formData.get("city") as string,
      governorate: formData.get("governorate") as string,
      is_active: formData.get("is_active") === "on",
    };

    try {
      if (editingArea) {
        await updateDirectoryAreaAction(editingArea.id, payload);
        // The action revalidates the path, but we also update local state for immediate feedback
        setAreas(
          areas.map((a) =>
            a.id === editingArea.id ? { ...a, ...payload } : a,
          ),
        );
      } else {
        await createDirectoryAreaAction(payload);
        window.location.reload();
      }
      handleCloseModal();
    } catch (err: any) {
      setError(err.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذه المنطقة؟")) return;
    setLoading(true);
    setError("");
    try {
      await deleteDirectoryAreaAction(id);
      setAreas(areas.filter((a) => a.id !== id));
    } catch (err: any) {
      setError(err.message || "تعذر حذف المنطقة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => handleOpenModal()} disabled={loading}>
          إضافة منطقة جديدة
        </Button>
      </div>
      
      {!isModalOpen && error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الاسم (عربي)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الاسم (إنجليزي)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الرابط (Slug)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المدينة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المحافظة
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
              {areas.map((area) => (
                <tr key={area.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {area.name_ar}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {area.name_en || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {area.slug}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {area.city || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {area.governorate || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${area.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                    >
                      {area.is_active ? "مفعلة" : "معطلة"}
                    </span>
                  </td>
                  <td className="flex  gap-2 px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 space-x-reverse">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenModal(area)}
                      disabled={loading}
                    >
                      تعديل
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 border-red-200"
                      onClick={() => handleDelete(area.id)}
                      disabled={loading}
                    >
                      حذف
                    </Button>
                  </td>
                </tr>
              ))}
              {areas.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-sm text-gray-500"
                  >
                    لا توجد مناطق.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold">
                {editingArea ? "تعديل منطقة" : "إضافة منطقة جديدة"}
              </h2>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-6 overflow-y-auto flex-1"
            >
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <Field label="الاسم (عربي) *" htmlFor="name_ar">
                  <Input
                    id="name_ar"
                    name="name_ar"
                    defaultValue={editingArea?.name_ar}
                    required
                  />
                </Field>
                <Field label="الاسم (إنجليزي) *" htmlFor="name_en">
                  <Input
                    id="name_en"
                    name="name_en"
                    defaultValue={editingArea?.name_en || ""}
                    required
                  />
                </Field>
                <Field label="الرابط (Slug) *" htmlFor="slug">
                  <Input
                    id="slug"
                    name="slug"
                    defaultValue={editingArea?.slug}
                    required
                    dir="ltr"
                  />
                </Field>
                <Field label="المدينة *" htmlFor="city">
                  <Input
                    id="city"
                    name="city"
                    defaultValue={editingArea?.city || ""}
                    required
                  />
                </Field>
                <Field label="المحافظة *" htmlFor="governorate">
                  <Input
                    id="governorate"
                    name="governorate"
                    defaultValue={editingArea?.governorate || ""}
                    required
                  />
                </Field>

                <div className="flex items-center gap-2 mt-4">
                  <input
                    type="checkbox"
                    id="is_active"
                    name="is_active"
                    defaultChecked={editingArea ? editingArea.is_active : true}
                    className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                  />
                  <label
                    htmlFor="is_active"
                    className="text-sm font-medium text-gray-700"
                  >
                    تفعيل المنطقة
                  </label>
                </div>
              </div>

              <div className="mt-8 flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseModal}
                  disabled={loading}
                >
                  إلغاء
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "جاري الحفظ..." : "حفظ"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
