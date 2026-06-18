/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ProductsService } from './products.service';
import { TenantCategory } from '../../generated/prisma/client';

const createService = (prisma: any) =>
  new ProductsService(
    prisma,
    {} as any,
    { recalculateTenantReadiness: jest.fn() } as any,
    {
      get: jest.fn(),
      set: jest.fn(),
    } as any,
  );

describe('ProductsService catalog source isolation', () => {
  it('returns only Chefaa pharmacy categories for pharmacy tenants', async () => {
    const prisma = {
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ category: TenantCategory.pharmacy }),
      },
      catalogItem: {
        groupBy: jest.fn().mockResolvedValue([
          { category: 'أدوية', _count: { id: 2 } },
          { category: 'عناية شخصية', _count: { id: 1 } },
        ]),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = createService(prisma);

    const result = await service.findCatalogCategories(1);

    expect(result.map((item) => item.category)).toEqual([
      'أدوية',
      'عناية شخصية',
    ]);
    expect(prisma.catalogItem.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          is_active: true,
          source: 'chefaa_csv',
          category: { in: ['أدوية', 'عناية شخصية'] },
        },
      }),
    );
  });

  it('returns supermarket source catalog items for grocery tenants', async () => {
    const prisma = {
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ category: TenantCategory.grocery }),
      },
      catalogItem: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 1, source: 'talabat_csv' }]),
        count: jest.fn().mockResolvedValue(1),
      },
      tenantHiddenCatalogItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = createService(prisma);

    const result = await service.findCatalogItems(
      1,
      undefined,
      undefined,
      1,
      40,
    );

    expect(result.meta.total).toBe(1);
    expect(prisma.catalogItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          is_active: true,
          source: 'talabat_csv',
          category: undefined,
        },
      }),
    );
  });

  it('returns an empty catalog for unsupported tenant categories', async () => {
    const prisma = {
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ category: TenantCategory.other }),
      },
      catalogItem: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    const service = createService(prisma);

    const result = await service.findCatalogItems(
      1,
      undefined,
      undefined,
      1,
      40,
    );

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
    expect(prisma.catalogItem.findMany).not.toHaveBeenCalled();
  });

  it('does not expose grocery categories from the Chefaa source', async () => {
    const prisma = {
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ category: TenantCategory.pharmacy }),
      },
      catalogItem: {
        groupBy: jest.fn().mockResolvedValue([
          { category: 'أدوية', _count: { id: 2 } },
          { category: 'عناية شخصية', _count: { id: 1 } },
        ]),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = createService(prisma);

    const result = await service.findCatalogCategories(1);

    expect(result.map((item) => item.category)).not.toContain('أرز ومكرونة');
  });

  it('creates pharmacy catalog products with box unit label', async () => {
    const prisma = {
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ category: TenantCategory.pharmacy }),
      },
      catalogItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 10,
          name: 'بنادول',
          image_url: null,
          category: 'أدوية',
          price: 25,
        }),
      },
      product: {
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 1, ...data }),
          ),
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ count: 0 }]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const service = createService(prisma);

    await service.createFromCatalog(1, { catalog_item_id: 10 });

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          order_config: { quantity: { unit_label: 'علبة' } },
        }),
      }),
    );
  });

  it('creates grocery catalog products with piece unit label', async () => {
    const prisma = {
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ category: TenantCategory.grocery }),
      },
      catalogItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 10,
          name: 'سكر',
          image_url: null,
          category: 'أساسيات',
          price: 40,
        }),
      },
      product: {
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 1, ...data }),
          ),
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ count: 0 }]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const service = createService(prisma);

    await service.createFromCatalog(1, { catalog_item_id: 10 });

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          order_config: { quantity: { unit_label: 'قطعة' } },
        }),
      }),
    );
  });

  it('defaults manual pharmacy products to box unit label', async () => {
    const prisma = {
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ category: TenantCategory.pharmacy }),
      },
      product: {
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 1, ...data }),
          ),
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ count: 0 }]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const service = createService(prisma);

    await service.create(1, {
      name: 'فيتامين سي',
      order_config: { quantity: { unit_label: '' } },
    } as any);

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          order_config: { quantity: { unit_label: 'علبة' } },
        }),
      }),
    );
  });

  it('preserves explicit manual pharmacy unit label', async () => {
    const prisma = {
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ category: TenantCategory.pharmacy }),
      },
      product: {
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 1, ...data }),
          ),
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ count: 0 }]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const service = createService(prisma);

    await service.create(1, {
      name: 'دواء شراب',
      order_config: { quantity: { unit_label: 'زجاجة' } },
    } as any);

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          order_config: { quantity: { unit_label: 'زجاجة' } },
        }),
      }),
    );
  });
});
