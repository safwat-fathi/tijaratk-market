import { ordersService } from "@/services/api/orders.service";
import { formatCurrency } from "@/lib/utils/currency";
import SafeImage from "@/components/ui/SafeImage";
import Link from "next/link";
import { OrderStatus } from "@/types/enums";
import TrackingOrderItemsCard from "./_components/TrackingOrderItemsCard";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ token: string }>;
};

const TrackingOrdersIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0 opacity-90"
    aria-hidden="true"
  >
    <path d="M3 7h13" />
    <path d="M3 12h9" />
    <path d="M3 17h6" />
    <circle cx="17" cy="17" r="4" />
    <path d="m19 19-2-2V15" />
  </svg>
);

const StatusBadge = ({ status }: { status: OrderStatus }) => {
  const statusConfig: Record<
    string,
    { label: string; color: string; icon: React.ReactNode }
  > = {
    [OrderStatus.DRAFT]: {
      label: "قيد المراجعة",
      color: "bg-status-new/15 text-status-new border border-status-new/25",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" x2="8" y1="13" y2="13" />
          <line x1="16" x2="8" y1="17" y2="17" />
          <line x1="10" x2="8" y1="9" y2="9" />
        </svg>
      ),
    },
    [OrderStatus.CONFIRMED]: {
      label: "مؤكد",
      color:
        "bg-status-confirmed/15 text-status-confirmed border border-status-confirmed/25",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
    },
    [OrderStatus.OUT_FOR_DELIVERY]: {
      label: "خرج للتوصيل",
      color:
        "bg-status-delivery/25 text-amber-800 border border-status-delivery/40",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
          <path d="M13 15h.01" />
          <path d="M17 15h.01" />
        </svg>
      ),
    },
    [OrderStatus.COMPLETED]: {
      label: "اكتمل",
      color:
        "bg-status-completed/15 text-status-completed border border-status-completed/25",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
    [OrderStatus.CANCELLED]: {
      label: "ملغي",
      color:
        "bg-status-cancelled/15 text-status-cancelled border border-status-cancelled/25",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" x2="9" y1="9" y2="15" />
          <line x1="9" x2="15" y1="9" y2="15" />
        </svg>
      ),
    },
    [OrderStatus.REJECTED_BY_CUSTOMER]: {
      label: "مرفوض من العميل",
      color:
        "bg-status-cancelled/15 text-status-cancelled border border-status-cancelled/25",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="m15 9-6 6" />
          <path d="m9 9 6 6" />
        </svg>
      ),
    },
  };

  const statusConfigMap = new Map(
    Object.entries(statusConfig) as Array<
      [OrderStatus, { label: string; color: string; icon: React.ReactNode }]
    >,
  );
  const config =
    statusConfigMap.get(status) ?? statusConfigMap.get(OrderStatus.DRAFT)!;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${config.color}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
};

async function getOrder(token: string) {
  try {
    const response = await ordersService.getOrderByPublicToken(token);

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  } catch {
    return null;
  }
}

export const metadata = {
  title: "تتبع حالة الطلب",
  description:
    "تابع حالة طلبك وتفاصيله والمنتجات المطلوبة في الوقت الفعلي وبكل سهولة.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TrackOrder({ params }: Props) {
  const { token } = await params;
  const order = await getOrder(token);

  if (!order) return notFound();

  return (
    <div className="overflow-hidden rounded-lg border border-brand-border bg-white shadow-soft">
      <div className="flex items-center gap-2 px-2">
        <SafeImage
          src="/logo.png"
          alt="Tijaratk"
          width={80}
          height={80}
          fallback={<div className="h-20 w-20 rounded-md bg-brand-soft" />}
        />
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg font-bold leading-6 text-brand-text">
            تفاصيل الطلب {order.tenant?.name && `من ${order.tenant.name}`}
          </h3>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              رقم التتبع: {order.public_token}
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/track-orders"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-brand-border bg-white px-3 py-1.5 text-xs font-medium text-brand-text transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
              >
                <TrackingOrdersIcon />
                كل طلباتي
              </Link>
              {order.tenant?.slug && (
                <Link
                  href={`/${order.tenant.slug}?reorder=${order.public_token}`}
                  className="inline-flex min-h-10 items-center rounded-full border border-transparent bg-brand-primary px-3 py-1.5 text-xs font-medium text-white shadow-soft transition-colors hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
                >
                  إعادة الطلب
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-brand-border">
        <dl>
          <div className="bg-brand-soft/50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-muted-foreground">
              الحالة
            </dt>
            <dd className="mt-1 text-sm text-brand-text sm:col-span-2 sm:mt-0">
              <StatusBadge status={order.status as OrderStatus} />
            </dd>
          </div>
          <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-muted-foreground">
              المتجر
            </dt>
            <dd className="mt-1 text-sm text-brand-text sm:col-span-2 sm:mt-0">
              {order.tenant?.name || "غير متوفر"}
            </dd>
          </div>
          <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-muted-foreground">
              تاريخ الطلب
            </dt>
            <dd className="mt-1 text-sm text-brand-text sm:col-span-2 sm:mt-0">
              {new Date(order.created_at).toLocaleString("ar-EG")}
            </dd>
          </div>
          <div className="bg-brand-soft/50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-muted-foreground">
              المجموع الفرعي
            </dt>
            <dd className="mt-1 text-sm text-brand-text sm:col-span-2 sm:mt-0">
              {order.subtotal !== null && order.subtotal !== undefined
                ? formatCurrency(Number(order.subtotal) || 0)
                : "السعر يتم تأكيده بعد الطلب"}
            </dd>
          </div>
          <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-muted-foreground">
              رسوم التوصيل
            </dt>
            <dd className="mt-1 text-sm text-brand-text sm:col-span-2 sm:mt-0">
              {formatCurrency(Number(order.delivery_fee) || 0)}
            </dd>
          </div>
          <div className="bg-brand-soft/50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-muted-foreground">
              الإجمالي
            </dt>
            <dd className="mt-1 text-sm font-bold text-brand-text sm:col-span-2 sm:mt-0">
              {order.total !== null && order.total !== undefined
                ? formatCurrency(Number(order.total) || 0)
                : "السعر يتم تأكيده بعد الطلب"}
            </dd>
          </div>
          <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-muted-foreground">
              العناصر
            </dt>
            <dd className="mt-1 text-sm text-brand-text sm:col-span-2 sm:mt-0">
              {order.items && order.items.length > 0 ? (
                <TrackingOrderItemsCard
                  token={order.public_token}
                  initialOrderStatus={order.status as OrderStatus}
                  initialItems={order.items}
                />
              ) : (
                <ul className="divide-y divide-brand-border rounded-md border border-brand-border">
                  <li className="py-3 pl-3 pr-4 text-sm italic text-muted-foreground">
                    {order.free_text_payload?.text ||
                      "لا يوجد عناصر أو ملاحظات"}
                  </li>
                </ul>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
