import { BadRequestException } from '@nestjs/common';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ProductsService } from './products.service';
import { DbTenantContext } from 'src/common/contexts/db-tenant.context';
import { ProductStatus } from 'src/common/enums/product-status.enum';

describe('ProductsService fuzzy product search', () => {
  const createService = () => {
    const prisma = {
      $queryRawUnsafe: jest.fn(),
      product: {
        findUnique: jest.fn(),
      },
    };
    const cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };
    const service = new ProductsService(
      prisma as any,
      {} as any,
      {} as any,
      cacheManager as any,
    );

    return { service: service as any, prisma, cacheManager };
  };

  it('rejects whitespace-only merchant searches before querying', async () => {
    const { service, prisma } = createService();

    await expect(
      service.searchTenantProducts(1, '   ', undefined, 1, 20),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('uses normalized product names for authenticated tenant search', async () => {
    const { service, prisma } = createService();
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);

    await service.searchWithinTenantProducts(
      11,
      'ايه',
      undefined,
      0.08,
      {
        strictSimilarityThreshold: 0.32,
        strictWordSimilarityThreshold: 0.58,
      },
      false,
      [],
      1,
      20,
      ProductStatus.ACTIVE,
    );

    const dataQuery = prisma.$queryRawUnsafe.mock.calls[0][0] as string;
    expect(dataQuery).toContain('"name_normalized"');
    expect(dataQuery).toContain('arabic_normalize');
    expect(dataQuery).toContain('tenant_id = $1');
  });

  it('keeps public product search scoped by slug while using normalized names', async () => {
    const { service, prisma } = createService();
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);

    await service.searchWithinPublicProducts('store-a', 'ايه', undefined, 0.08, {
      strictSimilarityThreshold: 0.32,
      strictWordSimilarityThreshold: 0.58,
    }, 1, 20);

    const dataQuery = prisma.$queryRawUnsafe.mock.calls[0][0] as string;
    expect(dataQuery).toContain('tenant.slug = $1');
    expect(dataQuery).toContain('product.name_normalized');
    expect(dataQuery).toContain('product.deleted_at IS NULL');
  });

  it('preserves stable pagination metadata for normalized search results', async () => {
    const { service, prisma } = createService();
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ id: 4, name: 'آيه' }])
      .mockResolvedValueOnce([{ total: 21 }]);

    const result = await service.searchWithinTenantProducts(
      11,
      'ايه',
      undefined,
      0.08,
      {
        strictSimilarityThreshold: 0.32,
        strictWordSimilarityThreshold: 0.58,
      },
      false,
      [],
      2,
      10,
      ProductStatus.ACTIVE,
    );

    expect(result.meta).toEqual({
      total: 21,
      page: 2,
      limit: 10,
      last_page: 3,
      has_next: true,
    });
  });
});

describe('ProductsService CSV product import', () => {
  const createCsvFile = (content: string): Express.Multer.File => {
    const dir = mkdtempSync(join(tmpdir(), 'product-import-'));
    const path = join(dir, 'products.csv');
    writeFileSync(path, content, 'utf8');

    return { path, originalname: 'products.csv' } as Express.Multer.File;
  };

  const createImportService = () => {
    const tx = {
      $executeRaw: jest.fn(),
      tenantProductCategory: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      product: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      productPriceHistory: {
        create: jest.fn(),
      },
    };
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: 22, category: 'grocery' }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const storesDirectoryService = {
      recalculateTenantReadiness: jest.fn(),
    };
    const service = new ProductsService(
      prisma as any,
      {} as any,
      storesDirectoryService as any,
      { get: jest.fn(), set: jest.fn() } as any,
    );

    return { service: service as any, prisma, tx, storesDirectoryService };
  };

  it('runs admin CSV imports inside the selected tenant RLS transaction', async () => {
    const { service, prisma, tx, storesDirectoryService } =
      createImportService();
    tx.tenantProductCategory.findUnique.mockResolvedValue(null);
    tx.tenantProductCategory.create.mockResolvedValue({ name: 'Snacks' });
    tx.product.findFirst.mockResolvedValue(null);
    tx.product.create.mockResolvedValue({ id: 991 });

    const result = await service.importProductsFromCsv(
      22,
      createCsvFile('name,price,category\nChips,12.5,Snacks\n'),
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenant_id: 22,
        name: 'chips',
        current_price: 12.5,
        category: 'Snacks',
      }),
    });
    expect(tx.productPriceHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenant_id: 22,
        product_id: 991,
        price: 12.5,
      }),
    });
    expect(storesDirectoryService.recalculateTenantReadiness).toHaveBeenCalledWith(
      22,
    );
    expect(result).toEqual({
      total_rows: 1,
      created_rows: 1,
      updated_rows: 0,
      skipped_rows: 0,
      failed_rows: 0,
      errors: [],
    });
  });

  it('uses the existing tenant context for merchant CSV imports', async () => {
    const { service, prisma, tx } = createImportService();
    tx.tenantProductCategory.findUnique.mockResolvedValue({ name: 'أخرى' });
    tx.product.findFirst.mockResolvedValue(null);
    tx.product.create.mockResolvedValue({ id: 992 });

    await DbTenantContext.run({ tenantId: 22, manager: tx as any }, () =>
      service.importProductsFromCsv(
        22,
        createCsvFile('name,price\nMilk,30\n'),
      ),
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenant_id: 22,
        name: 'milk',
        category: 'أخرى',
      }),
    });
  });

  it('updates existing products and records price history through the tenant client', async () => {
    const { service, tx } = createImportService();
    tx.tenantProductCategory.findUnique.mockResolvedValue({ name: 'Drinks' });
    tx.product.findFirst.mockResolvedValue({
      id: 44,
      current_price: '10',
      image_url: '/old.png',
    });

    const result = await service.importProductsFromCsv(
      22,
      createCsvFile('name,price,category,imageUrl\nCola,15,Drinks,/new.png\n'),
    );

    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 44 },
      data: expect.objectContaining({
        current_price: 15,
        category: 'Drinks',
        image_url: '/new.png',
        is_available: true,
      }),
    });
    expect(tx.productPriceHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenant_id: 22,
        product_id: 44,
        price: 15,
        reason: 'Imported from CSV',
      }),
    });
    expect(tx.product.create).not.toHaveBeenCalled();
    expect(result.updated_rows).toBe(1);
    expect(result.created_rows).toBe(0);
    expect(result.failed_rows).toBe(0);
  });

  it('records invalid CSV rows without aborting later valid rows', async () => {
    const { service, tx } = createImportService();
    tx.tenantProductCategory.findUnique.mockResolvedValue(null);
    tx.tenantProductCategory.create.mockResolvedValue({ name: 'أخرى' });
    tx.product.findFirst.mockResolvedValue(null);
    tx.product.create.mockResolvedValue({ id: 993 });

    const result = await service.importProductsFromCsv(
      22,
      createCsvFile('name,price\nMissing Price,\nJuice,18\n'),
    );

    expect(result.total_rows).toBe(2);
    expect(result.created_rows).toBe(1);
    expect(result.failed_rows).toBe(1);
    expect(result.errors).toEqual([
      { row_number: 1, message: 'Price is required' },
    ]);
    expect(tx.product.create).toHaveBeenCalledTimes(1);
  });
});
