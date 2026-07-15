import { TenantCategory } from '../../generated/prisma/client';
import {
  CATALOG_SOURCE_CHEFAA,
  CATALOG_SOURCE_TALABAT,
} from 'src/products/catalog-source-policy';
import { ZoneCatalogReconciliationService } from './zone-catalog-reconciliation.service';

describe('ZoneCatalogReconciliationService', () => {
  const createService = (zoneIds = [1, 2]) => {
    const prisma = {
      zoneStorefront: {
        findMany: jest
          .fn()
          .mockResolvedValue(zoneIds.map((id) => ({ id }))),
      },
    };
    const syncEssentialCatalogAutomatically: jest.Mock<
      Promise<void>,
      [number]
    > = jest.fn(() => Promise.resolve());
    const zoneStorefronts = { syncEssentialCatalogAutomatically };
    const service = new ZoneCatalogReconciliationService(
      prisma as never,
      zoneStorefronts as never,
    );

    return { prisma, zoneStorefronts, service };
  };

  it.each([
    [CATALOG_SOURCE_TALABAT, TenantCategory.grocery] as const,
    [CATALOG_SOURCE_CHEFAA, TenantCategory.pharmacy] as const,
  ])(
    'isolates %s reconciliation to its tenant category',
    async (source, category) => {
      const { prisma, zoneStorefronts, service } = createService();

      await service.reconcileSource(source);

      expect(prisma.zoneStorefront.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category, operator_tenant: { category } },
        }),
      );
      expect(
        zoneStorefronts.syncEssentialCatalogAutomatically,
      ).toHaveBeenNthCalledWith(1, 1);
      expect(
        zoneStorefronts.syncEssentialCatalogAutomatically,
      ).toHaveBeenNthCalledWith(2, 2);
    },
  );

  it('finishes other zones and reports failures for worker retry', async () => {
    const { zoneStorefronts, service } = createService([10, 20]);
    zoneStorefronts.syncEssentialCatalogAutomatically
      .mockRejectedValueOnce(new Error('zone unavailable'))
      .mockResolvedValueOnce(undefined);

    await expect(
      service.reconcileSource(CATALOG_SOURCE_TALABAT),
    ).rejects.toThrow('zone 10: zone unavailable');
    expect(
      zoneStorefronts.syncEssentialCatalogAutomatically,
    ).toHaveBeenCalledTimes(2);
  });
});
