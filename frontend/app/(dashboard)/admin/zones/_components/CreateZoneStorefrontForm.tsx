"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  createZoneStorefrontAction,
  type ZoneCreateActionState,
} from "@/actions/admin-server";
import { Button } from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { AdminDirectoryArea } from "@/services/api/admin.service";

type Props = {
  areas: AdminDirectoryArea[];
};

type FormValues = {
  name: string;
  slug: string;
  area_id: string;
  category: "grocery" | "pharmacy";
  operations_phone: string;
  delivery_fee: string;
};

type FormField = keyof FormValues;

const initialActionState: ZoneCreateActionState = {
  success: false,
};

const initialFormValues: FormValues = {
  name: "",
  slug: "",
  area_id: "",
  category: "grocery",
  operations_phone: "",
  delivery_fee: "20",
};

const baseControlClassName =
  "mt-1 min-h-11 w-full rounded-md border bg-white px-3 py-2 text-base text-gray-900 shadow-sm transition-[border-color,box-shadow] duration-200 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60";

export function CreateZoneStorefrontForm({ areas }: Props) {
  const parentIdsWithActiveChildren = new Set(
    areas
      .filter((area) => area.is_active && area.parent_area_id !== null)
      .map((area) => area.parent_area_id as number),
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    createZoneStorefrontAction,
    initialActionState,
  );
  const [values, setValues] = useState<FormValues>(initialFormValues);
  const [toast, setToast] = useState<{
    id: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!state.timestamp || state.success || !state.message) return;

    setToast({ id: state.timestamp, message: state.message });
    const firstInvalidControl =
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    firstInvalidControl?.focus();
  }, [state.errors, state.message, state.success, state.timestamp]);

  const updateValue = (field: FormField) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setValues((current) => ({
        ...current,
        [field]: event.target.value,
      }) as FormValues);
    };

  const getFieldError = (field: FormField) =>
    isPending ? undefined : state.errors?.[field]?.[0];
  const controlClassName = (field: FormField) =>
    cn(
      baseControlClassName,
      getFieldError(field)
        ? "border-(--status-error) focus:border-(--status-error) focus:ring-(--status-error)/15"
        : "border-gray-300 focus:border-(--brand-accent) focus:ring-(--brand-accent)/15",
    );

  const renderFieldError = (field: FormField) => {
    const error = getFieldError(field);
    return error ? (
      <p
        id={`zone-create-${field}-error`}
        className="mt-1.5 text-sm font-medium text-(--status-error)"
      >
        {error}
      </p>
    ) : null;
  };

  const accessibleErrorProps = (field: FormField) => {
    const hasError = Boolean(getFieldError(field));
    return {
      "aria-invalid": hasError,
      "aria-describedby": hasError
        ? `zone-create-${field}-error`
        : undefined,
    } as const;
  };

  const showFormError = Boolean(
    !isPending && state.message && state.success === false,
  );

  return (
    <>
      {toast ? (
        <Toast
          key={toast.id}
          message={toast.message}
          type="error"
          onClose={() => setToast(null)}
        />
      ) : null}

      <form
        ref={formRef}
        action={formAction}
        noValidate
        className="mt-4 grid gap-4 md:grid-cols-2"
        aria-busy={isPending}
        onSubmit={() => setToast(null)}
      >
        {showFormError ? (
          <div
            className="md:col-span-2 rounded-md border border-(--status-error)/25 bg-red-50 px-4 py-3 text-sm font-semibold text-(--status-error)"
            role="alert"
          >
            {state.message}
          </div>
        ) : null}

        <label className="text-sm font-semibold text-gray-700">
          الاسم العام
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            value={values.name}
            onChange={updateValue("name")}
            className={controlClassName("name")}
            placeholder="تجارة الشيخ زايد"
            disabled={isPending}
            {...accessibleErrorProps("name")}
          />
          {renderFieldError("name")}
        </label>

        <label className="text-sm font-semibold text-gray-700">
          الرابط
          <input
            name="slug"
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            maxLength={120}
            value={values.slug}
            onChange={updateValue("slug")}
            className={controlClassName("slug")}
            placeholder="sheikh-zayed"
            dir="ltr"
            disabled={isPending}
            {...accessibleErrorProps("slug")}
          />
          {renderFieldError("slug")}
        </label>

        <label className="text-sm font-semibold text-gray-700">
          المنطقة
          <select
            name="area_id"
            required
            value={values.area_id}
            onChange={updateValue("area_id")}
            className={controlClassName("area_id")}
            disabled={isPending}
            {...accessibleErrorProps("area_id")}
          >
            <option value="">اختر المنطقة</option>
            {areas
              .filter(
                (area) =>
                  area.is_active && parentIdsWithActiveChildren.has(area.id),
              )
              .map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name_ar}
                </option>
              ))}
          </select>
          {renderFieldError("area_id")}
        </label>

        <label className="text-sm font-semibold text-gray-700">
          القطاع
          <select
            name="category"
            required
            value={values.category}
            onChange={updateValue("category")}
            className={controlClassName("category")}
            disabled={isPending}
            {...accessibleErrorProps("category")}
          >
            <option value="grocery">سوبر ماركت</option>
            <option value="pharmacy">صيدلية</option>
          </select>
          {renderFieldError("category")}
        </label>

        <label className="text-sm font-semibold text-gray-700">
          هاتف عمليات المنطقة
          <input
            name="operations_phone"
            required
            minLength={8}
            maxLength={32}
            value={values.operations_phone}
            onChange={updateValue("operations_phone")}
            className={controlClassName("operations_phone")}
            dir="ltr"
            disabled={isPending}
            {...accessibleErrorProps("operations_phone")}
          />
          {renderFieldError("operations_phone")}
        </label>

        <label className="text-sm font-semibold text-gray-700">
          الرسم الافتراضي لكل منطقة فرعية
          <input
            name="delivery_fee"
            type="number"
            required
            min="0"
            step="0.01"
            value={values.delivery_fee}
            onChange={updateValue("delivery_fee")}
            className={controlClassName("delivery_fee")}
            dir="ltr"
            disabled={isPending}
            {...accessibleErrorProps("delivery_fee")}
          />
          {renderFieldError("delivery_fee")}
          <span className="mt-1.5 block text-xs font-normal text-gray-500">
            سيُنسخ هذا الرسم تلقائياً إلى كل منطقة توصيل فرعية ويمكن تعديله بعد
            الإنشاء.
          </span>
        </label>

        <div className="md:col-span-2">
          <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
            {isPending
              ? "جارٍ إنشاء واجهة المنطقة..."
              : "إنشاء المنطقة بحالة غير مفعلة"}
          </Button>
        </div>
      </form>
    </>
  );
}
