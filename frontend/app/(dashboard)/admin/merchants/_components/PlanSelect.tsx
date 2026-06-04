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
      className="block w-full pl-3 pr-10 py-1.5 text-xs border-gray-300 focus:outline-none focus:ring-primary focus:border-primary rounded-md disabled:opacity-50"
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
