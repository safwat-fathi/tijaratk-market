import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  CATALOG_SOURCE_CHEFAA,
  CATALOG_SOURCE_TALABAT,
  type CatalogSource,
} from 'src/products/catalog-source-policy';
import { PrismaService } from 'src/prisma/prisma.service';
import { ZoneCatalogReconciliationService } from './zone-catalog-reconciliation.service';
import { isZoneStorefrontEnabled } from './zone-storefront-feature';

type ClaimedReconciliation = {
  source: string;
  processing_revision: number;
  attempt_count: number;
};

const POLL_INTERVAL_MS = 5_000;
const STALE_LOCK_INTERVAL = '10 minutes';

@Injectable()
export class ZoneCatalogReconciliationWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ZoneCatalogReconciliationWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliation: ZoneCatalogReconciliationService,
  ) {}

  /** Starts polling only while the zone storefront experiment is enabled. */
  onApplicationBootstrap(): void {
    if (!isZoneStorefrontEnabled()) {
      this.logger.log('Zone catalog reconciliation is disabled');
      return;
    }

    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
    this.timer.unref?.();
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running || !isZoneStorefrontEnabled()) return;
    this.running = true;
    try {
      const claim = await this.claimNext();
      if (!claim) return;

      try {
        const source = this.requireSource(claim.source);
        await this.reconciliation.reconcileSource(source);
        await this.complete(claim);
      } catch (error) {
        await this.retry(claim, error);
      }
    } catch (error) {
      this.logger.error('Zone catalog reconciliation poll failed', error);
    } finally {
      this.running = false;
    }
  }

  private async claimNext(): Promise<ClaimedReconciliation | null> {
    const rows = await this.prisma.$queryRaw<ClaimedReconciliation[]>`
      WITH candidate AS (
        SELECT source
        FROM zone_catalog_reconciliations
        WHERE requested_revision > completed_revision
          AND next_attempt_at <= NOW()
          AND (
            processing_revision IS NULL
            OR processing_started_at < NOW() - ${STALE_LOCK_INTERVAL}::interval
          )
        ORDER BY next_attempt_at, source
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE zone_catalog_reconciliations AS state
      SET processing_revision = state.requested_revision,
          processing_started_at = NOW(),
          updated_at = NOW()
      FROM candidate
      WHERE state.source = candidate.source
      RETURNING state.source, state.processing_revision, state.attempt_count
    `;
    return rows[0] ?? null;
  }

  private async complete(claim: ClaimedReconciliation): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE zone_catalog_reconciliations
      SET completed_revision = GREATEST(completed_revision, ${claim.processing_revision}),
          processing_revision = NULL,
          processing_started_at = NULL,
          attempt_count = 0,
          last_error = NULL,
          completed_at = NOW(),
          next_attempt_at = NOW(),
          updated_at = NOW()
      WHERE source = ${claim.source}
        AND processing_revision = ${claim.processing_revision}
    `;
  }

  private async retry(
    claim: ClaimedReconciliation,
    error: unknown,
  ): Promise<void> {
    const retrySeconds = Math.min(
      300,
      5 * 2 ** Math.min(claim.attempt_count, 6),
    );
    const retryInterval = `${retrySeconds} seconds`;
    const message = (
      error instanceof Error ? error.message : String(error)
    ).slice(0, 4_000);

    await this.prisma.$executeRaw`
      UPDATE zone_catalog_reconciliations
      SET processing_revision = NULL,
          processing_started_at = NULL,
          attempt_count = attempt_count + 1,
          last_error = ${message},
          next_attempt_at = NOW() + ${retryInterval}::interval,
          updated_at = NOW()
      WHERE source = ${claim.source}
        AND processing_revision = ${claim.processing_revision}
    `;
    this.logger.warn(
      `Zone catalog reconciliation for ${claim.source} failed; retrying in ${retrySeconds}s: ${message}`,
    );
  }

  private requireSource(source: string): CatalogSource {
    if (
      source !== CATALOG_SOURCE_TALABAT &&
      source !== CATALOG_SOURCE_CHEFAA
    ) {
      throw new Error(`Unsupported catalog reconciliation source: ${source}`);
    }
    return source;
  }
}
