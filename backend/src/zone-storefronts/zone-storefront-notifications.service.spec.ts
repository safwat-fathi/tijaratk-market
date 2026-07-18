import { ZoneStorefrontNotificationsService } from './zone-storefront-notifications.service';

describe('ZoneStorefrontNotificationsService new-order notification', () => {
  const sendTemplatedMessage = jest.fn();
  const service = new ZoneStorefrontNotificationsService({
    sendTemplatedMessage,
  } as any);

  beforeEach(() => {
    sendTemplatedMessage.mockReset();
    sendTemplatedMessage.mockResolvedValue(undefined);
  });

  it('notifies operations without sending a customer acknowledgement', async () => {
    await service.notifyNewOrder({
      dispatchId: 7,
      orderNumber: '42',
      zoneName: 'الدقي',
      area: 'الدقي',
      operationsPhone: '01098765432',
      total: 125.5,
    });

    expect(sendTemplatedMessage).toHaveBeenCalledTimes(1);
    expect(sendTemplatedMessage).toHaveBeenCalledWith({
      key: 'zone_order_operations',
      to: '01098765432',
      payload: {
        orderNumber: '42',
        zoneName: 'الدقي',
        area: 'الدقي',
        totalEgp: 125.5,
      },
    });
  });
});
