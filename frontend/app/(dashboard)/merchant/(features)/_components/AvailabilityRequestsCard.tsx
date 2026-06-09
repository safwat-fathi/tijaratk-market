import Link from 'next/link';
import { MerchantAvailabilitySummaryResponse } from '@/types/services/availability-requests';
import { formatArabicInteger } from '@/lib/utils/number';

type AvailabilityRequestsCardProps = {
  summary: MerchantAvailabilitySummaryResponse;
};

function formatRequestedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function AvailabilityRequestsCard({
  summary,
}: AvailabilityRequestsCardProps) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-gray-900">طلبات توفير المنتجات</h2>
        <div className="flex items-center gap-2">
          <Link href="/merchant/availability-requests" className="text-xs font-semibold text-amber-800 underline-offset-4 hover:underline">
            عرض الكل
          </Link>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
            {formatArabicInteger(summary.today_total_requests) || summary.today_total_requests} اليوم
          </span>
        </div>
      </div>

      {summary.top_products.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-amber-300 bg-white px-3 py-2 text-sm text-gray-600">
          لا توجد طلبات توفير اليوم.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {summary.top_products.map((item) => (
            <li
              key={item.item_key}
              className="flex items-center justify-between rounded-xl border border-amber-200 bg-white px-3 py-2"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">{item.product_name}</p>
                <p className="text-xs text-gray-500">
                  آخر طلب: {formatRequestedAt(item.last_requested_at)}
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                {formatArabicInteger(item.requests_count) || item.requests_count} طلب
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
