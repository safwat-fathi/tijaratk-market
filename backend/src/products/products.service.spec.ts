/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unnecessary-type-assertion */
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
      product: {
        findMany: jest.fn().mockResolvedValue([]),
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
          category: expect.objectContaining({
            in: expect.arrayContaining(['أرز ومكرونة', 'شيبس ومقبلات']),
          }),
          tenant_hidden_catalog_items: {
            none: { tenant_id: 1 },
          },
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

  it('does not expose Chefaa source rows to grocery tenants', async () => {
    const prisma = {
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ category: TenantCategory.grocery }),
      },
      catalogItem: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(
      service.createFromCatalog(1, { catalog_item_id: 10 }),
    ).rejects.toThrow('Catalog item with ID 10 not found');

    expect(prisma.catalogItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 10,
          is_active: true,
          source: 'talabat_csv',
        }),
      }),
    );
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

  it('returns all supermarket catalog categories with the first 20 ranked items selected by default', async () => {
    const chipsItems = Array.from({ length: 22 }, (_, index) => ({
      id: index + 1,
      name: `شيبسي ${index + 1}`,
      image_url: index === 0 ? 'https://example.com/chips.png' : null,
      category: 'شيبس ومقبلات',
      price: 10 + index,
      source: 'talabat_csv',
      is_active: true,
      created_at: new Date(),
    }));
    const items = [
      ...chipsItems,
      {
        id: 101,
        name: 'لبن كامل الدسم',
        image_url: null,
        category: 'ألبان و بيض',
        price: 40,
        source: 'talabat_csv',
        is_active: true,
        created_at: new Date(),
      },
      {
        id: 102,
        name: 'مكرونة قلم',
        image_url: null,
        category: 'أرز ومكرونة',
        price: 30,
        source: 'talabat_csv',
        is_active: true,
        created_at: new Date(),
      },
    ];
    const prisma = {
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ category: TenantCategory.grocery }),
      },
      catalogItem: {
        findMany: jest.fn().mockResolvedValue(items),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = createService(prisma);

    const result = await service.findBulkEssentialStages(1);

    expect(result.map((stage) => stage.category)).toEqual([
      'أرز ومكرونة',
      'ألبان و بيض',
      'شيبس ومقبلات',
    ]);
    expect(result).toHaveLength(3);
    expect(result.find((stage) => stage.category === 'شيبس ومقبلات')).toMatchObject({
      category: 'شيبس ومقبلات',
      total: 22,
      default_selected_catalog_item_ids: Array.from(
        { length: 10 },
        (_, index) => index + 1,
      ),
    });
    expect(prisma.catalogItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: 'talabat_csv',
          is_active: true,
          category: expect.objectContaining({
            in: expect.arrayContaining(['ألبان و بيض', 'أرز ومكرونة']),
          }),
        }),
      }),
    );
    expect(prisma.catalogItem.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.anything(),
        }),
      }),
    );
  });

  it('returns no essential stages for unsupported tenant categories', async () => {
    const prisma = {
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ category: TenantCategory.other }),
      },
      catalogItem: {
        findMany: jest.fn(),
      },
    };
    const service = createService(prisma);

    await expect(service.findBulkEssentialStages(1)).resolves.toEqual([]);
    expect(prisma.catalogItem.findMany).not.toHaveBeenCalled();
  });

  it('imports selected essential catalog items and skips duplicate active products', async () => {
    const catalogItems = [
      {
        id: 1,
        name: 'مكرونة قلم',
        image_url: null,
        category: 'أرز ومكرونة',
        price: 12,
      },
      {
        id: 2,
        name: 'أرز أبيض',
        image_url: null,
        category: 'أرز ومكرونة',
        price: 13,
      },
    ];
    const prisma = {
      $transaction: jest.fn((callback) => callback(prisma)),
      $executeRaw: jest.fn().mockResolvedValue(1),
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ category: TenantCategory.grocery }),
        update: jest.fn().mockResolvedValue({}),
      },
      catalogItem: {
        findMany: jest.fn().mockResolvedValue(catalogItems),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([{ name: 'مكرونة قلم' }]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const readinessService = { recalculateTenantReadiness: jest.fn() };
    const service = new ProductsService(
      prisma as any,
      {} as any,
      readinessService as any,
      { get: jest.fn(), set: jest.fn() } as any,
    );

    const result = await service.bulkAddEssentials(1, {
      category: 'أرز ومكرونة',
      catalog_item_ids: [1, 2],
    });

    expect(result).toEqual({ count: 1 });
    expect(prisma.product.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          name: 'أرز أبيض',
          price_needs_review: true,
          source: 'catalog',
          category: 'أرز ومكرونة',
        }),
      ],
      skipDuplicates: true,
    });
    expect(prisma.catalogItem.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [1, 2] },
        source: 'talabat_csv',
        is_active: true,
        category: 'أرز ومكرونة',
      },
    });
    expect(readinessService.recalculateTenantReadiness).toHaveBeenCalledWith(1);
  });

  it('imports legacy category bulk items without restricting to essential brands', async () => {
    const catalogItems = [
      {
        id: 1,
        name: 'لبن كامل الدسم',
        image_url: null,
        category: 'ألبان و بيض',
        price: 40,
      },
    ];
    const prisma = {
      $transaction: jest.fn((callback) => callback(prisma)),
      $executeRaw: jest.fn().mockResolvedValue(1),
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ category: TenantCategory.grocery }),
        update: jest.fn().mockResolvedValue({}),
      },
      catalogItem: {
        findMany: jest.fn().mockResolvedValue(catalogItems),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = createService(prisma);

    const result = await service.bulkAddEssentials(1, {
      categories: ['ألبان و بيض'],
    });

    expect(result).toEqual({ count: 1 });
    expect(prisma.catalogItem.findMany).toHaveBeenCalledWith({
      where: {
        source: 'talabat_csv',
        is_active: true,
        category: { in: ['ألبان و بيض'] },
      },
    });
    expect(prisma.product.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          name: 'لبن كامل الدسم',
          category: 'ألبان و بيض',
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('rejects selected essential items that do not belong to the requested source and category', async () => {
    const prisma = {
      $transaction: jest.fn((callback) => callback(prisma)),
      $executeRaw: jest.fn().mockResolvedValue(1),
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ category: TenantCategory.grocery }),
      },
      catalogItem: {
        findMany: jest.fn().mockResolvedValue([{ id: 1, name: 'شيبسي' }]),
      },
    };
    const service = createService(prisma);

    await expect(
      service.bulkAddEssentials(1, {
        category: 'شيبس ومقبلات',
        catalog_item_ids: [1, 2],
      }),
    ).rejects.toThrow('One or more selected catalog items are invalid');
  });

  it('rejects hiding catalog items outside the tenant allowed source', async () => {
    const prisma = {
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ category: TenantCategory.grocery }),
      },
      catalogItem: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      tenantHiddenCatalogItem: {
        upsert: jest.fn(),
      },
    };
    const service = createService(prisma);

    await expect(service.hideCatalogItem(1, 99)).rejects.toThrow(
      'Catalog item with ID 99 not found',
    );
    expect(prisma.tenantHiddenCatalogItem.upsert).not.toHaveBeenCalled();
  });
});
