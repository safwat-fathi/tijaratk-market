"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import BulkEssentialWizard from "@/components/merchant/BulkEssentialWizard";
import { adminBulkAddEssentialItemsAction } from "@/actions/admin-server";

export function AdminBulkEssentialsButton({
  tenantId,
  category,
  lastBulkEssentialsAddedAt,
}: {
  tenantId: number;
  tenantName: string;
  category?: string;
  lastBulkEssentialsAddedAt?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const addEssentialItems = useCallback(
    (payload: { allEssentialItems: true }) =>
      adminBulkAddEssentialItemsAction(tenantId, payload),
    [tenantId],
  );

  if (category !== "grocery" && category !== "pharmacy") {
    return null;
  }

  const storeTypeLabel = category === "pharmacy" ? "الصيدلية" : "السوبر ماركت";

  return (
    <>
      <div className="flex flex-col items-start gap-1">
        <Button
          variant="outline"
          size="sm"
          className="flex w-full items-center gap-1.5 whitespace-nowrap md:w-auto"
          onClick={() => setIsOpen(true)}
        >
          <PackagePlus className="h-4 w-4" />
          التشكيلة الأساسية
        </Button>
        {lastBulkEssentialsAddedAt ? (
          <span className="block w-full whitespace-nowrap px-1 text-center text-[10px] text-gray-500 md:text-right">
            آخر إضافة:{" "}
            {new Date(lastBulkEssentialsAddedAt).toLocaleDateString("ar-EG", {
              year: "numeric",
              month: "numeric",
              day: "numeric",
            })}
          </span>
        ) : null}
      </div>

      <BulkEssentialWizard
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={() => router.refresh()}
        addEssentialItemsAction={addEssentialItems}
        storeTypeLabel={storeTypeLabel}
      />
    </>
  );
}
