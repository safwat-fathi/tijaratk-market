"use client";

import { useTransition } from "react";
import { XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cancelImportAction } from "@/actions/admin-server";

export function CancelImportButton({ importId }: { importId: number }) {
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    if (window.confirm("هل أنت متأكد من رغبتك في إلغاء عملية الاستيراد هذه؟")) {
      startTransition(async () => {
        try {
          await cancelImportAction(importId);
        } catch (error) {
          alert(error instanceof Error ? error.message : "حدث خطأ غير متوقع");
        }
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800"
      disabled={isPending}
      onClick={handleCancel}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <XCircle className="h-4 w-4" />
      )}
      إلغاء الاستيراد
    </Button>
  );
}
