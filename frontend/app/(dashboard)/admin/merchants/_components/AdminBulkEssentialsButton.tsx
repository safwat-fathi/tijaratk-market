"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { adminBulkAddEssentialItemsAction } from "@/actions/admin-server";
import { CheckCircle2, Loader2, PackagePlus } from "lucide-react";
import BottomSheet from "@/components/ui/BottomSheet";

const ALL_ESSENTIAL_CATEGORIES = [
  "مكونات الطبخ",
  "بسكويت، كراكرز وكيك",
  "الشوكولاته والمعجنات",
  "شيبس ومقبلات",
  "أرز , مكرونة والبقوليات",
  "مربي، عسل وغيرها",
  "السكر و مستلزمات الخبز",
  "توابل، صلصات و خل",
];

export function AdminBulkEssentialsButton({
  tenantId,
  tenantName,
  category,
  lastBulkEssentialsAddedAt,
}: {
  tenantId: number;
  tenantName: string;
  category?: string;
  lastBulkEssentialsAddedAt?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (category !== "grocery") {
    return null; // Only show for supermarket tenants
  }

  const handleConfirm = async () => {
    setIsPending(true);
    setError(null);
    try {
      const response = await adminBulkAddEssentialItemsAction(
        tenantId,
        ALL_ESSENTIAL_CATEGORIES,
      );
      if (response.success) {
        setSuccess(true);
        setTimeout(() => setIsOpen(false), 2000);
      } else {
        setError(response.message || "حدث خطأ أثناء الإضافة");
      }
    } catch (err) {
      setError("حدث خطأ في الاتصال بالخادم");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-start gap-1">
        <Button
          variant="outline"
          size="sm"
          className="w-full md:w-auto flex items-center gap-1.5 whitespace-nowrap"
          onClick={() => {
            setIsOpen(true);
            setSuccess(false);
            setError(null);
          }}
        >
          <PackagePlus className="h-4 w-4" />
          التشكيلة الأساسية
        </Button>
        {lastBulkEssentialsAddedAt && (
          <span className="text-[10px] text-gray-500 whitespace-nowrap block w-full text-center md:text-right px-1">
            آخر إضافة: {new Date(lastBulkEssentialsAddedAt).toLocaleDateString("ar-EG", {
              year: "numeric",
              month: "numeric",
              day: "numeric",
            })}
          </span>
        )}
      </div>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="إضافة التشكيلة الأساسية"
        footer={
          !success ? (
            <div className="flex w-full items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="flex-1"
              >
                إلغاء
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isPending}
                className="flex-1"
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                تأكيد الإضافة
              </Button>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 whitespace-normal break-words">
            سيتم إضافة المنتجات الأساسية من جميع الأقسام (بقالة، حلويات، شيبسي،
            إلخ) لمتجر <strong>{tenantName}</strong>.
            <br />
            المنتجات المضافة ستحتاج إلى مراجعة أسعارها من قبل التاجر.
          </p>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {success && (
            <div className="flex flex-col items-center justify-center py-6 text-green-600 space-y-3">
              <CheckCircle2 className="h-12 w-12" />
              <p className="text-lg font-semibold">تم الإضافة بنجاح!</p>
            </div>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
