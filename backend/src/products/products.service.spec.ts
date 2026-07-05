import { BadRequestException } from '@nestjs/common';
import { ProductsService } from './products.service';
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
