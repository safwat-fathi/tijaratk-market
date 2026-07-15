import { CATALOG_SOURCE_TALABAT } from 'src/products/catalog-source-policy';
import { ZoneCatalogReconciliationWorker } from './zone-catalog-reconciliation.worker';

describe('ZoneCatalogReconciliationWorker', () => {
  const createWorker = () => {
    const prisma = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const reconcileSource: jest.Mock<Promise<void>, [string]> = jest.fn(() =>
      Promise.resolve(),
    );
    const reconciliation = { reconcileSource };
    const worker = new ZoneCatalogReconciliationWorker(
      prisma as never,
      reconciliation as never,
    );

    return { prisma, reconciliation, worker };
  };

  it('claims and completes one source revision idempotently', async () => {
    const { prisma, reconciliation, worker } = createWorker();
    prisma.$queryRaw.mockResolvedValue([
      {
        source: CATALOG_SOURCE_TALABAT,
        processing_revision: 4,
        attempt_count: 0,
      },
    ]);

    await (worker as unknown as { tick: () => Promise<void> }).tick();

    expect(reconciliation.reconcileSource).toHaveBeenCalledTimes(1);
    expect(reconciliation.reconcileSource).toHaveBeenCalledWith(
      CATALOG_SOURCE_TALABAT,
    );
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('does not overlap polls in the same process', async () => {
    const { prisma, worker } = createWorker();
    let releaseClaim: (rows: unknown[]) => void = () => undefined;
    prisma.$queryRaw.mockImplementation(
      () =>
        new Promise<unknown[]>((resolve) => {
          releaseClaim = resolve;
        }),
    );

    const firstTick = (
      worker as unknown as { tick: () => Promise<void> }
    ).tick();
    const overlappingTick = (
      worker as unknown as { tick: () => Promise<void> }
    ).tick();
    releaseClaim([]);
    await Promise.all([firstTick, overlappingTick]);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('releases a failed revision with retry state', async () => {
    const { prisma, reconciliation, worker } = createWorker();
    prisma.$queryRaw.mockResolvedValue([
      {
        source: CATALOG_SOURCE_TALABAT,
        processing_revision: 7,
        attempt_count: 2,
      },
    ]);
    reconciliation.reconcileSource.mockRejectedValueOnce(
      new Error('temporary failure'),
    );

    await (worker as unknown as { tick: () => Promise<void> }).tick();

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
