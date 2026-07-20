import { AdminService } from './admin.service';

describe('AdminService getOrders', () => {
  const firstOrder = {
    id: 38,
    tenant_id: 10,
    customer_id: 100,
    customer_name: 'اسم الطلب',
    customer_phone: '01001112222',
    created_at: new Date('2026-07-20T08:00:00.000Z'),
    order_type: 'catalog',
    status: 'draft',
    pricing_mode: 'auto',
    subtotal: 90,
    delivery_fee: 10,
    delivery_address: 'الدقي، الجيزة',
    total: 100,
    free_text_payload: null,
    notes: 'اتصل قبل الوصول',
    card_on_delivery_requested: true,
    tenant: { id: 10, name: 'المتجر الأول', slug: 'first-store' },
    customer: {
      name: 'اسم الملف',
      phone: '01009998888',
      global_customer: { access_code: 'GC-1234' },
    },
    order_items: [
      {
        id: 501,
        order_id: 38,
        name_snapshot: 'منتج طويل الاسم',
        quantity: '2',
        unit_price: 45,
        total_price: 90,
        notes: null,
        is_out_of_stock: false,
        replacement_decision_status: 'none',
        replaced_by_product: null,
        pending_replacement_product: null,
      },
    ],
  };

  const secondOrder = {
    ...firstOrder,
    id: 37,
    tenant_id: 20,
    customer_id: 200,
    customer_name: null,
    customer_phone: null,
    created_at: new Date('2026-07-19T08:00:00.000Z'),
    order_type: 'free_text',
    delivery_address: null,
    free_text_payload: { text: 'كيلو طماطم ونصف كيلو خيار' },
    notes: null,
    card_on_delivery_requested: false,
    tenant: { id: 20, name: 'المتجر الثاني', slug: 'second-store' },
    customer: {
      name: 'عميل بلا ملف عالمي',
      phone: '01005556666',
      global_customer: null,
    },
    order_items: [],
  };

  const createService = () => {
    const firstTx = {
      order: {
        findMany: jest.fn().mockResolvedValue([firstOrder]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const secondTx = {
      order: {
        findMany: jest.fn().mockResolvedValue([secondOrder]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const prisma = {
      tenant: {
        findMany: jest.fn().mockResolvedValue([{ id: 10 }, { id: 20 }]),
      },
    };
    const service = new AdminService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const rlsService = service as unknown as {
      runWithTenantRls: (
        tenantId: number,
        callback: (tx: typeof firstTx | typeof secondTx) => Promise<unknown>,
      ) => Promise<unknown>;
    };
    jest
      .spyOn(rlsService, 'runWithTenantRls')
      .mockImplementation(async (tenantId, callback) =>
        callback(tenantId === 10 ? firstTx : secondTx),
      );

    return { service, firstTx, secondTx };
  };

  afterEach(() => jest.restoreAllMocks());

  it('returns masked-screen data with snapshot phone precedence and item details', async () => {
    const { service } = createService();

    const result = await service.getOrders({ page: 1, limit: 20 });

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 38,
        customer_phone: '01001112222',
        customer: {
          name: 'اسم الطلب',
          phone: '01001112222',
          access_code: 'GC-1234',
        },
        items: [expect.objectContaining({ name_snapshot: 'منتج طويل الاسم' })],
      }),
    );
    expect(firstTx.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          customer: {
            select: expect.objectContaining({
              global_customer: { select: { access_code: true } },
            }),
          },
          order_items: expect.objectContaining({ select: expect.any(Object) }),
        }),
      }),
    );
  });

  it('falls back to the linked customer and handles a missing global profile', async () => {
    const { service } = createService();

    const result = await service.getOrders({ page: 1, limit: 20 });
    const order = result.data.find((item) => item.id === 37);

    expect(order).toEqual(
      expect.objectContaining({
        customer_phone: '01005556666',
        customer: {
          name: 'عميل بلا ملف عالمي',
          phone: '01005556666',
          access_code: null,
        },
        delivery_address: null,
        free_text_payload: { text: 'كيلو طماطم ونصف كيلو خيار' },
        notes: null,
        items: [],
      }),
    );
  });

  it('keeps every order query constrained to its tenant RLS context', async () => {
    const { service, firstTx, secondTx } = createService();

    await service.getOrders({ page: 1, limit: 20 });

    expect(firstTx.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenant_id: 10 }) }),
    );
    expect(secondTx.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenant_id: 20 }) }),
    );
  });
});
