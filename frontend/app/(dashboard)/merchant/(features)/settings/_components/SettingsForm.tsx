"use client";

import { useActionState, useState } from "react";
import { Tenant } from "@/types/models/tenant";
import { updateStoreSettingsAction } from "@/actions/tenant-actions";

interface SettingsFormProps {
  tenant: Tenant;
}

export default function SettingsForm({ tenant }: SettingsFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateStoreSettingsAction,
    {
      success: false,
      message: "",
      errors: undefined,
    }
  );

  // Manage checkbox state locally for conditional rendering
  const [deliveryAvailable, setDeliveryAvailable] = useState(
    tenant.delivery_available
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* General Settings Card */}
      <div className="bg-white rounded-[20px] p-4 sm:p-6 shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold text-[#0F5A3D] mb-6">معلومات المتجر</h2>
        
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">اسم المتجر</label>
            <input
              name="name"
              defaultValue={tenant.name}
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#F7F8F6] focus:outline-none focus:ring-2 focus:ring-[#27AE60]/50"
            />
            {state.errors?.name && (
              <span className="text-red-500 text-sm">{state.errors.name[0]}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">نشاط المتجر</label>
            <select
              name="category"
              defaultValue={tenant.category}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#F7F8F6] focus:outline-none focus:ring-2 focus:ring-[#27AE60]/50"
            >
              <option value="grocery">بقالة / سوبر ماركت</option>
              <option value="greengrocer">خضار وفاكهة</option>
              <option value="butcher">لحوم ودواجن</option>
              <option value="bakery">مخبز وحلويات</option>
              <option value="pharmacy">صيدلية</option>
              <option value="other">أخرى</option>
            </select>
            {state.errors?.category && (
              <span className="text-red-500 text-sm">{state.errors.category[0]}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">رقم الهاتف <span className="text-xs text-gray-400">(للقراءة فقط)</span></label>
            <input
              type="text"
              value={tenant.phone}
              readOnly
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">رابط المتجر <span className="text-xs text-gray-400">(للقراءة فقط)</span></label>
            <input
              type="text"
              value={tenant.slug}
              readOnly
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed"
              dir="ltr"
            />
          </div>
        </div>
      </div>

      {/* Delivery Settings Card */}
      <div className="bg-white rounded-[20px] p-4 sm:p-6 shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold text-[#0F5A3D] mb-6">إعدادات التوصيل</h2>
        
        <div className="flex flex-col gap-5">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                name="delivery_available"
                type="checkbox"
                defaultChecked={tenant.delivery_available}
                onChange={(e) => setDeliveryAvailable(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-[#27AE60] peer-checked:after:translate-x-[-100%] after:content-[''] after:absolute after:top-[2px] after:left-[22px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </div>
            <span className="text-sm font-medium text-gray-700">التوصيل متاح</span>
          </label>

          {deliveryAvailable && (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">رسوم التوصيل (جنيه)</label>
                <input
                  name="delivery_fee"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={tenant.delivery_fee}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#F7F8F6] focus:outline-none focus:ring-2 focus:ring-[#27AE60]/50"
                />
                {state.errors?.delivery_fee && (
                  <span className="text-red-500 text-sm">{state.errors.delivery_fee[0]}</span>
                )}
              </div>

              <div className="flex gap-4">
                <div className="flex-1 flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">من الساعة</label>
                  <input
                    name="delivery_starts_at"
                    type="time"
                    defaultValue={tenant.delivery_starts_at || ""}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#F7F8F6] focus:outline-none focus:ring-2 focus:ring-[#27AE60]/50"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">إلى الساعة</label>
                  <input
                    name="delivery_ends_at"
                    type="time"
                    defaultValue={tenant.delivery_ends_at || ""}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#F7F8F6] focus:outline-none focus:ring-2 focus:ring-[#27AE60]/50"
                  />
                </div>
              </div>
              {state.errors?.delivery_ends_at && (
                <span className="text-red-500 text-sm">{state.errors.delivery_ends_at[0]}</span>
              )}
            </>
          )}
        </div>
      </div>

      {state.message && (
        <div
          className={`p-4 rounded-xl text-sm font-medium ${
            state.success
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {state.message}
        </div>
      )}

      <div className="sticky bottom-4 z-10 mt-4">
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-[#0F5A3D] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#0b422d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
        </button>
      </div>
    </form>
  );
}
