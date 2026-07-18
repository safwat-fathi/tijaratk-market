import { CATALOG_SOURCE_TALABAT } from 'src/products/catalog-source-policy';
import { findZoneEssentialCatalogItems } from './zone-essential-catalog-sync';

describe('findZoneEssentialCatalogItems', () => {
  it('preserves exact active system category names', async () => {
    const catalogItemFindMany = jest.fn().mockResolvedValue([
      {
        id: 41,
        name: '  منتج أساسي  ',
        image_url: null,
        category: 'أرز ومكرونة وحبوب',
        price: null,
      },
    ]);
    const client = {
      catalogCategory: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ name: 'أرز ومكرونة وحبوب' }]),
      },
      catalogItem: { findMany: catalogItemFindMany },
    };

    await expect(
      findZoneEssentialCatalogItems(
        client as never,
        CATALOG_SOURCE_TALABAT,
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 41,
        name: 'منتج أساسي',
        category: 'أرز ومكرونة وحبوب',
      }),
    ]);
    expect(catalogItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: CATALOG_SOURCE_TALABAT,
          category: { in: ['أرز ومكرونة وحبوب'] },
        }),
      }),
    );
  });

  it('does not synthesize legacy categories when no system category is active', async () => {
    const catalogItemFindMany = jest.fn();
    const client = {
      catalogCategory: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      catalogItem: { findMany: catalogItemFindMany },
    };

    await expect(
      findZoneEssentialCatalogItems(
        client as never,
        CATALOG_SOURCE_TALABAT,
      ),
    ).resolves.toEqual([]);
    expect(catalogItemFindMany).not.toHaveBeenCalled();
  });
});
