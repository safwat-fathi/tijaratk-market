"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WalletCards } from "lucide-react";
import { updateStoreSettingsAction } from "@/actions/tenant-actions";
import DeliveryConfigurationEditor from "@/components/delivery/DeliveryConfigurationEditor";
import { INSTAPAY_PROVIDER } from "@/constants/payment-providers";
import type {
  DeliveryConfigurationInput,
  DirectoryArea,
  Tenant,
} from "@/types/models/tenant";

type SettingsFormProps = {
  tenant: Tenant;
  activeAreas: DirectoryArea[];
};

export default function SettingsForm({
  tenant,
  activeAreas,
}: SettingsFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    updateStoreSettingsAction,
    {
      success: false,
      message: "",
      errors: undefined,
    },
  );
  const [deliveryConfiguration, setDeliveryConfiguration] =
    useState<DeliveryConfigurationInput>(() => ({
      delivery_available: tenant.delivery_available !== false,
      delivery_starts_at: tenant.delivery_starts_at || null,
      delivery_ends_at: tenant.delivery_ends_at || null,
      primary_area_id: tenant.directory_profile?.area_id || 0,
      delivery_areas:
        tenant.tenant_delivery_areas
          ?.filter(
            (area) =>
              area.is_active !== false && area.area?.is_active !== false,
          )
          .map((area) => ({
            area_id: area.area_id,
            delivery_fee: Number(area.delivery_fee),
          })) || [],
    }));

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input
        type="hidden"
        name="delivery_configuration"
        value={JSON.stringify(deliveryConfiguration)}
      />

      <section className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-6 text-xl font-semibold text-brand-primary">
          معلومات المتجر
        </h2>
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
            اسم المتجر
            <input
              name="name"
              defaultValue={tenant.name}
              type="text"
              className="min-h-12 w-full rounded-xl border border-gray-200 bg-background px-4 text-base focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
            />
            {state.errors?.name ? (
              <span className="text-sm text-status-error">
                {state.errors.name[0]}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
            نشاط المتجر
            <select
              name="category"
              defaultValue={tenant.category}
              className="min-h-12 w-full rounded-xl border border-gray-200 bg-background px-4 text-base focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
            >
              <option value="grocery">سوبر ماركت</option>
              <option value="greengrocer">خضار وفاكهة</option>
              <option value="butcher">لحوم ودواجن</option>
              <option value="bakery">مخبز وحلويات</option>
              <option value="pharmacy">صيدلية</option>
              <option value="other">أخرى</option>
            </select>
            {state.errors?.category ? (
              <span className="text-sm text-status-error">
                {state.errors.category[0]}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
            رقم الهاتف{" "}
            <span className="text-xs text-gray-400">(للقراءة فقط)</span>
            <input
              type="text"
              value={tenant.phone}
              readOnly
              className="min-h-12 w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-100 px-4 text-base text-gray-500"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
            رابط المتجر{" "}
            <span className="text-xs text-gray-400">(للقراءة فقط)</span>
            <input
              type="text"
              value={tenant.slug}
              readOnly
              dir="ltr"
              className="min-h-12 w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-100 px-4 text-base text-gray-500"
            />
          </label>
        </div>
      </section>

      <section className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold text-brand-primary">طرق الدفع</h2>
        <p className="mb-6 mt-2 text-sm text-gray-500">
          تظهر طرق الدفع للعميل فقط عند إدخال الاسم والرقم معاً.
        </p>

        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-gray-100 bg-background p-4">
            <div className="mb-4 flex items-center gap-3">
              {INSTAPAY_PROVIDER.logoSrc ? (
                <Image
                  src={INSTAPAY_PROVIDER.logoSrc}
                  alt={INSTAPAY_PROVIDER.labelAr}
                  width={110}
                  height={32}
                  className="h-8 w-auto object-contain"
                />
              ) : (
                <span className="rounded-md bg-white px-3 py-1 text-sm font-black text-[#4B2383]">
                  {INSTAPAY_PROVIDER.labelAr}
                </span>
              )}
              <h3 className="text-sm font-bold text-gray-800">إنستاباي</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
                اسم الحساب
                <input
                  name="instapay_account_name"
                  type="text"
                  maxLength={120}
                  defaultValue={tenant.instapay_account_name || ""}
                  className="min-h-12 rounded-xl border border-gray-200 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
                الرقم أو الحساب
                <input
                  name="instapay_account_number"
                  type="text"
                  maxLength={120}
                  defaultValue={tenant.instapay_account_number || ""}
                  dir="ltr"
                  className="min-h-12 rounded-xl border border-gray-200 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
                />
                {state.errors?.instapay_account_number ? (
                  <span className="text-sm text-status-error">
                    {state.errors.instapay_account_number[0]}
                  </span>
                ) : null}
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-background p-4">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand-accent">
                <WalletCards className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-sm font-bold text-gray-800">
                محفظة إلكترونية
              </h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
                اسم صاحب المحفظة
                <input
                  name="ewallet_account_name"
                  type="text"
                  maxLength={120}
                  defaultValue={tenant.ewallet_account_name || ""}
                  className="min-h-12 rounded-xl border border-gray-200 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
                رقم المحفظة
                <input
                  name="ewallet_account_number"
                  type="text"
                  maxLength={120}
                  defaultValue={tenant.ewallet_account_number || ""}
                  dir="ltr"
                  className="min-h-12 rounded-xl border border-gray-200 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
                />
                {state.errors?.ewallet_account_number ? (
                  <span className="text-sm text-status-error">
                    {state.errors.ewallet_account_number[0]}
                  </span>
                ) : null}
              </label>
            </div>
          </div>

          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-gray-100 bg-background p-4">
            <input
              name="card_on_delivery_available"
              type="checkbox"
              defaultChecked={tenant.card_on_delivery_available === true}
              className="mt-1 h-5 w-5 rounded border-gray-300 accent-brand-primary"
            />
            <span>
              <span className="block text-sm font-bold text-gray-800">
                إتاحة الدفع بالكارت عند التوصيل
              </span>
              <span className="mt-1 block text-sm leading-6 text-gray-500">
                يستطيع العميل طلب ماكينة كارت مع مندوب التوصيل.
              </span>
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
        <DeliveryConfigurationEditor
          areas={activeAreas}
          value={deliveryConfiguration}
          onChange={setDeliveryConfiguration}
          errors={state.errors}
          disabled={isPending}
        />
      </section>

      {state.message ? (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl border p-4 text-sm font-medium ${
            state.success
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <div className="sticky bottom-4 z-10 mt-4 safe-bottom-padding">
        <button
          type="submit"
          disabled={isPending}
          className="min-h-12 w-full rounded-xl bg-brand-primary py-4 text-lg font-bold text-white shadow-lg transition-colors hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
        >
          {isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
        </button>
      </div>
    </form>
  );
}
