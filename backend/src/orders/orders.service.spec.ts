/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable sonarjs/no-nested-conditional */

jest.mock('src/customers/customers.service', () => ({
  CustomersService: class CustomersService {},
}));

import { Prisma } from '../../generated/prisma/client';
import {
  OrderSource,
  TenantCategory,
  TenantStatus,
} from '../../generated/prisma/client';
import { PricingMode } from 'src/common/enums/pricing-mode.enum';
import { OrderStatus } from 'src/common/enums/order-status.enum';
import { OrderType } from 'src/common/enums/order-type.enum';
import { UnavailableItemAction } from 'src/common/enums/unavailable-item-action.enum';
import { OrdersService } from './orders.service';
import {
  ACTIVE_PRODUCT_FOR_ORDERS_WHERE,
  MIN_ACTIVE_PRODUCTS_FOR_ORDERS,
} from 'src/products/order-readiness-policy';

const createOrderDto = (cardOnDeliveryRequested?: boolean) => ({
  customer: {
    name: 'Test Customer',
    phone: '01012345678',
    address: 'Test address',
  },
  order_type: OrderType.FREE_TEXT,
  free_text_payload: { text: 'Test order' },
  ...(cardOnDeliveryRequested === undefined
    ? {}
    : { card_on_delivery_requested: cardOnDeliveryRequested }),
});

const createOrderRecord = (data: any) => ({
  id: 10,
  tenant_id: data.tenant_id,
  customer_id: data.customer_id,
  public_token: data.public_token,
  order_type: data.order_type,
  status: data.status,
  pricing_mode: data.pricing_mode,
  subtotal: null,
  delivery_fee: new Prisma.Decimal(data.delivery_fee ?? 0),
  delivery_area_id: data.delivery_area_id ?? null,
  delivery_time_window_snapshot: data.delivery_time_window_snapshot ?? null,
  total: null,
  free_text_payload: data.free_text_payload ?? null,
  notes: data.notes ?? null,
  card_on_delivery_requested: data.card_on_delivery_requested,
  unavailable_item_action:
    data.unavailable_item_action ?? UnavailableItemAction.SUGGEST_REPLACEMENT,
  delivery_address: data.delivery_address ?? null,
  customer_phone: data.customer_phone ?? null,
  customer_name: data.customer_name ?? null,
  order_source: data.order_source,
  source_metadata: data.source_metadata ?? null,
  prescription_file_url: data.prescription_file_url ?? null,
  prescription_original_filename: data.prescription_original_filename ?? null,
  prescription_mime_type: data.prescription_mime_type ?? null,
  prescription_unavailability_action:
    data.prescription_unavailability_action ?? null,
  merchant_cancellation_reason: null,
  merchant_cancelled_at: null,
  customer_rejection_reason: null,
  customer_rejected_at: null,
  created_at: new Date('2026-06-19T06:00:00.000Z'),
  updated_at: new Date('2026-06-19T06:00:00.000Z'),
  deleted_at: null,
});

const createService = ({
  cardOnDeliveryAvailable = false,
}: { cardOnDeliveryAvailable?: boolean } = {}) => {
  let savedOrder: any;

  const manager = {
    $executeRaw: jest.fn(),
    tenantDirectoryProfile: {
      findUnique: jest.fn().mockResolvedValue({ area_id: null }),
    },
    tenantDeliveryArea: {
      findFirst: jest.fn(),
    },
    product: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        delivery_fee: 0,
        delivery_starts_at: null,
        delivery_ends_at: null,
        card_on_delivery_available: cardOnDeliveryAvailable,
      }),
    },
    order: {
      create: jest.fn().mockImplementation(({ data }) => {
        savedOrder = createOrderRecord(data);
        return Promise.resolve(savedOrder);
      }),
      update: jest.fn().mockImplementation(({ data }) => {
        savedOrder = {
          ...savedOrder,
          pricing_mode: data.pricing_mode ?? savedOrder.pricing_mode,
          subtotal:
            data.subtotal === undefined
              ? savedOrder.subtotal
              : data.subtotal === null
                ? null
                : new Prisma.Decimal(data.subtotal),
          total:
            data.total === undefined
              ? savedOrder.total
              : data.total === null
                ? null
                : new Prisma.Decimal(data.total),
        };
        return Promise.resolve(savedOrder);
      }),
      findFirst: jest.fn().mockImplementation(() =>
        Promise.resolve({
          ...savedOrder,
          customer: {
            id: 5,
            phone: savedOrder.customer_phone,
            name: savedOrder.customer_name,
            address: savedOrder.delivery_address,
          },
          order_items: [],
          tenant: {
            id: 1,
            name: 'Test Tenant',
            slug: 'test-tenant',
          },
          delivery_area: null,
        }),
      ),
    },
    orderItem: {
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    customer: {
      update: jest.fn().mockResolvedValue({}),
    },
  };

  const prisma = {
    $transaction: jest.fn((callback) => callback(manager)),
    order: manager.order,
  };
  const customersService = {
    findOrCreate: jest.fn().mockResolvedValue({
      id: 5,
      phone: '01012345678',
      name: 'Test Customer',
      address: 'Test address',
      global_customer_id: null,
      order_count: 1,
    }),
    ensureGlobalCustomerForTenantCustomer: jest.fn().mockResolvedValue({
      id: 2,
      access_code: 'A7K42Q9B',
    }),
    formatAccessCode: jest
      .fn()
      .mockImplementation((code: string) => `${code.slice(0, 4)}-${code.slice(4)}`),
  };
  const tenantsService = {};
  const orderWhatsappService = {
    notifySellerNewOrder: jest.fn().mockResolvedValue(undefined),
    notifyCustomerConfirmed: jest.fn().mockResolvedValue(undefined),
    notifyWelcomeCustomer: jest.fn().mockResolvedValue(undefined),
  };
  const tenantCancellationPolicyService = {
    recordMerchantCancellation: jest.fn().mockResolvedValue(undefined),
  };
  const service = new OrdersService(
    prisma as any,
    customersService as any,
    tenantsService as any,
    orderWhatsappService as any,
    tenantCancellationPolicyService as any,
  );

  return { service, manager, customersService, tenantCancellationPolicyService };
};

describe('OrdersService card-on-delivery persistence', () => {
  it('returns the generated global customer access code on order creation', async () => {
    const { service, customersService } = createService();

    const result = await service.createForTenantId(1, createOrderDto() as any);

    expect(customersService.ensureGlobalCustomerForTenantCustomer).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        id: 5,
        phone: '01012345678',
      }),
      'Test Customer',
    );
    expect(result).toEqual(
      expect.objectContaining({
        public_token: expect.any(String),
        customer_access_code: 'A7K4-2Q9B',
      }),
    );
  });

  it.each([
    [undefined, false, false],
    [undefined, true, false],
    [false, false, false],
    [false, true, false],
    [true, false, false],
    [true, true, true],
  ])(
    'persists customer request %s with tenant availability %s as %s',
    async (inputValue, tenantAvailability, expectedValue) => {
      const { service, manager } = createService({
        cardOnDeliveryAvailable: tenantAvailability,
      });

      const result = await service.createForTenantId(
        1,
        createOrderDto(inputValue) as any,
      );

      expect(manager.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            card_on_delivery_requested: expectedValue,
            order_source: OrderSource.storefront,
            pricing_mode: PricingMode.MANUAL,
            status: OrderStatus.DRAFT,
          }),
        }),
      );
      expect(result.card_on_delivery_requested).toBe(expectedValue);
    },
  );
});

describe('OrdersService unavailable item action persistence', () => {
  it.each([
    [undefined, UnavailableItemAction.SUGGEST_REPLACEMENT],
    [
      UnavailableItemAction.SUGGEST_REPLACEMENT,
      UnavailableItemAction.SUGGEST_REPLACEMENT,
    ],
    [UnavailableItemAction.DELETE_ITEM, UnavailableItemAction.DELETE_ITEM],
    [UnavailableItemAction.CANCEL_ORDER, UnavailableItemAction.CANCEL_ORDER],
  ])(
    'persists unavailable item action %s as %s',
    async (inputValue, expected) => {
      const { service, manager } = createService();

      const result = await service.createForTenantId(1, {
        ...createOrderDto(),
        ...(inputValue ? { unavailable_item_action: inputValue } : {}),
      } as any);

      expect(manager.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unavailable_item_action: expected,
          }),
        }),
      );
      expect(result.unavailable_item_action).toBe(expected);
    },
  );
});

describe('OrdersService prescription unavailability persistence', () => {
  const prescriptionUpload = {
    filename: 'prescription-test.pdf',
    mimetype: 'application/pdf',
    originalname: 'test-prescription.pdf',
    path: '/tmp/prescription-test.pdf',
  };

  it('persists the selected prescription unavailability action', async () => {
    const { service, manager } = createService();

    const result = await service.createForTenantId(
      1,
      {
        ...createOrderDto(),
        prescription_unavailability_action: 'alternative',
      } as any,
      prescriptionUpload,
    );

    expect(manager.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prescription_file_url: '/uploads/prescriptions/prescription-test.pdf',
          prescription_original_filename: 'test-prescription.pdf',
          prescription_mime_type: 'application/pdf',
          prescription_unavailability_action: 'alternative',
        }),
      }),
    );
    expect(result.prescription_unavailability_action).toBe('alternative');
  });

  it('trims and limits the persisted prescription unavailability action', async () => {
    const { service, manager } = createService();
    const rawAction = `  ${'x'.repeat(80)}  `;
    const expectedAction = 'x'.repeat(64);

    const result = await service.createForTenantId(
      1,
      {
        ...createOrderDto(),
        prescription_unavailability_action: rawAction,
      } as any,
      prescriptionUpload,
    );

    expect(manager.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prescription_unavailability_action: expectedAction,
        }),
      }),
    );
    expect(result.prescription_unavailability_action).toBe(expectedAction);
  });
});

const createPublicOrderGuardService = (activeProductsCount: number) => {
  return createPublicOrderGuardServiceForCategory(
    activeProductsCount,
    TenantCategory.grocery,
  );
};

const createPublicOrderGuardServiceForCategory = (
  activeProductsCount: number,
  tenantCategory: TenantCategory,
) => {
  const prisma = {
    product: {
      count: jest.fn().mockResolvedValue(activeProductsCount),
    },
  };
  const tenantsService = {
    findOneBySlug: jest.fn().mockResolvedValue({
      id: 1,
      slug: 'test-tenant',
      status: TenantStatus.active,
      category: tenantCategory,
      delivery_available: true,
      onboarding_completed: true,
    }),
  };
  const service = new OrdersService(
    prisma as any,
    {} as any,
    tenantsService as any,
    {} as any,
    {} as any,
  );

  return { service, prisma, tenantsService };
};

describe('OrdersService product order readiness guard', () => {
  it('rejects public orders below the active product threshold', async () => {
    const { service, prisma } = createPublicOrderGuardService(
      MIN_ACTIVE_PRODUCTS_FOR_ORDERS - 1,
    );
    const createForTenantIdSpy = jest.spyOn(service, 'createForTenantId');

    await expect(
      service.createForTenantSlug('test-tenant', createOrderDto() as any),
    ).rejects.toThrow('عذراً، هذا المتجر غير مستعد لاستقبال الطلبات حالياً.');

    expect(createForTenantIdSpy).not.toHaveBeenCalled();
    expect(prisma.product.count).toHaveBeenCalledWith({
      where: {
        tenant_id: 1,
        ...ACTIVE_PRODUCT_FOR_ORDERS_WHERE,
      },
    });
  });

  it('continues public order creation at the active product threshold', async () => {
    const { service } = createPublicOrderGuardService(
      MIN_ACTIVE_PRODUCTS_FOR_ORDERS,
    );
    const expectedOrder = { id: 10 };
    const createForTenantIdSpy = jest
      .spyOn(service, 'createForTenantId')
      .mockResolvedValue(expectedOrder as any);

    await expect(
      service.createForTenantSlug('test-tenant', createOrderDto() as any),
    ).resolves.toBe(expectedOrder);

    expect(createForTenantIdSpy).toHaveBeenCalledWith(
      1,
      createOrderDto(),
      undefined,
    );
  });

  it('continues public order creation at the lightweight threshold for other tenants', async () => {
    const { service } = createPublicOrderGuardServiceForCategory(
      50,
      TenantCategory.other,
    );
    const expectedOrder = { id: 10 };
    const createForTenantIdSpy = jest
      .spyOn(service, 'createForTenantId')
      .mockResolvedValue(expectedOrder as any);

    await expect(
      service.createForTenantSlug('test-tenant', createOrderDto() as any),
    ).resolves.toBe(expectedOrder);

    expect(createForTenantIdSpy).toHaveBeenCalledWith(
      1,
      createOrderDto(),
      undefined,
    );
  });

  it('rejects public orders below the lightweight threshold for other tenants', async () => {
    const { service } = createPublicOrderGuardServiceForCategory(
      49,
      TenantCategory.other,
    );
    const createForTenantIdSpy = jest.spyOn(service, 'createForTenantId');

    await expect(
      service.createForTenantSlug('test-tenant', createOrderDto() as any),
    ).rejects.toThrow('عذراً، هذا المتجر غير مستعد لاستقبال الطلبات حالياً.');

    expect(createForTenantIdSpy).not.toHaveBeenCalled();
  });
});

const createUpdateService = (status: OrderStatus) => {
  const order = {
    id: 50,
    tenant_id: 1,
    customer_id: 7,
    public_token: 'token',
    order_type: OrderType.FREE_TEXT,
    status,
    pricing_mode: PricingMode.MANUAL,
    subtotal: null,
    delivery_fee: new Prisma.Decimal(0),
    delivery_area_id: null,
    delivery_time_window_snapshot: null,
    total: null,
    free_text_payload: null,
    notes: null,
    card_on_delivery_requested: false,
    unavailable_item_action: UnavailableItemAction.SUGGEST_REPLACEMENT,
    delivery_address: null,
    customer_phone: '01012345678',
    customer_name: 'Test Customer',
    order_source: OrderSource.storefront,
    source_metadata: null,
    prescription_file_url: null,
    prescription_original_filename: null,
    prescription_mime_type: null,
    prescription_unavailability_action: null,
    merchant_cancellation_reason: null,
    merchant_cancelled_at: null,
    customer_rejection_reason: null,
    customer_rejected_at: null,
    created_at: new Date('2026-06-19T06:00:00.000Z'),
    updated_at: new Date('2026-06-19T06:00:00.000Z'),
    deleted_at: null,
    customer: { id: 7 },
    tenant: { id: 1, status: TenantStatus.active },
    delivery_area: null,
    order_items: [],
  };
  const manager = {
    order: {
      findFirst: jest.fn().mockResolvedValue(order),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          ...order,
          ...data,
          status: data.status ?? order.status,
        }),
      ),
    },
    customer: {
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(manager)),
  };
  const orderWhatsappService = {
    notifyCustomerStatusUpdate: jest.fn().mockResolvedValue(undefined),
  };
  const tenantCancellationPolicyService = {
    recordMerchantCancellation: jest.fn().mockResolvedValue(undefined),
  };
  const service = new OrdersService(
    prisma as any,
    {} as any,
    {} as any,
    orderWhatsappService as any,
    tenantCancellationPolicyService as any,
  );

  return { service, tenantCancellationPolicyService };
};

describe('OrdersService cancellation policy counting', () => {
  it('counts merchant cancelled transitions', async () => {
    const { service, tenantCancellationPolicyService } = createUpdateService(
      OrderStatus.CONFIRMED,
    );

    await service.update(50, { status: OrderStatus.CANCELLED } as any);

    expect(
      tenantCancellationPolicyService.recordMerchantCancellation,
    ).toHaveBeenCalledWith(1, 50, expect.any(Object));
  });

  it('does not count customer rejection transitions', async () => {
    const { service, tenantCancellationPolicyService } = createUpdateService(
      OrderStatus.CONFIRMED,
    );

    await service.update(50, {
      status: OrderStatus.REJECTED_BY_CUSTOMER,
    } as any);

    expect(
      tenantCancellationPolicyService.recordMerchantCancellation,
    ).not.toHaveBeenCalled();
  });

  it('does not double count already-cancelled orders', async () => {
    const { service, tenantCancellationPolicyService } = createUpdateService(
      OrderStatus.CANCELLED,
    );

    await service.update(50, { status: OrderStatus.CANCELLED } as any);

    expect(
      tenantCancellationPolicyService.recordMerchantCancellation,
    ).not.toHaveBeenCalled();
  });
});

const createUpdateOrderItemPriceService = () => {
  const order = {
    id: 50,
    tenant_id: 1,
    status: OrderStatus.CONFIRMED,
    delivery_fee: new Prisma.Decimal(10),
  };
  const orderItem = {
    id: 70,
    order_id: order.id,
    product_id: 30,
    replaced_by_product_id: null,
    quantity: '2',
    total_price: new Prisma.Decimal(40),
    unit_price: new Prisma.Decimal(20),
    order,
  };
  const activePriceHistory = {
    id: 90,
    tenant_id: 1,
    product_id: 30,
    price: new Prisma.Decimal(20),
    effective_to: null,
  };
  const manager = {
    $executeRaw: jest.fn(),
    orderItem: {
      findFirst: jest.fn().mockResolvedValue(orderItem),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          ...orderItem,
          ...data,
        }),
      ),
      findMany: jest
        .fn()
        .mockResolvedValue([{ total_price: new Prisma.Decimal(60) }]),
    },
    order: {
      findFirst: jest.fn().mockResolvedValue(order),
      update: jest.fn().mockResolvedValue({}),
    },
    product: {
      findFirst: jest.fn().mockResolvedValue({
        id: 30,
        tenant_id: 1,
        current_price: new Prisma.Decimal(20),
      }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    productPriceHistory: {
      findFirst: jest.fn().mockResolvedValue(activePriceHistory),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(manager)),
  };
  const service = new OrdersService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  return { service, manager };
};

describe('OrdersService updateOrderItemPrice', () => {
  it('updates the merchant product price when an order item price changes', async () => {
    const { service, manager } = createUpdateOrderItemPriceService();

    await service.updateOrderItemPrice(1, 70, 60);

    expect(manager.orderItem.update).toHaveBeenCalledWith({
      where: { id: 70 },
      data: {
        total_price: new Prisma.Decimal(60),
        unit_price: new Prisma.Decimal(30),
      },
    });
    expect(manager.productPriceHistory.update).toHaveBeenCalledWith({
      where: { id: 90 },
      data: { effective_to: expect.any(Date) },
    });
    expect(manager.productPriceHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenant_id: 1,
        product_id: 30,
        price: 30,
        reason: 'manual update from order item',
      }),
    });
    expect(manager.product.update).toHaveBeenCalledWith({
      where: { id: 30 },
      data: { current_price: 30 },
    });
  });
});

describe('OrdersService markOrderItemOutOfStock', () => {
  it('marks the item unavailable, disables the product, and recalculates totals', async () => {
    const { service, manager } = createUpdateOrderItemPriceService();

    await service.markOrderItemOutOfStock(1, 70);

    expect(manager.orderItem.update).toHaveBeenCalledWith({
      where: { id: 70 },
      data: {
        is_out_of_stock: true,
        out_of_stock_at: expect.any(Date),
        total_price: new Prisma.Decimal(0),
        unit_price: new Prisma.Decimal(0),
      },
    });
    expect(manager.product.updateMany).toHaveBeenCalledWith({
      where: {
        id: 30,
        tenant_id: 1,
      },
      data: { is_available: false },
    });
    expect(manager.orderItem.findMany).toHaveBeenCalledWith({
      where: { order_id: 50, is_out_of_stock: false },
      select: { total_price: true },
    });
    expect(manager.order.update).toHaveBeenCalledWith({
      where: { id: 50 },
      data: {
        pricing_mode: PricingMode.MANUAL,
        subtotal: new Prisma.Decimal(60),
        total: new Prisma.Decimal(70),
      },
    });
  });
});

describe('OrdersService findByPublicToken', () => {
  it('throws NotFoundException if order is not found', async () => {
    const { service, manager } = createService();
    jest.spyOn(manager.order, 'findFirst').mockResolvedValue(null);

    await expect(service.findByPublicToken('token')).rejects.toThrow(
      'Order with token token not found',
    );
  });

  it.each([OrderStatus.CANCELLED, OrderStatus.REJECTED_BY_CUSTOMER])(
    'throws NotFoundException if order is %s',
    async (status) => {
      const { service, manager } = createService();
      jest.spyOn(manager.order, 'findFirst').mockResolvedValue({
        status,
        public_token: 'token',
        order_items: [],
        tenant: { id: 1, name: 'Test Tenant', slug: 'test-tenant' },
      } as any);

      await expect(service.findByPublicToken('token')).rejects.toThrow(
        'Order with token token not found',
      );
    },
  );

  it.each([
    OrderStatus.DRAFT,
    OrderStatus.CONFIRMED,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.COMPLETED,
  ])('returns the order if status is %s', async (status) => {
    const { service, manager } = createService();
    const mockOrder = {
      status,
      public_token: 'token',
      order_items: [],
      tenant: { id: 1, name: 'Test Tenant', slug: 'test-tenant' },
    };
    jest.spyOn(manager.order, 'findFirst').mockResolvedValue(mockOrder as any);

    const result = await service.findByPublicToken('token');
    expect(result).toBeDefined();
    expect(result.status).toBe(status);
  });
});
