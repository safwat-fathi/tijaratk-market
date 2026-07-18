import { OrderWhatsappService } from './order-whatsapp.service';

describe('OrderWhatsappService merchant new-order notification', () => {
  const sendTemplatedMessage = jest.fn();
  const service = new OrderWhatsappService(
    { sendTemplatedMessage } as any,
    {} as any,
  );

  beforeEach(() => {
    sendTemplatedMessage.mockReset();
    sendTemplatedMessage.mockResolvedValue(undefined);
  });

  it('builds one-line item details from unit prices', async () => {
    await service.notifySellerNewOrder({
      id: 42,
      customer_name: 'أحمد',
      customer_phone: '+201001234567',
      delivery_address: '12 شارع التحرير',
      total: 87.5,
      tenant: { phone: '01098765432' },
      items: [
        { name_snapshot: 'أرز بسمتي', unit_price: 25 },
        { name_snapshot: 'لبن\nكامل الدسم', unit_price: 12.5 },
        { name_snapshot: 'دواء', unit_price: null },
        { name_snapshot: 'مياه', unit_price: 0 },
      ],
    } as any);

    expect(sendTemplatedMessage).toHaveBeenCalledWith({
      key: 'new_order_merchant',
      to: '01098765432',
      payload: {
        orderNumber: '42',
        customerName: 'أحمد',
        customerPhone: '+201001234567',
        deliveryAddress: '12 شارع التحرير',
        orderDetails:
          'أرز بسمتي: 25, لبن كامل الدسم: 12.5, دواء: السعر يحدد لاحقاً, مياه: 0',
        initialTotalEgp: 87.5,
      },
    });
  });

  it('uses non-empty customer, address, and empty-item fallbacks', async () => {
    await service.notifySellerNewOrder({
      id: 43,
      total: null,
      tenant: { phone: '01098765432' },
      customer: { phone: '01001234567', address: 'الدقي' },
      order_items: [],
    } as any);

    expect(sendTemplatedMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          customerName: 'عميل',
          customerPhone: '01001234567',
          deliveryAddress: 'الدقي',
          orderDetails: 'تفاصيل الأصناف غير متاحة',
          initialTotalEgp: 0,
        }),
      }),
    );
  });

  it('caps long details without splitting later item segments', async () => {
    await service.notifySellerNewOrder({
      id: 44,
      customer_name: 'أحمد',
      customer_phone: '01001234567',
      delivery_address: 'الدقي',
      total: 10,
      tenant: { phone: '01098765432' },
      items: [
        { name_snapshot: 'أ'.repeat(990), unit_price: 1 },
        { name_snapshot: 'منتج ثان', unit_price: 2 },
      ],
    } as any);

    const details = sendTemplatedMessage.mock.calls[0][0].payload.orderDetails;
    expect(details.length).toBeLessThanOrEqual(1000);
    expect(details.endsWith(', …')).toBe(true);
    expect(details).not.toContain('منتج ثان');
  });
});
