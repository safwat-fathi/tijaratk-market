type OrderNotesSectionProps = {
  orderRequest: string;
  onOrderRequestChange: (value: string) => void;
  error?: string;
  isPharmacy?: boolean;
};

export default function OrderNotesSection({
  orderRequest,
  onOrderRequestChange,
  error,
  isPharmacy,
}: OrderNotesSectionProps) {
  return (
    <div
      id="order-notes"
      data-customer-tour="manual-order"
      className="mt-4 scroll-mt-52 rounded-lg border border-brand-border bg-white p-5 shadow-soft transition-[box-shadow] focus-within:ring-4 focus-within:ring-brand-accent/15"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="rounded-md bg-status-warning/25 p-2.5 text-amber-800">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </div>
        <div className="flex flex-col">
          {/* <h2 className="text-xl font-bold text-gray-900">ملاحظات الطلب</h2> */}
          <h2 className="text-xl font-bold text-brand-text">طلب يدوي</h2>
          <p className="text-brand-text">
            مش لاقي اللي انت عايزه؟ اكتبه هنا وإحنا هنوفره لو متاح
          </p>
        </div>
      </div>

      <textarea
        id="order-request-textarea"
        name="order_request"
        placeholder={
          isPharmacy
            ? "شريط كاتفلام أو كريم شعر"
            : "مثال: 1 كجم طماطم، 2 كيلو سكر…\nعيش، لبن، زيت\n"
        }
        className="h-22 w-full resize-none rounded-md border border-brand-border bg-brand-soft/40 p-4 text-base transition-colors focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
        value={orderRequest}
        onChange={(e) => onOrderRequestChange(e.target.value)}
      />
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
        ملاحظات: المتجر هيتواصل معاك لتأكيد السعر والتوفر قبل التنفيذ
      </p>
      {error && (
        <p className="mt-2 text-sm font-medium text-status-error">{error}</p>
      )}
    </div>
  );
}
