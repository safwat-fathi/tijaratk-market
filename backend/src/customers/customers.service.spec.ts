import { CustomersService } from './customers.service';

const createService = () => {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    globalCustomer: {
      findFirst: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn((callback) => callback(tx)),
  };

  return {
    service: new CustomersService(prisma as any),
    prisma,
    tx,
  };
};

describe('CustomersService public access-code order lookup', () => {
  it('normalizes formatted access code and phone before reading orders', async () => {
    const { service, prisma, tx } = createService();
    const createdAt = new Date('2026-06-26T02:45:58.292Z');
    tx.globalCustomer.findFirst.mockResolvedValue({ id: 7 });
    tx.order.findMany.mockResolvedValue([
      {
        id: 12,
        public_token: 'token-12',
        status: 'draft',
        created_at: createdAt,
        total: '260',
        delivery_address: 'Test address',
        delivery_time_window_snapshot: 'طوال اليوم',
        tenant: { id: 15, name: 'Tijaratk', slug: 'tijaratk-2' },
        order_items: [{ id: 99, name_snapshot: 'Item' }],
      },
    ]);

    const result = await service.findPublicOrdersByAccessCode(
      '82F6-8HTN',
      '01000000000',
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.globalCustomer.findFirst).toHaveBeenCalledWith({
      where: {
        access_code: '82F68HTN',
        phone: '+201000000000',
        deleted_at: null,
      },
      select: { id: true },
    });
    expect(tx.order.findMany).toHaveBeenCalledWith({
      where: {
        deleted_at: null,
        customer: {
          global_customer_id: 7,
          deleted_at: null,
        },
      },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        order_items: {
          include: {
            replaced_by_product: true,
            pending_replacement_product: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    expect(result).toEqual([
      {
        id: 12,
        public_token: 'token-12',
        status: 'draft',
        created_at: createdAt,
        total: '260',
        delivery_address: 'Test address',
        delivery_time_window_snapshot: 'طوال اليوم',
        tenant: { id: 15, name: 'Tijaratk', slug: 'tijaratk-2' },
        items: [{ id: 99, name_snapshot: 'Item' }],
      },
    ]);
  });

  it('returns an empty list without querying when code or phone is missing', async () => {
    const { service, prisma } = createService();

    await expect(
      service.findPublicOrdersByAccessCode('', '01000000000'),
    ).resolves.toEqual([]);
    await expect(
      service.findPublicOrdersByAccessCode('82F6-8HTN', ' '),
    ).resolves.toEqual([]);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns an empty list when no global customer matches', async () => {
    const { service, tx } = createService();
    tx.globalCustomer.findFirst.mockResolvedValue(null);

    const result = await service.findPublicOrdersByAccessCode(
      '82F6-8HTN',
      '01000000000',
    );

    expect(result).toEqual([]);
    expect(tx.order.findMany).not.toHaveBeenCalled();
  });
});
