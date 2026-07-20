import {
  CATALOG_SOURCE_TALABAT,
  GROCERY_CATALOG_CATEGORIES,
} from 'src/products/catalog-source-policy';
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

  it('uses the fixed source taxonomy when no categories are configured', async () => {
    const catalogItemFindMany = jest.fn().mockResolvedValue([]);
    const client = {
      catalogCategory: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      catalogItem: { findMany: catalogItemFindMany },
    };

    await expect(
      findZoneEssentialCatalogItems(
        client as never,
        CATALOG_SOURCE_TALABAT,
      ),
    ).resolves.toEqual([]);
    expect(catalogItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: CATALOG_SOURCE_TALABAT,
          category: { in: [...GROCERY_CATALOG_CATEGORIES] },
        }),
      }),
    );
  });
});
