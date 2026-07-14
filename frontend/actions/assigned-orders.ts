"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assignedOrdersService } from "@/services/api/assigned-orders.service";

const positiveId = z.number().int().positive();
const version = z.coerce.number().int().min(0);

export async function updateAssignedQuoteAction(
  dispatchId: number,
  itemId: number,
  formData: FormData,
): Promise<void> {
  const payload = z.object({
    total_price: z.coerce.number().positive(),
    expected_version: version,
  }).parse(Object.fromEntries(formData.entries()));
  const response = await assignedOrdersService.updateQuoteLine(
    positiveId.parse(dispatchId),
    positiveId.parse(itemId),
    payload,
  );
  if (!response.success) throw new Error(response.message || "تعذر حفظ السعر");
  revalidatePath(`/merchant/assigned-orders/${dispatchId}`);
}

export async function acceptAssignedOrderAction(
  dispatchId: number,
  formData: FormData,
): Promise<void> {
  const expectedVersion = version.parse(formData.get("expected_version"));
  const response = await assignedOrdersService.accept(
    positiveId.parse(dispatchId),
    expectedVersion,
  );
  if (!response.success) throw new Error(response.message || "تعذر قبول الطلب");
  revalidatePath("/merchant/assigned-orders");
  revalidatePath(`/merchant/assigned-orders/${dispatchId}`);
}

export async function rejectAssignedOrderAction(
  dispatchId: number,
  formData: FormData,
): Promise<void> {
  const payload = z.object({
    expected_version: version,
    reason: z.string().trim().min(3).max(500),
  }).parse(Object.fromEntries(formData.entries()));
  const response = await assignedOrdersService.reject(
    positiveId.parse(dispatchId),
    payload,
  );
  if (!response.success) throw new Error(response.message || "تعذر رفض الطلب");
  revalidatePath("/merchant/assigned-orders");
}

export async function updateAssignedOrderStatusAction(
  dispatchId: number,
  status: "out_for_delivery" | "completed",
): Promise<void> {
  const response = await assignedOrdersService.updateStatus(
    positiveId.parse(dispatchId),
    z.enum(["out_for_delivery", "completed"]).parse(status),
  );
  if (!response.success) throw new Error(response.message || "تعذر تحديث الحالة");
  revalidatePath("/merchant/assigned-orders");
  revalidatePath(`/merchant/assigned-orders/${dispatchId}`);
}

export async function updateAssignedReplacementAction(
  dispatchId: number,
  itemId: number,
  formData: FormData,
): Promise<void> {
  const replacementProductId = z.coerce.number().int().positive().parse(
    formData.get("replacement_product_id"),
  );
  const response = await assignedOrdersService.updateReplacement(
    positiveId.parse(dispatchId),
    positiveId.parse(itemId),
    replacementProductId,
  );
  if (!response.success) throw new Error(response.message || "تعذر اقتراح البديل");
  revalidatePath(`/merchant/assigned-orders/${dispatchId}`);
}

export async function resetAssignedReplacementAction(
  dispatchId: number,
  itemId: number,
): Promise<void> {
  const response = await assignedOrdersService.resetReplacement(
    positiveId.parse(dispatchId),
    positiveId.parse(itemId),
  );
  if (!response.success) throw new Error(response.message || "تعذر إعادة ضبط البديل");
  revalidatePath(`/merchant/assigned-orders/${dispatchId}`);
}
