export const newOrderSeller = ({
  orderId,
  customerName,
  customerPhone,
  deliveryAddress,
  orderDetails,
  total,
}: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  orderDetails: string;
  total: number;
}) => `
تم تسجيل طلب جديد على حسابك.

رقم الطلب: ${orderId}
اسم العميل: ${customerName}
رقم الهاتف: ${customerPhone}
العنوان: ${deliveryAddress}
تفاصيل الطلب: ${orderDetails}
الإجمالي المبدئي: ${total} جنيه
`;
