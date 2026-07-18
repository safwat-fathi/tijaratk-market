"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Loader2,
  Map as MapIcon,
  MapPin,
  Plus,
  X,
} from "lucide-react";
import type {
  AdminDirectoryArea,
  AdminDirectoryAreaPayload,
} from "@/services/api/admin.service";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import Toast from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import {
  createDirectoryAreaAction,
  updateDirectoryAreaAction,
  deleteDirectoryAreaAction,
} from "@/actions/admin-server";

type AreasManagerProps = {
  initialAreas: AdminDirectoryArea[];
  mainAreas: Array<Pick<AdminDirectoryArea, "id" | "name_ar" | "is_active">>;
  page: number;
  hasActiveFilters: boolean;
};

type AreaKind = "main" | "sub";

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export default function AreasManager({
  initialAreas,
  mainAreas,
  page,
  hasActiveFilters,
}: AreasManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<AdminDirectoryArea | null>(
    null,
  );
  const [areaKind, setAreaKind] = useState<AreaKind>("main");
  const [parentAreaId, setParentAreaId] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(
    null,
  );
  const [error, setError] = useState("");
  const [parentError, setParentError] = useState("");
  const [feedback, setFeedback] = useState<{
    id: number;
    message: string;
  } | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const parentSelectRef = useRef<HTMLSelectElement>(null);

  const areaById = useMemo(
    () => new Map(mainAreas.map((area) => [area.id, area])),
    [mainAreas],
  );
  const mainAreaOptions = useMemo(
    () => mainAreas.filter((area) => area.id !== editingArea?.id),
    [mainAreas, editingArea?.id],
  );
  const editingAreaHasChildren = Boolean(
    editingArea && (editingArea.child_count ?? 0) > 0,
  );

  useEffect(() => {
    if (!isModalOpen) return;

    nameInputRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        setIsModalOpen(false);
        setEditingArea(null);
        setError("");
        setParentError("");
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isModalOpen, loading]);

  const handleOpenModal = (area?: AdminDirectoryArea) => {
    setConfirmingDeleteId(null);
    const nextArea = area ?? null;
    setEditingArea(nextArea);
    setAreaKind(nextArea?.parent_area_id ? "sub" : "main");
    setParentAreaId(
      nextArea?.parent_area_id ? String(nextArea.parent_area_id) : "",
    );
    setIsModalOpen(true);
    setError("");
    setParentError("");
  };

  const handleCloseModal = () => {
    if (loading) return;
    setIsModalOpen(false);
    setEditingArea(null);
    setError("");
    setParentError("");
  };

  const handleAreaKindChange = (nextKind: AreaKind) => {
    setAreaKind(nextKind);
    setParentError("");
    if (nextKind === "main") {
      setParentAreaId("");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setParentError("");

    if (areaKind === "sub" && !parentAreaId) {
      setParentError("اختر المنطقة الرئيسية التي تتبع لها هذه المنطقة.");
      parentSelectRef.current?.focus();
      return;
    }

    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const payload: AdminDirectoryAreaPayload = {
      name_ar: String(formData.get("name_ar") ?? "").trim(),
      name_en: String(formData.get("name_en") ?? "").trim(),
      slug: String(formData.get("slug") ?? "").trim(),
      city: String(formData.get("city") ?? "").trim(),
      governorate: String(formData.get("governorate") ?? "").trim(),
      is_active: formData.get("is_active") === "on",
      parent_area_id: areaKind === "main" ? null : Number(parentAreaId),
    };

    try {
      if (editingArea) {
        await updateDirectoryAreaAction(editingArea.id, payload);
        setFeedback({ id: Date.now(), message: "تم تحديث المنطقة بنجاح." });
      } else {
        await createDirectoryAreaAction(payload);
        setFeedback({ id: Date.now(), message: "تمت إضافة المنطقة بنجاح." });
      }
      setIsModalOpen(false);
      setEditingArea(null);
      router.refresh();
    } catch (caughtError: unknown) {
      const message = getErrorMessage(caughtError, "تعذر حفظ المنطقة.");
      setError(message);
      if (
        message.includes("المنطقة الرئيسية") ||
        message.includes("مرتبطة بمناطق فرعية")
      ) {
        setParentError(message);
        parentSelectRef.current?.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setLoading(true);
    setError("");
    try {
      await deleteDirectoryAreaAction(id);
      setFeedback({ id: Date.now(), message: "تم حذف المنطقة بنجاح." });
      setConfirmingDeleteId(null);
      if (initialAreas.length === 1 && page > 1) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", String(page - 1));
        router.replace(`/admin/areas?${params.toString()}`);
      } else {
        router.refresh();
      }
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, "تعذر حذف المنطقة."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {feedback ? (
        <Toast
          key={feedback.id}
          message={feedback.message}
          type="success"
          onClose={() => setFeedback(null)}
        />
      ) : null}

      <div className="mb-4 flex justify-end">
        <Button onClick={() => handleOpenModal()} disabled={loading}>
          <Plus className="h-5 w-5" aria-hidden="true" />
          إضافة منطقة جديدة
        </Button>
      </div>

      {!isModalOpen && error ? (
        <div
          className="mb-4 rounded-md border border-(--status-error)/25 bg-red-50 p-3 text-sm font-medium text-(--status-error)"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  الاسم (عربي)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  التبعية
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  الاسم (إنجليزي)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  الرابط (Slug)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  المدينة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  المحافظة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  الحالة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {initialAreas.map((area) => {
                const parentArea = area.parent_area_id
                  ? areaById.get(area.parent_area_id)
                  : null;

                return (
                  <tr key={area.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {area.name_ar}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {area.parent_area_id === null ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-(--brand-soft) px-2.5 py-1 text-xs font-semibold text-(--brand-primary)">
                          <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          منطقة رئيسية
                        </span>
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                            منطقة فرعية
                          </span>
                          <p className="mt-1 text-xs text-gray-500">
                            تابعة لـ {parentArea?.name_ar ?? "منطقة غير متاحة"}
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {area.name_en || "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-left text-sm text-gray-500" dir="ltr">
                      {area.slug}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {area.city || "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {area.governorate || "-"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          area.is_active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800",
                        )}
                      >
                        {area.is_active ? "مفعلة" : "معطلة"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenModal(area)}
                          disabled={loading}
                        >
                          تعديل
                        </Button>
                        {confirmingDeleteId === area.id ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-red-600 bg-red-600 text-white hover:bg-red-700"
                              onClick={() => handleDelete(area.id)}
                              disabled={loading}
                              autoFocus
                            >
                              {loading ? "جارٍ الحذف..." : "تأكيد الحذف"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmingDeleteId(null)}
                              disabled={loading}
                            >
                              إلغاء
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => {
                              setConfirmingDeleteId(area.id);
                              setError("");
                            }}
                            disabled={loading}
                          >
                            حذف
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {initialAreas.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-10 text-center text-sm text-gray-500"
                  >
                    {hasActiveFilters
                      ? "لا توجد مناطق مطابقة للفلاتر الحالية."
                      : "لا توجد مناطق. أضف أول منطقة رئيسية للبدء."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div
            className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="area-dialog-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 sm:p-6">
              <div>
                <h2 id="area-dialog-title" className="text-xl font-bold text-gray-900">
                  {editingArea ? "تعديل منطقة" : "إضافة منطقة جديدة"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  حدد موقع المنطقة داخل الهيكل ثم أكمل بياناتها الأساسية.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleCloseModal}
                disabled={loading}
                aria-label="إغلاق النافذة"
                className="shrink-0"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
                {error ? (
                  <div
                    className="rounded-md border border-(--status-error)/25 bg-red-50 p-3 text-sm font-medium text-(--status-error)"
                    role="alert"
                  >
                    {error}
                  </div>
                ) : null}

                <fieldset aria-describedby="area-kind-help">
                  <legend className="text-sm font-bold text-gray-800">
                    نوع المنطقة <span className="text-(--status-error)">*</span>
                  </legend>
                  <p id="area-kind-help" className="mt-1 text-sm leading-6 text-gray-500">
                    المنطقة الرئيسية مستقلة، أما المنطقة الفرعية فيجب ربطها بمنطقة رئيسية واحدة.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label
                      className={cn(
                        "relative flex min-h-28 cursor-pointer gap-3 rounded-lg border p-4 transition-[background-color,border-color,box-shadow] duration-200 focus-within:ring-4 focus-within:ring-(--brand-accent)/15",
                        areaKind === "main"
                          ? "border-(--brand-accent) bg-(--brand-soft)/60 shadow-sm"
                          : "border-(--brand-border) bg-white hover:border-(--brand-accent)",
                      )}
                    >
                      <input
                        type="radio"
                        name="area_kind"
                        value="main"
                        checked={areaKind === "main"}
                        onChange={() => handleAreaKindChange("main")}
                        disabled={loading}
                        className="sr-only"
                      />
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--brand-soft) text-(--brand-primary)">
                        <MapIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-gray-900">منطقة رئيسية</span>
                        <span className="mt-1 block text-sm leading-6 text-gray-500">
                          مستوى مستقل يمكن ربط مناطق فرعية به.
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                          areaKind === "main"
                            ? "border-(--brand-primary) bg-(--brand-primary) text-white"
                            : "border-gray-300",
                        )}
                        aria-hidden="true"
                      >
                        {areaKind === "main" ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                    </label>

                    <label
                      className={cn(
                        "relative flex min-h-28 gap-3 rounded-lg border p-4 transition-[background-color,border-color,box-shadow] duration-200 focus-within:ring-4 focus-within:ring-(--brand-accent)/15",
                        editingAreaHasChildren
                          ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
                          : "cursor-pointer",
                        areaKind === "sub"
                          ? "border-(--brand-accent) bg-(--brand-soft)/60 shadow-sm"
                          : !editingAreaHasChildren &&
                              "border-(--brand-border) bg-white hover:border-(--brand-accent)",
                      )}
                    >
                      <input
                        type="radio"
                        name="area_kind"
                        value="sub"
                        checked={areaKind === "sub"}
                        onChange={() => handleAreaKindChange("sub")}
                        disabled={loading || editingAreaHasChildren}
                        className="sr-only"
                      />
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                        <MapPin className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-gray-900">منطقة فرعية</span>
                        <span className="mt-1 block text-sm leading-6 text-gray-500">
                          تتبع منطقة رئيسية موجودة في الدليل.
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                          areaKind === "sub"
                            ? "border-(--brand-primary) bg-(--brand-primary) text-white"
                            : "border-gray-300",
                        )}
                        aria-hidden="true"
                      >
                        {areaKind === "sub" ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                    </label>
                  </div>
                  {editingAreaHasChildren ? (
                    <p className="mt-2 text-sm font-medium text-amber-700">
                      لا يمكن تحويل هذه المنطقة إلى فرعية قبل نقل مناطقها الفرعية أو تحويلها إلى رئيسية.
                    </p>
                  ) : null}
                </fieldset>

                {areaKind === "sub" ? (
                  <div>
                    <label htmlFor="parent_area_id" className="block text-sm font-semibold text-(--brand-text)">
                      المنطقة الرئيسية <span className="text-(--status-error)">*</span>
                    </label>
                    <div className="mt-1.5">
                      <Select
                        ref={parentSelectRef}
                        id="parent_area_id"
                        name="parent_area_id"
                        value={parentAreaId}
                        onChange={(event) => {
                          setParentAreaId(event.target.value);
                          setParentError("");
                        }}
                        required
                        disabled={loading || mainAreaOptions.length === 0}
                        aria-invalid={Boolean(parentError)}
                        aria-describedby={
                          parentError ? "parent-area-error" : "parent-area-help"
                        }
                        className={cn(
                          parentError &&
                            "border-(--status-error) focus:border-(--status-error) focus:ring-(--status-error)/15",
                        )}
                      >
                        <option value="">اختر منطقة رئيسية</option>
                        {mainAreaOptions.map((area) => (
                          <option key={area.id} value={area.id}>
                            {area.name_ar}{area.is_active ? "" : " — غير مفعلة"}
                          </option>
                        ))}
                      </Select>
                    </div>
                    {parentError ? (
                      <p id="parent-area-error" className="mt-2 text-sm font-medium text-(--status-error)" role="alert">
                        {parentError}
                      </p>
                    ) : (
                      <p id="parent-area-help" className="mt-2 text-sm leading-6 text-gray-500">
                        تظهر المناطق الرئيسية غير المفعلة أيضاً للحفاظ على العلاقات الحالية.
                      </p>
                    )}
                    {mainAreaOptions.length === 0 ? (
                      <p className="mt-2 text-sm font-medium text-amber-700" role="status">
                        أضف منطقة رئيسية أولاً قبل إنشاء منطقة فرعية.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="الاسم (عربي) *" htmlFor="name_ar">
                    <Input
                      ref={nameInputRef}
                      id="name_ar"
                      name="name_ar"
                      defaultValue={editingArea?.name_ar}
                      required
                      maxLength={120}
                      disabled={loading}
                    />
                  </Field>
                  <Field label="الاسم (إنجليزي) *" htmlFor="name_en">
                    <Input
                      id="name_en"
                      name="name_en"
                      defaultValue={editingArea?.name_en || ""}
                      required
                      maxLength={120}
                      disabled={loading}
                      dir="ltr"
                    />
                  </Field>
                  <Field label="الرابط (Slug) *" htmlFor="slug">
                    <Input
                      id="slug"
                      name="slug"
                      defaultValue={editingArea?.slug}
                      required
                      maxLength={120}
                      disabled={loading}
                      dir="ltr"
                    />
                  </Field>
                  <Field label="المدينة *" htmlFor="city">
                    <Input
                      id="city"
                      name="city"
                      defaultValue={editingArea?.city || ""}
                      required
                      maxLength={120}
                      disabled={loading}
                    />
                  </Field>
                  <Field label="المحافظة *" htmlFor="governorate" className="sm:col-span-2">
                    <Input
                      id="governorate"
                      name="governorate"
                      defaultValue={editingArea?.governorate || ""}
                      required
                      maxLength={120}
                      disabled={loading}
                    />
                  </Field>
                </div>

                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-(--brand-border) bg-gray-50 px-4 py-3">
                  <input
                    type="checkbox"
                    id="is_active"
                    name="is_active"
                    defaultChecked={editingArea ? editingArea.is_active : true}
                    disabled={loading}
                    className="h-5 w-5 rounded border-gray-300 accent-(--brand-primary) focus-visible:ring-4 focus-visible:ring-(--brand-accent)/20"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-gray-800">تفعيل المنطقة</span>
                    <span className="mt-0.5 block text-xs leading-5 text-gray-500">
                      المناطق غير المفعلة تبقى ظاهرة للإدارة ويمكن استخدامها كمرجع هيكلي.
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-white p-5 sm:flex-row sm:justify-end sm:p-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseModal}
                  disabled={loading}
                  className="w-full sm:w-auto"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={
                    loading ||
                    (areaKind === "sub" &&
                      (!parentAreaId || mainAreaOptions.length === 0))
                  }
                  className="w-full sm:w-auto"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {loading ? "جاري الحفظ..." : editingArea ? "حفظ التعديلات" : "إضافة المنطقة"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
