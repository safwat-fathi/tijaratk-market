import type { AdminManagedPermission } from "@/services/api/admin.service";

export const DISPATCH_SESSION_PERMISSION_MESSAGE =
  "لا يمكنك فتح قائمة التوزيع لأن حسابك لا يملك صلاحية عرض طلبات التوزيع لهذه المنطقة.";

export const ADMIN_MANAGED_PERMISSION_LABELS = {
  "products.read": "عرض المنتجات",
  "products.create": "إضافة المنتجات",
  "products.update": "تعديل بيانات المنتجات",
  "products.update_price": "تعديل أسعار المنتجات",
  "products.update_availability": "تغيير توفر المنتجات",
  "products.archive": "أرشفة أو استعادة المنتجات",
  "orders.read": "عرض الطلبات",
  "orders.update_status": "تغيير حالة الطلب",
  "orders.update_pricing": "تعديل تسعير الطلب",
  "orders.manage_replacements": "إدارة بدائل المنتجات",
  "customers.read_limited": "عرض بيانات العميل اللازمة للتنفيذ",
  "activity_logs.read": "عرض سجل النشاط",
  "dispatches.read": "عرض طلبات التوزيع",
  "dispatches.assign": "إسناد الطلبات للمتاجر",
  "dispatches.cancel": "إلغاء طلبات التوزيع",
} satisfies Record<AdminManagedPermission, string>;

export const ADMIN_MANAGED_PERMISSION_OPTIONS = Object.entries(
  ADMIN_MANAGED_PERMISSION_LABELS,
).map(([value, label]) => ({
  value: value as AdminManagedPermission,
  label,
}));

export function getAdminManagedPermissionLabel(permission: string): string {
  return (
    ADMIN_MANAGED_PERMISSION_LABELS[
      permission as AdminManagedPermission
    ] ?? "صلاحية غير معروفة"
  );
}
