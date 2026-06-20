export const formatPrescriptionUnavailabilityAction = (
  action?: string | null,
) => {
  const normalized = action?.trim();
  if (!normalized) {
    return null;
  }

  if (normalized === "call") {
    return "اتصل بي للاستشارة";
  }

  if (normalized === "alternative") {
    return "أرسل البديل المتاح";
  }

  if (normalized === "cancel") {
    return "إلغاء المنتج";
  }

  return normalized;
};
