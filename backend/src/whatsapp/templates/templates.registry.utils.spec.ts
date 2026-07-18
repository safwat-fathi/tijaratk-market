import {
  buildContentVariables,
  validateTemplatePayload,
} from './templates.registry.utils';

describe('WhatsApp template registry', () => {
  it('serializes the approved new-order merchant variables in positions 1-6', () => {
    const payload = validateTemplatePayload('new_order_merchant', {
      orderNumber: '42',
      customerName: 'أحمد محمد',
      customerPhone: '+201001234567',
      deliveryAddress: '12 شارع التحرير',
      orderDetails: 'أرز: 25, لبن: السعر يحدد لاحقاً',
      initialTotalEgp: 125.5,
    });

    expect(
      JSON.parse(buildContentVariables('new_order_merchant', payload)),
    ).toEqual({
      '1': '42',
      '2': 'أحمد محمد',
      '3': '+201001234567',
      '4': '12 شارع التحرير',
      '5': 'أرز: 25, لبن: السعر يحدد لاحقاً',
      '6': '125.5',
    });
  });

  it('normalizes newlines, tabs, and repeated whitespace in every variable', () => {
    const payload = validateTemplatePayload('new_order_merchant', {
      orderNumber: '  42  ',
      customerName: 'أحمد\nمحمد',
      customerPhone: '+201001234567',
      deliveryAddress: '12 شارع\tالتحرير     الدقي',
      orderDetails: 'أرز: 25\nلبن: 30',
      initialTotalEgp: 55,
    });

    expect(
      JSON.parse(buildContentVariables('new_order_merchant', payload)),
    ).toEqual({
      '1': '42',
      '2': 'أحمد محمد',
      '3': '+201001234567',
      '4': '12 شارع التحرير الدقي',
      '5': 'أرز: 25 لبن: 30',
      '6': '55',
    });
  });

  it('rejects empty Content variables before calling Twilio', () => {
    expect(() =>
      buildContentVariables(
        'order_status_update_customer',
        {
          customerName: 'عميل',
          orderNumber: '42',
          statusLabel: '\n\t',
        } as any,
      ),
    ).toThrow('variable statusLabel cannot be empty');
  });

  it('rejects Content variables above Twilio text limits', () => {
    expect(() =>
      buildContentVariables(
        'order_status_update_customer',
        {
          customerName: 'عميل',
          orderNumber: '42',
          statusLabel: 'أ'.repeat(1601),
        } as any,
      ),
    ).toThrow('variable statusLabel exceeds 1600 characters');
  });
});
