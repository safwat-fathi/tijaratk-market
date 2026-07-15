import { Injectable } from '@nestjs/common';
import { TenantCategory } from '../../generated/prisma/client';
import {
  CATALOG_SOURCE_CHEFAA,
  type CatalogSource,
} from 'src/products/catalog-source-policy';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  enqueueZoneCatalogReconciliation,
} from './zone-catalog-reconciliation.repository';
import { ZoneStorefrontsService } from './zone-storefronts.service';

@Injectable()
export class ZoneCatalogReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zoneStorefrontsService: ZoneStorefrontsService,
  ) {}

  enqueue(source: CatalogSource): Promise<void> {
    return enqueueZoneCatalogReconciliation(this.prisma, source);
  }

  /** Synchronizes every zone whose vertical owns the requested source. */
  async reconcileSource(source: CatalogSource): Promise<void> {
    const category =
      source === CATALOG_SOURCE_CHEFAA
        ? TenantCategory.pharmacy
        : TenantCategory.grocery;
    const zones = await this.prisma.zoneStorefront.findMany({
      where: { category, operator_tenant: { category } },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    const failures: string[] = [];
    for (const zone of zones) {
      try {
        await this.zoneStorefrontsService.syncEssentialCatalogAutomatically(
          zone.id,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`zone ${zone.id}: ${message}`);
      }
    }

    if (failures.length > 0) {
      throw new Error(failures.join('; '));
    }
  }
}
