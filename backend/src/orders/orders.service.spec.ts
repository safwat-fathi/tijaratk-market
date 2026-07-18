import { BadRequestException, Logger } from '@nestjs/common';
import { ActivityActions } from 'src/activity-log/constants/activity-actions';
import { ActivitySources } from 'src/activity-log/constants/activity-types';
import { OrderStatus } from 'src/common/enums/order-status.enum';
import { OrdersService } from './orders.service';

describe('OrdersService markOrderItemOutOfStock', () => {
  const tenantId = 7;
  const orderId = 41;
  const itemId = 91;
  const productId = 121;

  const createFixture = ({
    status = OrderStatus.DRAFT,
    deliverableItemCount = 1,
    dispatchId = null,
  }: {
    status?: OrderStatus;
    deliverableItemCount?: number;
    dispatchId?: number | null;
  } = {}) => {
    const order = {
      id: orderId,
      tenant_id: tenantId,
      customer_id: 15,
      customer_phone: '201001234567',
      customer_name: 'عميل الاختبار',
      status,
      delivery_fee: 15,
      total: 115,
      subtotal: 100,
    };
    const orderItem = {
      id: itemId,
      order_id: orderId,
      product_id: productId,
      name_snapshot: 'منتج الاختبار',
      is_out_of_stock: false,
      total_price: 100,
      unit_price: 100,
      order,
    };
    const savedItem = {
      ...orderItem,
      is_out_of_stock: true,
      total_price: 0,
      unit_price: 0,
    };
    const cancelledOrder = {
      ...order,
      status: OrderStatus.CANCELLED,
      merchant_cancellation_reason: 'جميع منتجات الطلب غير متوفرة',
      customer: null,
      order_items: [savedItem],
      tenant: { id: tenantId, name: 'متجر الاختبار', slug: 'test-store' },
      delivery_area: null,
    };

    const manager = {
      $executeRaw: jest.fn(),
      orderItem: {
        findFirst: jest.fn().mockResolvedValue(orderItem),
        count: jest.fn().mockResolvedValue(deliverableItemCount),
        update: jest.fn().mockResolvedValue(savedItem),
        findMany: jest.fn().mockResolvedValue([]),
      },
      product: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        findFirst: jest.fn().mockResolvedValue(order),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve(
            data.status === OrderStatus.CANCELLED
              ? { ...cancelledOrder, ...data }
              : { ...order, ...data },
          ),
        ),
      },
      orderDispatch: {
        findUnique: jest
          .fn()
          .mockResolvedValue(dispatchId ? { id: dispatchId } : null),
        update: jest.fn().mockResolvedValue({}),
      },
      orderDispatchAssignment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof manager) => Promise<unknown>) =>
          callback(manager),
      ),
    };
    const whatsapp = {
      notifyCustomerStatusUpdate: jest.fn().mockResolvedValue(undefined),
    };
    const cancellationPolicy = {
      recordMerchantCancellation: jest.fn().mockResolvedValue(undefined),
    };
    const activityLog = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const cache = {
      set: jest.fn().mockResolvedValue(undefined),
    };
    const service = new OrdersService(
      prisma as any,
      {} as any,
      {} as any,
      whatsapp as any,
      cancellationPolicy as any,
      activityLog as any,
      {} as any,
      {} as any,
      cache as any,
    );

    return {
      service,
      prisma,
      manager,
      whatsapp,
      cancellationPolicy,
      activityLog,
      cache,
    };
  };

  it.each([OrderStatus.DRAFT, OrderStatus.CONFIRMED])(
    'cancels a %s order after its last deliverable item is unavailable',
    async (status) => {
      const fixture = createFixture({ status });

      const result = await fixture.service.markOrderItemOutOfStock(
        tenantId,
        itemId,
        { userId: 33, source: 'dashboard' },
      );

      expect(result).toEqual(
        expect.objectContaining({ id: itemId, is_out_of_stock: true }),
      );
      expect(fixture.manager.product.updateMany).toHaveBeenCalledWith({
        where: { id: productId, tenant_id: tenantId },
        data: { is_available: false },
      });
      expect(fixture.manager.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OrderStatus.CANCELLED,
            merchant_cancellation_reason:
              'جميع منتجات الطلب غير متوفرة',
            merchant_cancelled_at: expect.any(Date),
          }),
        }),
      );
      expect(
        fixture.cancellationPolicy.recordMerchantCancellation,
      ).toHaveBeenCalledWith(
        tenantId,
        orderId,
        fixture.manager,
        'merchant',
      );
      expect(fixture.activityLog.create).toHaveBeenCalledTimes(2);
      expect(fixture.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ActivityActions.OrderItemOutOfStock,
          actorUserId: 33,
        }),
        fixture.manager,
      );
      expect(fixture.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ActivityActions.OrderCancelled,
          actorUserId: 33,
        }),
        fixture.manager,
      );
      expect(fixture.whatsapp.notifyCustomerStatusUpdate).toHaveBeenCalledTimes(
        1,
      );
      expect(fixture.cache.set).toHaveBeenCalledTimes(1);
      expect(fixture.prisma.$transaction).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps the order active while another deliverable item remains', async () => {
    const fixture = createFixture({ deliverableItemCount: 2 });

    await fixture.service.markOrderItemOutOfStock(tenantId, itemId);

    expect(fixture.manager.order.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: OrderStatus.CANCELLED }),
      }),
    );
    expect(
      fixture.cancellationPolicy.recordMerchantCancellation,
    ).not.toHaveBeenCalled();
    expect(fixture.whatsapp.notifyCustomerStatusUpdate).not.toHaveBeenCalled();
    expect(fixture.activityLog.create).toHaveBeenCalledTimes(1);
  });

  it('cancels a dispatch and its current assignments through the shared flow', async () => {
    const fixture = createFixture({ dispatchId: 301 });

    await fixture.service.markOrderItemOutOfStock(tenantId, itemId, {
      adminId: 44,
      source: ActivitySources.Admin,
    });

    expect(fixture.manager.orderDispatch.update).toHaveBeenCalledWith({
      where: { id: 301 },
      data: expect.objectContaining({
        status: 'cancelled',
        cancellation_reason: 'جميع منتجات الطلب غير متوفرة',
        cancelled_by_admin_id: 44,
      }),
    });
    expect(
      fixture.manager.orderDispatchAssignment.updateMany,
    ).toHaveBeenCalledWith({
      where: { order_dispatch_id: 301, is_current: true },
      data: expect.objectContaining({
        status: 'cancelled',
        is_current: false,
      }),
    });
    expect(
      fixture.cancellationPolicy.recordMerchantCancellation,
    ).not.toHaveBeenCalled();
    expect(fixture.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: ActivityActions.OrderCancelled,
        actorAdminId: 44,
      }),
      fixture.manager,
    );
  });

  it.each([OrderStatus.OUT_FOR_DELIVERY, OrderStatus.COMPLETED])(
    'rejects marking an item unavailable while the order is %s',
    async (status) => {
      const fixture = createFixture({ status });

      await expect(
        fixture.service.markOrderItemOutOfStock(tenantId, itemId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fixture.manager.orderItem.count).not.toHaveBeenCalled();
      expect(fixture.manager.orderItem.update).not.toHaveBeenCalled();
      expect(fixture.manager.product.updateMany).not.toHaveBeenCalled();
    },
  );
});

describe('OrdersService new-order notifications', () => {
  it('notifies only the merchant when an order is created', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const orderWhatsappService = {
      notifySellerNewOrder: jest.fn().mockResolvedValue(undefined),
    };
    const service = new OrdersService(
      {} as any,
      {} as any,
      {} as any,
      orderWhatsappService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await (service as any).notifyOrderCreated({ id: 42 });

    expect(orderWhatsappService.notifySellerNewOrder).toHaveBeenCalledWith({
      id: 42,
    });
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
