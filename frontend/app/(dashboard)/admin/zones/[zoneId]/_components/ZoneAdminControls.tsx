"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  updateZoneActivationAction,
  upsertZoneMerchantAction,
  type ZoneMutationActionResult,
} from "@/actions/admin-server";
import { Button } from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";
import type {
  AdminZoneMerchantMembership,
  EligibleZoneMerchant,
  MerchantEligibilityBlocker,
  ZoneActivationBlocker,
} from "@/types/models/zone-storefront";

type ToastState = ZoneMutationActionResult & { id: number };

const activationBlockerMessages: Record<ZoneActivationBlocker, string> = {
  ZONE_OPERATOR_NOT_READY:
    "مشغل المنطقة غير جاهز. راجع حالته وإتاحة التوصيل.",
  ZONE_CATALOG_NOT_READY:
    "كتالوج المنطقة غير جاهز. نفّذ مزامنة المنتجات الأساسية أولاً.",
  ZONE_NO_ELIGIBLE_ACTIVE_MERCHANT:
    "فعّل عضوية متجر تنفيذ مؤهل واحد على الأقل قبل تفعيل المنطقة.",
};

const merchantBlockerMessages: Record<MerchantEligibilityBlocker, string> = {
  MERCHANT_NOT_FOUND: "تعذر العثور على المتجر.",
  MERCHANT_INACTIVE: "المتجر نفسه غير نشط.",
  MERCHANT_DELETED: "المتجر محذوف.",
  MERCHANT_DELIVERY_DISABLED: "التوصيل متوقف في إعدادات المتجر.",
  MERCHANT_CATEGORY_MISMATCH: "تصنيف المتجر لا يطابق تصنيف المنطقة.",
  MERCHANT_IS_ZONE_OPERATOR: "هذا متجر تشغيل داخلي ولا يمكنه تنفيذ الطلبات.",
  MERCHANT_DELIVERY_AREA_MISSING:
    "منطقة التوصيل غير مضافة إلى تغطية المتجر.",
  MERCHANT_DELIVERY_AREA_INACTIVE:
    "تغطية المتجر لهذه المنطقة متوقفة.",
};

const shouldLinkToMerchantAreas = (blocker: MerchantEligibilityBlocker | null) =>
  blocker === "MERCHANT_DELIVERY_AREA_MISSING" ||
  blocker === "MERCHANT_DELIVERY_AREA_INACTIVE";

function MutationToast({
  toast,
  close,
}: {
  toast: ToastState | null;
  close: () => void;
}) {
  return toast ? (
    <Toast
      key={toast.id}
      message={toast.message}
      type={toast.success ? "success" : "error"}
      onClose={close}
    />
  ) : null;
}

export function ZoneActivationControl({
  zoneId,
  isActive,
  blockers,
}: {
  zoneId: number;
  isActive: boolean;
  blockers: ZoneActivationBlocker[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastState | null>(null);
  const activationBlocked = !isActive && blockers.length > 0;

  const updateActivation = () => {
    startTransition(async () => {
      try {
        const result = await updateZoneActivationAction(zoneId, !isActive);
        setToast({ ...result, id: result.timestamp });
        if (result.success) router.refresh();
      } catch {
        setToast({
          id: Date.now(),
          success: false,
          message: "تعذر تحديث حالة المنطقة. حاول مرة أخرى.",
          timestamp: Date.now(),
        });
      }
    });
  };

  return (
    <div className="flex max-w-md flex-col items-end gap-2">
      <MutationToast toast={toast} close={() => setToast(null)} />
      <Button
        type="button"
        variant={isActive ? "outline" : "primary"}
        disabled={isPending || activationBlocked}
        onClick={updateActivation}
      >
        {isPending
          ? "جارٍ تحديث الحالة..."
          : isActive
            ? "إيقاف الطلبات الجديدة"
            : "تفعيل المنطقة"}
      </Button>
      {activationBlocked ? (
        <div
          className="text-right text-xs font-medium text-amber-800"
          role="status"
        >
          {blockers.map((blocker) => (
            <p key={blocker}>{activationBlockerMessages[blocker]}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ZoneMerchantControls({
  zoneId,
  eligibleMerchants,
  memberships,
}: {
  zoneId: number;
  eligibleMerchants: EligibleZoneMerchant[];
  memberships: AdminZoneMerchantMembership[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastState | null>(null);

  const runMutation = (formData: FormData) => {
    startTransition(async () => {
      try {
        const result = await upsertZoneMerchantAction(zoneId, formData);
        setToast({ ...result, id: result.timestamp });
        if (result.success) router.refresh();
      } catch {
        setToast({
          id: Date.now(),
          success: false,
          message: "تعذر تحديث عضوية المتجر. حاول مرة أخرى.",
          timestamp: Date.now(),
        });
      }
    });
  };

  const addMerchant = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runMutation(new FormData(event.currentTarget));
  };

  const toggleMembership = (membership: AdminZoneMerchantMembership) => {
    const formData = new FormData();
    formData.set("tenant_id", String(membership.tenant_id));
    formData.set("priority", String(membership.priority));
    formData.set("is_active", String(!membership.is_active));
    runMutation(formData);
  };

  return (
    <>
      <MutationToast toast={toast} close={() => setToast(null)} />
      <form onSubmit={addMerchant} className="mt-4 grid gap-3 md:grid-cols-4">
        <select
          name="tenant_id"
          required
          disabled={isPending}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 disabled:opacity-60 md:col-span-2"
        >
          <option value="">اختر متجراً يغطي المنطقة</option>
          {eligibleMerchants.map((merchant) => (
            <option key={merchant.id} value={merchant.id}>
              {merchant.name}
            </option>
          ))}
        </select>
        <input
          name="priority"
          type="number"
          defaultValue="0"
          disabled={isPending}
          className="rounded-md border border-gray-300 px-3 py-2 disabled:opacity-60"
          aria-label="الأولوية"
        />
        <input type="hidden" name="is_active" value="true" />
        <Button type="submit" disabled={isPending}>
          {isPending ? "جارٍ الحفظ..." : "حفظ العضوية"}
        </Button>
      </form>

      <div className="mt-4 space-y-2">
        {memberships.map((membership) => {
          const blocker = membership.eligibility.blocker;
          const cannotReactivate =
            !membership.is_active && !membership.eligibility.eligible;
          const stateLabel = membership.is_active
            ? membership.eligibility.eligible
              ? "نشط"
              : "نشط · غير مؤهل"
            : "متوقف";

          return (
            <div
              key={membership.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 p-3 text-sm"
            >
              <div>
                <strong>{membership.tenant.name}</strong>
                <p className="text-xs text-gray-500">
                  أولوية {membership.priority} · {stateLabel}
                </p>
                {blocker ? (
                  <p className="mt-1 text-xs font-medium text-amber-800">
                    {merchantBlockerMessages[blocker]}{" "}
                    {shouldLinkToMerchantAreas(blocker) ? (
                      <Link
                        href={`/admin/merchants?tenantId=${membership.tenant_id}`}
                        className="font-bold text-brand-primary hover:underline"
                      >
                        تعديل مناطق توصيل المتجر
                      </Link>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending || cannotReactivate}
                onClick={() => toggleMembership(membership)}
              >
                {membership.is_active ? "إيقاف" : "إعادة تفعيل"}
              </Button>
            </div>
          );
        })}
      </div>
    </>
  );
}
