"use client";

import { useTransition } from "react";
import { updateTenantPlanAction } from "@/actions/admin-server";

interface PlanSelectProps {
  tenantId: number;
  currentPlanId?: number;
  plans: { id: number; name: string }[];
}

export function PlanSelect({ tenantId, currentPlanId, plans }: PlanSelectProps) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const planId = parseInt(e.target.value, 10);
    if (!isNaN(planId)) {
      startTransition(() => {
        updateTenantPlanAction(tenantId, planId);
      });
    }
  };

  return (
    <select
      value={currentPlanId || ""}
      onChange={handleChange}
      disabled={isPending}
      className="block min-h-9 w-full sm:w-40 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-primary focus:outline-none focus:ring-primary disabled:opacity-50"
    >
      <option value="" disabled>اختر الباقة</option>
      {plans.map((plan) => (
        <option key={plan.id} value={plan.id}>
          {plan.name}
        </option>
      ))}
    </select>
  );
}
