"use client";

import { Field, Input } from "@/components/ui/Field";
import type { MissingDeliveryAreaRequest } from "@/types/models/tenant";

type MissingDeliveryAreaPanelProps = {
  areaName: string;
  request: MissingDeliveryAreaRequest | null;
  requestedAreaName: string;
  note: string;
  onRequestedAreaNameChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  disabled?: boolean;
  error?: string | null;
};

export default function MissingDeliveryAreaPanel({
  areaName,
  request,
  requestedAreaName,
  note,
  onRequestedAreaNameChange,
  onNoteChange,
  disabled = false,
  error,
}: MissingDeliveryAreaPanelProps) {
  return (
    <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
      <p className="font-bold">
        لا توجد مناطق توصيل فرعية متاحة داخل {areaName}.
      </p>
      {request?.status === "resolved" ? (
        <p>
          تمت إضافة {request.resolved_area?.name_ar ?? "المنطقة المطلوبة"}.
          يمكنك الآن تفعيل التوصيل وتحديد الرسوم.
        </p>
      ) : request ? (
        <p>
          تم إرسال طلبك إلى الإدارة وهو قيد المراجعة. التوصيل متوقف مؤقتاً
          ويمكنك متابعة استخدام المتجر.
        </p>
      ) : (
        <>
          <Field label="اسم منطقتك" htmlFor="requested-area-name">
            <Input
              id="requested-area-name"
              value={requestedAreaName}
              onChange={(event) =>
                onRequestedAreaNameChange(event.target.value)
              }
              required
              disabled={disabled}
              maxLength={120}
              placeholder="مثال: الطالبية"
            />
          </Field>
          <Field
            label="علامة مميزة أو ملاحظة (اختياري)"
            htmlFor="requested-area-note"
          >
            <Input
              id="requested-area-note"
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              disabled={disabled}
              maxLength={500}
              placeholder="مثال: بجوار محطة المريوطية"
            />
          </Field>
        </>
      )}
      {error ? (
        <p role="alert" className="font-semibold text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
