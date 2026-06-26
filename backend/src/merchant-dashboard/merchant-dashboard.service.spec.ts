import { DbTenantContext } from 'src/common/contexts/db-tenant.context';
import { MerchantDashboardService } from './merchant-dashboard.service';
import {
  OrderSource,
  OrderStatus,
  Prisma,
  TenantCategory,
} from '../../generated/prisma/client';

const createPrismaMock = (input: {
  orders?: any[];
  activeCustomers?: Array<{ customer_id: number }>;
  previousTotalOrders?: number;
  previousCompletedOrders?: number;
  previousCancelledOrders?: number;
  previousSales?: number;
  newCustomers?: number;
  returningCustomers?: number;
  availabilityRequests?: number;
  tenantStatus?: OrderStatus | string;
  tenantCategory?: TenantCategory;
  activeProductsCount?: number;
}) => {
  const orders = input.orders ?? [];
  const completedOrders = orders.filter(
    (order) => order.status === OrderStatus.completed,
  );
  const cancelledOrders = orders.filter(
    (order) =>
      order.status === OrderStatus.cancelled ||
      order.status === OrderStatus.rejected_by_customer,
  );
  const currentSales = completedOrders.reduce(
    (sum, order) => sum + Number(order.total ?? 0),
    0,
  );

  return {
    order: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(orders)
        .mockResolvedValueOnce(completedOrders)
        .mockResolvedValueOnce(input.activeCustomers ?? []),
      count: jest
        .fn()
        .mockResolvedValueOnce(orders.length)
        .mockResolvedValueOnce(completedOrders.length)
        .mockResolvedValueOnce(cancelledOrders.length)
        .mockResolvedValueOnce(input.previousTotalOrders ?? 0)
        .mockResolvedValueOnce(input.previousCompletedOrders ?? 0)
        .mockResolvedValueOnce(input.previousCancelledOrders ?? 0),
      aggregate: jest
        .fn()
        .mockResolvedValueOnce({
          _sum: { total: currentSales },
        })
        .mockResolvedValueOnce({
          _sum: { total: input.previousSales ?? 0 },
        }),
    },
    customer: {
      count: jest
        .fn()
        .mockResolvedValueOnce(input.newCustomers ?? 0)
        .mockResolvedValueOnce(input.returningCustomers ?? 0),
    },
    availabilityRequest: {
      count: jest.fn().mockResolvedValue(input.availabilityRequests ?? 0),
    },
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        status: input.tenantStatus ?? 'active',
        category: input.tenantCategory ?? TenantCategory.grocery,
      }),
    },
    product: {
      count: jest.fn().mockResolvedValue(input.activeProductsCount ?? 0),
    },
  };
};

const createPolicyMock = (overrides: Record<string, unknown> = {}) => ({
  getSnapshot: jest.fn().mockResolvedValue({
    status: 'ok',
    count: 0,
    warning_threshold: 10,
    suspension_threshold: 16,
    remaining_before_suspension: 16,
    window_start: '2026-06-01T00:00:00.000Z',
    window_end: '2026-06-30T20:59:59.999Z',
    is_probation: false,
    last_warning_at: null,
    last_suspension_at: null,
    ...overrides,
  }),
});

describe('MerchantDashboardService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-18T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns zeroed MVP measurements for an empty period', async () => {
    const prisma = createPrismaMock({});
    const policy = createPolicyMock();
    const service = new MerchantDashboardService(prisma as any, policy as any);

    const result = await service.getMeasurements(1, 'today');

    expect(result.total_orders.value).toBe(0);
    expect(result.completed_orders_rate.percentage).toBe(0);
    expect(result.cancelled_orders_rate.percentage).toBe(0);
    expect(result.total_sales.value).toBe(0);
    expect(result.average_order_value).toBe(0);
    expect(result.returning_customers_rate.percentage).toBe(0);
    expect(result.top_selling_products).toEqual([]);
    expect(result.orders_by_source).toEqual([]);
    expect(result.cancellation_policy.status).toBe('ok');
    expect(result.product_readiness).toEqual({
      active_products_count: 0,
      required_products_count: 100,
      remaining_products_count: 100,
      completion_percentage: 0,
      status: 'not_ready_for_orders',
      milestones: [25, 50, 75, 100],
    });
  });

  it('calculates sales, rates, customers, availability, products, and source buckets', async () => {
    const prisma = createPrismaMock({
      orders: [
        {
          id: 1,
          status: OrderStatus.completed,
          total: new Prisma.Decimal(150),
          order_source: OrderSource.storefront,
          source_metadata: { landingSource: 'qr' },
          customer_id: 10,
          order_items: [
            {
              name_snapshot: 'Panadol Extra',
              quantity: '2',
              selection_quantity: null,
            },
          ],
        },
        {
          id: 2,
          status: OrderStatus.completed,
          total: new Prisma.Decimal(50),
          order_source: OrderSource.directory,
          source_metadata: { landingSource: 'directory' },
          customer_id: 11,
          order_items: [
            {
              name_snapshot: 'Panadol Extra',
              quantity: '1',
              selection_quantity: null,
            },
            {
              name_snapshot: 'Nescafe Gold',
              quantity: 'custom',
              selection_quantity: new Prisma.Decimal(1.5),
            },
          ],
        },
        {
          id: 3,
          status: OrderStatus.cancelled,
          total: new Prisma.Decimal(80),
          order_source: OrderSource.whatsapp,
          source_metadata: null,
          customer_id: 12,
          order_items: [],
        },
        {
          id: 4,
          status: OrderStatus.rejected_by_customer,
          total: new Prisma.Decimal(90),
          order_source: OrderSource.manual,
          source_metadata: null,
          customer_id: 13,
          order_items: [],
        },
      ],
      activeCustomers: [{ customer_id: 10 }, { customer_id: 11 }],
      previousTotalOrders: 2,
      previousSales: 100,
      newCustomers: 3,
      returningCustomers: 1,
      availabilityRequests: 7,
      activeProductsCount: 125,
    });
    const service = new MerchantDashboardService(
      prisma as any,
      createPolicyMock() as any,
    );

    const result = await service.getMeasurements(1, '7d');

    expect(result.total_orders.value).toBe(4);
    expect(result.total_orders.change_percentage).toBe(100);
    expect(result.completed_orders_rate).toEqual({
      percentage: 50,
      completed_orders: 2,
      total_orders: 4,
    });
    expect(result.cancelled_orders_rate).toEqual({
      percentage: 50,
      cancelled_orders: 2,
      total_orders: 4,
    });
    expect(result.total_sales.value).toBe(200);
    expect(result.total_sales.change_percentage).toBe(100);
    expect(result.average_order_value).toBe(100);
    expect(result.new_customers).toBe(3);
    expect(result.returning_customers_rate).toEqual({
      percentage: 50,
      returning_customers: 1,
      active_customers: 2,
    });
    expect(result.availability_requests).toBe(7);
    expect(result.product_readiness).toEqual({
      active_products_count: 125,
      required_products_count: 100,
      remaining_products_count: 0,
      completion_percentage: 100,
      status: 'ready_for_orders',
      milestones: [25, 50, 75, 100],
    });
    expect(result.top_selling_products).toEqual([
      { name: 'Panadol Extra', orders_count: 3 },
      { name: 'Nescafe Gold', orders_count: 1.5 },
    ]);
    expect(result.orders_by_source).toEqual([
      { source: 'qr_code', label: 'QR Code', orders_count: 1, percentage: 25 },
      {
        source: 'stores_directory',
        label: 'Stores Directory',
        orders_count: 1,
        percentage: 25,
      },
      {
        source: 'whatsapp',
        label: 'WhatsApp',
        orders_count: 1,
        percentage: 25,
      },
      { source: 'manual', label: 'Manual', orders_count: 1, percentage: 25 },
    ]);
    expect(prisma.customer.count).toHaveBeenNthCalledWith(1, {
      where: {
        tenant_id: 1,
        deleted_at: null,
        first_order_at: {
          gte: new Date('2026-06-11T21:00:00.000Z'),
          lte: new Date('2026-06-18T20:59:59.999Z'),
        },
      },
    });
  });

  it('marks product readiness complete at the order threshold', async () => {
    const prisma = createPrismaMock({ activeProductsCount: 200 });
    const service = new MerchantDashboardService(
      prisma as any,
      createPolicyMock() as any,
    );

    const result = await service.getMeasurements(1, 'today');

    expect(result.product_readiness).toEqual({
      active_products_count: 200,
      required_products_count: 100,
      remaining_products_count: 0,
      completion_percentage: 100,
      status: 'ready_for_orders',
      milestones: [25, 50, 75, 100],
    });
  });

  it('reports one remaining product just below the order threshold', async () => {
    const prisma = createPrismaMock({ activeProductsCount: 99 });
    const service = new MerchantDashboardService(
      prisma as any,
      createPolicyMock() as any,
    );

    const result = await service.getMeasurements(1, 'today');

    expect(result.product_readiness.remaining_products_count).toBe(1);
    expect(result.product_readiness.completion_percentage).toBe(99);
    expect(result.product_readiness.status).toBe('add_products');
  });

  it('uses the 100 product readiness threshold for pharmacy tenants', async () => {
    const prisma = createPrismaMock({
      activeProductsCount: 99,
      tenantCategory: TenantCategory.pharmacy,
    });
    const service = new MerchantDashboardService(
      prisma as any,
      createPolicyMock() as any,
    );

    const result = await service.getMeasurements(1, 'today');

    expect(result.product_readiness).toEqual({
      active_products_count: 99,
      required_products_count: 100,
      remaining_products_count: 1,
      completion_percentage: 99,
      status: 'add_products',
      milestones: [25, 50, 75, 100],
    });
  });

  it('uses the 50 product readiness threshold for other tenant categories', async () => {
    const prisma = createPrismaMock({
      activeProductsCount: 50,
      tenantCategory: TenantCategory.other,
    });
    const service = new MerchantDashboardService(
      prisma as any,
      createPolicyMock() as any,
    );

    const result = await service.getMeasurements(1, 'today');

    expect(result.product_readiness).toEqual({
      active_products_count: 50,
      required_products_count: 50,
      remaining_products_count: 0,
      completion_percentage: 100,
      status: 'ready_for_orders',
      milestones: [10, 25, 50],
    });
  });

  it('uses the 50 product readiness threshold for greengrocer tenants', async () => {
    const prisma = createPrismaMock({
      activeProductsCount: 50,
      tenantCategory: TenantCategory.greengrocer,
    });
    const service = new MerchantDashboardService(
      prisma as any,
      createPolicyMock() as any,
    );

    const result = await service.getMeasurements(1, 'today');

    expect(result.product_readiness).toEqual({
      active_products_count: 50,
      required_products_count: 50,
      remaining_products_count: 0,
      completion_percentage: 100,
      status: 'ready_for_orders',
      milestones: [10, 25, 50],
    });
  });

  it('reports one remaining product below the greengrocer threshold', async () => {
    const prisma = createPrismaMock({
      activeProductsCount: 49,
      tenantCategory: TenantCategory.greengrocer,
    });
    const service = new MerchantDashboardService(
      prisma as any,
      createPolicyMock() as any,
    );

    const result = await service.getMeasurements(1, 'today');

    expect(result.product_readiness).toEqual({
      active_products_count: 49,
      required_products_count: 50,
      remaining_products_count: 1,
      completion_percentage: 98,
      status: 'add_products',
      milestones: [10, 25, 50],
    });
  });

  it('reports one remaining product below the lightweight threshold', async () => {
    const prisma = createPrismaMock({
      activeProductsCount: 49,
      tenantCategory: TenantCategory.other,
    });
    const service = new MerchantDashboardService(
      prisma as any,
      createPolicyMock() as any,
    );

    const result = await service.getMeasurements(1, 'today');

    expect(result.product_readiness.remaining_products_count).toBe(1);
    expect(result.product_readiness.completion_percentage).toBe(98);
    expect(result.product_readiness.status).toBe('add_products');
    expect(result.product_readiness.milestones).toEqual([10, 25, 50]);
  });

  it('uses completed orders only for sales and top products', async () => {
    const prisma = createPrismaMock({
      orders: [
        {
          id: 1,
          status: OrderStatus.completed,
          total: new Prisma.Decimal(120),
          order_source: OrderSource.storefront,
          source_metadata: null,
          customer_id: 1,
          order_items: [
            { name_snapshot: 'Milk', quantity: '1', selection_quantity: null },
          ],
        },
        {
          id: 2,
          status: OrderStatus.cancelled,
          total: new Prisma.Decimal(500),
          order_source: OrderSource.storefront,
          source_metadata: null,
          customer_id: 2,
          order_items: [
            {
              name_snapshot: 'Cancelled Item',
              quantity: '10',
              selection_quantity: null,
            },
          ],
        },
      ],
      activeCustomers: [{ customer_id: 1 }],
    });
    const service = new MerchantDashboardService(
      prisma as any,
      createPolicyMock() as any,
    );

    const result = await service.getMeasurements(1, 'today');

    expect(result.total_sales.value).toBe(120);
    expect(result.average_order_value).toBe(120);
    expect(result.top_selling_products).toEqual([
      { name: 'Milk', orders_count: 1 },
    ]);
  });

  it('counts draft orders in total orders without counting them as sales', async () => {
    const prisma = createPrismaMock({
      orders: [
        {
          id: 1,
          status: OrderStatus.draft,
          total: new Prisma.Decimal(90),
          order_source: OrderSource.storefront,
          source_metadata: null,
          customer_id: 1,
          order_items: [
            {
              name_snapshot: 'Draft Item',
              quantity: '1',
              selection_quantity: null,
            },
          ],
        },
      ],
      activeCustomers: [],
    });
    const service = new MerchantDashboardService(
      prisma as any,
      createPolicyMock() as any,
    );

    const result = await service.getMeasurements(1, 'today');

    expect(result.total_orders.value).toBe(1);
    expect(result.completed_orders_rate).toEqual({
      percentage: 0,
      completed_orders: 0,
      total_orders: 1,
    });
    expect(result.total_sales.value).toBe(0);
    expect(result.average_order_value).toBe(0);
    expect(result.top_selling_products).toEqual([]);
  });

  it('uses the request-bound tenant manager when available', async () => {
    const rootPrisma = createPrismaMock({});
    const tenantManager = createPrismaMock({
      orders: [
        {
          id: 1,
          status: OrderStatus.draft,
          total: new Prisma.Decimal(90),
          order_source: OrderSource.storefront,
          source_metadata: null,
          customer_id: 1,
          order_items: [],
        },
      ],
    });
    const service = new MerchantDashboardService(
      rootPrisma as any,
      createPolicyMock() as any,
    );

    const result = await DbTenantContext.run(
      { tenantId: 1, manager: tenantManager as any },
      () => service.getMeasurements(1, 'today'),
    );

    expect(result.total_orders.value).toBe(1);
    expect(tenantManager.order.findMany).toHaveBeenCalled();
    expect(rootPrisma.order.findMany).not.toHaveBeenCalled();
  });

  it('counts availability requests inside the selected period date range', async () => {
    const prisma = createPrismaMock({ availabilityRequests: 12 });
    const service = new MerchantDashboardService(
      prisma as any,
      createPolicyMock() as any,
    );

    await service.getMeasurements(1, '30d');

    expect(prisma.availabilityRequest.count).toHaveBeenCalledWith({
      where: {
        tenant_id: 1,
        request_date: {
          gte: new Date('2026-05-20T00:00:00.000Z'),
          lte: new Date('2026-06-18T00:00:00.000Z'),
        },
      },
    });
  });

  it('returns warning cancellation policy payload', async () => {
    const prisma = createPrismaMock({});
    const policy = createPolicyMock({
      status: 'warning',
      count: 10,
      remaining_before_suspension: 6,
    });
    const service = new MerchantDashboardService(prisma as any, policy as any);

    const result = await service.getMeasurements(1, 'today');

    expect(result.cancellation_policy).toEqual(
      expect.objectContaining({
        status: 'warning',
        count: 10,
        remaining_before_suspension: 6,
      }),
    );
  });

  it('returns suspended cancellation policy when tenant is suspended', async () => {
    const prisma = createPrismaMock({ tenantStatus: 'suspended' });
    const policy = createPolicyMock({
      status: 'suspended',
      count: 16,
    });
    const service = new MerchantDashboardService(prisma as any, policy as any);

    const result = await service.getMeasurements(1, 'today');

    expect(result.cancellation_policy.status).toBe('suspended');
  });
});
