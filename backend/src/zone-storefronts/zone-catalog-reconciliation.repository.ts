import type { Prisma } from '../../generated/prisma/client';
import type { CatalogSource } from 'src/products/catalog-source-policy';
import type { PrismaService } from 'src/prisma/prisma.service';

type ReconciliationClient = PrismaService | Prisma.TransactionClient;

/** Coalesces catalog mutations into one durable source-scoped revision. */
export async function enqueueZoneCatalogReconciliation(
  client: ReconciliationClient,
  source: CatalogSource,
): Promise<void> {
  await client.$executeRaw`
    INSERT INTO zone_catalog_reconciliations (
      source,
      requested_revision,
      completed_revision,
      next_attempt_at,
      requested_at,
      updated_at
    )
    VALUES (${source}, 1, 0, NOW(), NOW(), NOW())
    ON CONFLICT (source) DO UPDATE
    SET requested_revision = zone_catalog_reconciliations.requested_revision + 1,
        next_attempt_at = NOW(),
        requested_at = NOW(),
        last_error = NULL,
        updated_at = NOW()
  `;
}
