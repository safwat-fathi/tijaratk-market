"use client";

import BottomSheet from "@/components/ui/BottomSheet";
import type {
  DeliveryAvailability,
  DeliverySlot,
} from "@/types/models/delivery";
import { CalendarClock, Check, ChevronLeft, Clock3 } from "lucide-react";
import { useId, useRef, useState } from "react";

const CAIRO_TIME_ZONE = "Africa/Cairo";
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const toMinutes = (value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
};

const fromMinutes = (value: number) => {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const formatTime = (value: string) => {
  const [hourValue, minutes] = value.split(":");
  const hour = Number(hourValue);
  return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? "مساءً" : "صباحاً"}`;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ar-EG", {
    timeZone: CAIRO_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${value}T12:00:00.000Z`));

const getCairoDateKey = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAIRO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: string) =>
    parts.find((part) => part.type === type)?.value;
  return `${read("year")}-${read("month")}-${read("day")}`;
};

const addDays = (dateKey: string, offset: number) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset))
    .toISOString()
    .slice(0, 10);
};

const getRelativeDateLabel = (date: string) => {
  const cairoToday = getCairoDateKey(new Date());
  if (date === cairoToday) return "اليوم";
  if (date === addDays(cairoToday, 1)) return "غداً";
  return "الموعد التالي";
};

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const hoursLabel = hours === 1 ? "ساعة" : `${hours} ساعات`;
  return remainingMinutes > 0
    ? `${hoursLabel} و${remainingMinutes} دقيقة`
    : hoursLabel;
};

type ScheduleConstraints = NonNullable<
  DeliveryAvailability["schedule_constraints"]
>;

const validateWindow = (
  startsAt: string,
  endsAt: string,
  constraints: ScheduleConstraints,
) => {
  if (!startsAt && !endsAt) return null;
  if (!startsAt) return "اختر وقت البداية.";
  if (!endsAt) return "اختر وقت النهاية.";
  if (!TIME_PATTERN.test(startsAt) || !TIME_PATTERN.test(endsAt)) {
    return "اكتب وقت بداية ونهاية صالحين.";
  }

  const startsAtMinutes = toMinutes(startsAt);
  const endsAtMinutes = toMinutes(endsAt);
  if (
    startsAtMinutes % constraints.step_minutes !== 0 ||
    endsAtMinutes % constraints.step_minutes !== 0
  ) {
    return "اختر الوقت بفواصل 15 دقيقة.";
  }
  if (startsAtMinutes < toMinutes(constraints.min_starts_at)) {
    return `وقت البداية لا يمكن أن يسبق ${formatTime(constraints.min_starts_at)}.`;
  }
  if (endsAtMinutes > toMinutes(constraints.max_ends_at)) {
    return `وقت النهاية لا يمكن أن يتجاوز ${formatTime(constraints.max_ends_at)}.`;
  }
  if (endsAtMinutes <= startsAtMinutes) {
    return "وقت النهاية يجب أن يكون بعد وقت البداية في نفس اليوم.";
  }
  if (
    endsAtMinutes - startsAtMinutes <
    constraints.min_duration_minutes
  ) {
    return "نافذة التوصيل يجب ألا تقل عن ساعة.";
  }
  return null;
};

type ScheduledDeliverySelectorProps = {
  availability: DeliveryAvailability;
  value: DeliverySlot | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: DeliverySlot) => void;
};

export default function ScheduledDeliverySelector({
  availability,
  value,
  isOpen,
  onOpenChange,
  onChange,
}: ScheduledDeliverySelectorProps) {
  const [draftStartsAt, setDraftStartsAt] = useState("");
  const [draftEndsAt, setDraftEndsAt] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const startsAtId = useId();
  const endsAtId = useId();
  const validationMessageId = useId();
  const constraints = availability.schedule_constraints;
  const availableDate = constraints?.date;
  const selectedWindow =
    value && availableDate === value.date ? value : null;
  const validationMessage = constraints
    ? validateWindow(draftStartsAt, draftEndsAt, constraints)
    : "لا توجد مواعيد متاحة حالياً.";
  const durationMinutes =
    draftStartsAt &&
    draftEndsAt &&
    TIME_PATTERN.test(draftStartsAt) &&
    TIME_PATTERN.test(draftEndsAt) &&
    toMinutes(draftEndsAt) > toMinutes(draftStartsAt)
      ? toMinutes(draftEndsAt) - toMinutes(draftStartsAt)
      : null;
  const isDraftValid = Boolean(
    constraints &&
      draftStartsAt &&
      draftEndsAt &&
      validationMessage === null,
  );
  const latestStart = constraints
    ? fromMinutes(
        toMinutes(constraints.max_ends_at) -
          constraints.min_duration_minutes,
      )
    : undefined;
  const earliestEnd =
    constraints && draftStartsAt && TIME_PATTERN.test(draftStartsAt)
      ? fromMinutes(
          toMinutes(draftStartsAt) + constraints.min_duration_minutes,
        )
      : constraints
        ? fromMinutes(
            toMinutes(constraints.min_starts_at) +
              constraints.min_duration_minutes,
          )
        : undefined;
  const hours =
    availability.operating_hours.starts_at &&
    availability.operating_hours.ends_at
      ? `${formatTime(availability.operating_hours.starts_at)} – ${formatTime(availability.operating_hours.ends_at)}`
      : "طوال اليوم";

  const restoreTriggerFocus = () => {
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const resetDraft = () => {
    setDraftStartsAt(selectedWindow?.starts_at ?? "");
    setDraftEndsAt(selectedWindow?.ends_at ?? "");
  };

  const openSheet = () => {
    resetDraft();
    onOpenChange(true);
  };

  const closeSheet = () => {
    resetDraft();
    onOpenChange(false);
    restoreTriggerFocus();
  };

  const handleStartsAtChange = (startsAt: string) => {
    setDraftStartsAt(startsAt);
    if (!draftEndsAt) return;
    if (
      !startsAt ||
      !TIME_PATTERN.test(startsAt) ||
      toMinutes(draftEndsAt) - toMinutes(startsAt) <
        (constraints?.min_duration_minutes ?? 60)
    ) {
      setDraftEndsAt("");
    }
  };

  const confirmSelection = () => {
    if (!constraints || !isDraftValid) return;
    onChange({
      date: constraints.date,
      starts_at: draftStartsAt,
      ends_at: draftEndsAt,
    });
    onOpenChange(false);
    restoreTriggerFocus();
  };

  if (availability.ordering_mode === "unavailable") {
    return (
      <section className="mx-4 mt-4" aria-labelledby="delivery-time-title">
        <div className="flex items-center gap-3 rounded-xl border border-status-error/20 bg-status-error/10 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-status-error shadow-sm">
            <Clock3 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="delivery-time-title" className="font-bold text-brand-text">
              التوصيل غير متاح حالياً
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              حاول مرة أخرى لاحقاً.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (availability.ordering_mode === "asap") {
    return (
      <section className="mx-4 mt-4" aria-labelledby="delivery-time-title">
        <div className="flex items-center gap-3 rounded-xl border border-brand-primary/20 bg-brand-soft/60 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-brand-primary shadow-sm">
            <Clock3 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="delivery-time-title" className="font-bold text-brand-text">
              التوصيل متاح الآن
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              سيتم إرسال طلبك للتوصيل الفوري.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="mx-4 mt-4" aria-labelledby="delivery-time-title">
        <button
          ref={triggerRef}
          type="button"
          onClick={openSheet}
          disabled={!constraints}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className={`flex min-h-20 w-full items-center gap-3 rounded-xl border p-4 text-right shadow-sm transition-[background-color,border-color,box-shadow,transform] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20 disabled:cursor-not-allowed disabled:opacity-60 ${
            selectedWindow
              ? "border-brand-primary/30 bg-brand-soft/65"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-sm ${
              selectedWindow
                ? "bg-brand-primary text-white"
                : "bg-white text-brand-primary"
            }`}
          >
            {selectedWindow ? (
              <Check className="h-5 w-5" aria-hidden="true" />
            ) : (
              <CalendarClock className="h-5 w-5" aria-hidden="true" />
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span
              id="delivery-time-title"
              className="block text-xs font-semibold text-muted-foreground"
            >
              موعد التوصيل
            </span>
            {selectedWindow ? (
              <>
                <span className="mt-0.5 block text-sm font-black text-brand-text">
                  {getRelativeDateLabel(selectedWindow.date)}،{" "}
                  {formatDate(selectedWindow.date)}
                </span>
                <span className="mt-1 block text-sm font-bold text-brand-primary">
                  {formatTime(selectedWindow.starts_at)} –{" "}
                  {formatTime(selectedWindow.ends_at)}
                </span>
              </>
            ) : (
              <>
                <span className="mt-0.5 block text-sm font-black text-brand-text">
                  المتجر مغلق حالياً
                </span>
                <span className="mt-1 block text-sm font-semibold text-amber-900">
                  حدد نافذة التوصيل المناسبة لك
                </span>
              </>
            )}
          </span>

          <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-brand-primary">
            {selectedWindow ? "تغيير" : "اختيار"}
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </span>
        </button>
        {availableDate ? (
          <p className="mt-2 px-1 text-xs leading-5 text-muted-foreground">
            اختر أي نافذة لا تقل عن ساعة {getRelativeDateLabel(availableDate)}،
            ضمن ساعات العمل: {hours}.
          </p>
        ) : null}
      </section>

      <BottomSheet
        isOpen={isOpen}
        onClose={closeSheet}
        title="حدد نافذة التوصيل"
        footer={
          <button
            type="button"
            onClick={confirmSelection}
            disabled={!isDraftValid}
            className="min-h-12 w-full rounded-xl bg-brand-primary px-5 py-3 text-base font-bold text-white shadow-soft transition-[background-color,transform] hover:bg-brand-primary-hover active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            تأكيد الموعد
          </button>
        }
      >
        {constraints && availableDate ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-brand-primary/15 bg-brand-soft/55 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-primary shadow-sm">
                  <CalendarClock className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {getRelativeDateLabel(availableDate)}
                  </p>
                  <p className="mt-0.5 font-bold text-brand-text">
                    {formatDate(availableDate)}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-brand-primary">
                    ساعات التوصيل: {hours}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label htmlFor={startsAtId} className="block min-w-0">
                <span className="mb-2 block text-sm font-bold text-brand-text">
                  من
                </span>
                <input
                  id={startsAtId}
                  type="time"
                  dir="ltr"
                  value={draftStartsAt}
                  min={constraints.min_starts_at}
                  max={latestStart}
                  step={constraints.step_minutes * 60}
                  required
                  aria-invalid={Boolean(validationMessage)}
                  aria-describedby={validationMessageId}
                  onChange={(event) =>
                    handleStartsAtChange(event.target.value)
                  }
                  className="min-h-14 w-full rounded-xl border border-brand-border bg-white px-3 text-center text-base font-bold text-brand-text shadow-sm focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/20"
                />
              </label>

              <label htmlFor={endsAtId} className="block min-w-0">
                <span className="mb-2 block text-sm font-bold text-brand-text">
                  إلى
                </span>
                <input
                  id={endsAtId}
                  type="time"
                  dir="ltr"
                  value={draftEndsAt}
                  min={earliestEnd}
                  max={constraints.max_ends_at}
                  step={constraints.step_minutes * 60}
                  required
                  aria-invalid={Boolean(validationMessage)}
                  aria-describedby={validationMessageId}
                  onChange={(event) => setDraftEndsAt(event.target.value)}
                  className="min-h-14 w-full rounded-xl border border-brand-border bg-white px-3 text-center text-base font-bold text-brand-text shadow-sm focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/20"
                />
              </label>
            </div>

            <div
              id={validationMessageId}
              aria-live="polite"
              className={`rounded-xl border p-3 text-sm font-semibold ${
                validationMessage
                  ? "border-status-error/20 bg-status-error/10 text-status-error"
                  : isDraftValid
                    ? "border-brand-primary/20 bg-brand-soft/60 text-brand-primary"
                    : "border-brand-border bg-brand-soft/30 text-muted-foreground"
              }`}
            >
              {validationMessage
                ? validationMessage
                : durationMinutes !== null
                  ? `مدة نافذة التوصيل: ${formatDuration(durationMinutes)}.`
                  : "اختر وقت البداية والنهاية بفواصل 15 دقيقة. الحد الأدنى ساعة واحدة."}
            </div>

            <p className="text-xs leading-5 text-muted-foreground">
              الموعد المطلوب نافذة زمنية للتوصيل، وسيؤكد المتجر الطلب معك.
            </p>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-brand-border p-5 text-center text-sm text-muted-foreground">
            لا توجد مواعيد متاحة حالياً.
          </p>
        )}
      </BottomSheet>
    </>
  );
}
