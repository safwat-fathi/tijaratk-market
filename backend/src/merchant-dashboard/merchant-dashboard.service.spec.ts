import { DbTenantContext } from 'src/common/contexts/db-tenant.context';
import { MerchantDashboardService } from './merchant-dashboard.service';
import {
  OrderSource,
  OrderStatus,
  Prisma,
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
}) => ({
  order: {
    findMany: jest
      .fn()
      .mockResolvedValueOnce(input.orders ?? [])
      .mockResolvedValueOnce(input.activeCustomers ?? []),
    count: jest
      .fn()
      .mockResolvedValueOnce(input.previousTotalOrders ?? 0)
      .mockResolvedValueOnce(input.previousCompletedOrders ?? 0)
      .mockResolvedValueOnce(input.previousCancelledOrders ?? 0),
    aggregate: jest.fn().mockResolvedValue({
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
    const service = new MerchantDashboardService(prisma as any);

    const result = await service.getMeasurements(1, 'today');

    expect(result.total_orders.value).toBe(0);
    expect(result.completed_orders_rate.percentage).toBe(0);
    expect(result.cancelled_orders_rate.percentage).toBe(0);
    expect(result.total_sales.value).toBe(0);
    expect(result.average_order_value).toBe(0);
    expect(result.returning_customers_rate.percentage).toBe(0);
    expect(result.top_selling_products).toEqual([]);
    expect(result.orders_by_source).toEqual([]);
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
    });
    const service = new MerchantDashboardService(prisma as any);

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
    const service = new MerchantDashboardService(prisma as any);

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
    const service = new MerchantDashboardService(prisma as any);

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
    const service = new MerchantDashboardService(rootPrisma as any);

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
    const service = new MerchantDashboardService(prisma as any);

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
});
