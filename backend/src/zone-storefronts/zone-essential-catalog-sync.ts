import {
  ProductOrderMode,
  ProductSource,
  ProductStatus,
} from '../../generated/prisma/client';
import type {
  CatalogItem,
  Prisma,
  PrismaClient,
} from '../../generated/prisma/client';
import {
  CATALOG_SOURCE_CHEFAA,
  CATALOG_SOURCE_TALABAT,
  normalizeCatalogCategoryForSource,
  type CatalogSource,
} from 'src/products/catalog-source-policy';

export type ZoneEssentialCatalogItem = Pick<
  CatalogItem,
  'id' | 'name' | 'image_url' | 'category' | 'price'
>;

export type ZoneEssentialCatalogSyncResult = {
  created: number;
  linked: number;
  updated: number;
  archived: number;
  expected_products: number;
  active_products: number;
  active_categories: number;
  catalog_in_sync: boolean;
};

type CatalogReader = Pick<PrismaClient, 'catalogItem'>;

/**
 * Reads every curated essential row for one catalog source. Catalog IDs are
 * authoritative, so duplicate names and categories remain separate products.
 */
export async function findZoneEssentialCatalogItems(
  client: CatalogReader,
  source: CatalogSource,
): Promise<ZoneEssentialCatalogItem[]> {
  const rows = await client.catalogItem.findMany({
    where: {
      source,
      is_active: true,
      is_essential: true,
      deleted_at: null,
    },
    select: {
      id: true,
      name: true,
      image_url: true,
      category: true,
      price: true,
    },
    orderBy: [
      { category: 'asc' },
      { essential_sort_order: { sort: 'asc', nulls: 'last' } },
      { name: 'asc' },
      { id: 'asc' },
    ],
  });

  return rows.map((row) => {
    const name = row.name.trim();
    const normalizedCategory = normalizeCatalogCategoryForSource(
      source,
      row.category,
    );
    const category =
      normalizedCategory ??
      (source === CATALOG_SOURCE_TALABAT ? 'أخرى' : null);

    if (!name || !category) {
      throw new Error(
        `Essential catalog item ${row.id} has an invalid ${source} identity`,
      );
    }

    return { ...row, name, category };
  });
}

/**
 * Reconciles a zone operator's explicit catalog snapshot. Retained prices and
 * order configuration are preserved while essential visibility is enforced.
 */
export async function syncZoneEssentialCatalog(
  tx: Prisma.TransactionClient,
  tenantId: number,
  source: CatalogSource,
  catalogItems: ZoneEssentialCatalogItem[],
): Promise<ZoneEssentialCatalogSyncResult> {
  const existingProducts = await tx.product.findMany({
    where: {
      tenant_id: tenantId,
      OR: [
        { source: ProductSource.catalog },
        { catalog_item_id: { not: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      image_url: true,
      category: true,
      source: true,
      status: true,
      is_available: true,
      deleted_at: true,
      catalog_item_id: true,
    },
    orderBy: { id: 'asc' },
  });
  const byCatalogItemId = new Map(
    existingProducts
      .filter((product) => product.catalog_item_id !== null)
      .map((product) => [product.catalog_item_id as number, product]),
  );
  const unlinkedByExactIdentity = new Map<
    string,
    Array<(typeof existingProducts)[number]>
  >();
  for (const product of existingProducts) {
    if (
      product.catalog_item_id !== null ||
      product.source !== ProductSource.catalog
    ) {
      continue;
    }
    const key = exactCatalogKey(product.name, product.category);
    const candidates = unlinkedByExactIdentity.get(key) ?? [];
    candidates.push(product);
    unlinkedByExactIdentity.set(key, candidates);
  }

  let created = 0;
  let linked = 0;
  let updated = 0;
  const retainedProductIds: number[] = [];
  const missingItems: ZoneEssentialCatalogItem[] = [];
  const now = new Date();

  for (const item of catalogItems) {
    const linkedProduct = byCatalogItemId.get(item.id);
    const legacyCandidates = linkedProduct
      ? undefined
      : unlinkedByExactIdentity.get(exactCatalogKey(item.name, item.category));
    const legacyProduct = legacyCandidates?.shift();
    const existing = linkedProduct ?? legacyProduct;

    if (existing) {
      const wasUnlinked = existing.catalog_item_id === null;
      const identityChanged =
        existing.name !== item.name ||
        existing.image_url !== item.image_url ||
        existing.category !== item.category ||
        existing.status !== ProductStatus.active ||
        existing.is_available !== true ||
        existing.deleted_at !== null;
      if (wasUnlinked || identityChanged) {
        await tx.product.update({
          where: { id: existing.id },
          data: {
            catalog_item_id: item.id,
            name: item.name,
            image_url: item.image_url,
            category: item.category,
            source: ProductSource.catalog,
            status: ProductStatus.active,
            is_available: true,
            deleted_at: null,
            updated_at: now,
          },
        });
      }
      retainedProductIds.push(existing.id);
      if (wasUnlinked) linked += 1;
      else if (identityChanged) updated += 1;
      continue;
    }

    missingItems.push(item);
  }

  if (missingItems.length > 0) {
    const createdProducts = await tx.product.createMany({
      data: missingItems.map((item) => ({
        tenant_id: tenantId,
        catalog_item_id: item.id,
        name: item.name,
        image_url: item.image_url,
        category: item.category,
        source: ProductSource.catalog,
        status: ProductStatus.active,
        current_price: item.price,
        order_mode: ProductOrderMode.quantity,
        order_config: {
          quantity: {
            unit_label: source === CATALOG_SOURCE_CHEFAA ? 'علبة' : 'قطعة',
          },
        } satisfies Prisma.InputJsonValue,
        is_available: true,
        price_needs_review: true,
      })),
      skipDuplicates: true,
    });
    created = createdProducts.count;
    const insertedRows = await tx.product.findMany({
      where: {
        tenant_id: tenantId,
        source: ProductSource.catalog,
        catalog_item_id: { in: missingItems.map((item) => item.id) },
      },
      select: { id: true },
    });
    retainedProductIds.push(...insertedRows.map((product) => product.id));
  }

  const archived = await tx.product.updateMany({
    where: {
      tenant_id: tenantId,
      id: { notIn: retainedProductIds },
      AND: [
        {
          OR: [
            { source: ProductSource.catalog },
            { catalog_item_id: { not: null } },
          ],
        },
        {
          OR: [
            { status: { not: ProductStatus.archived } },
            { is_available: true },
          ],
        },
      ],
    },
    data: {
      status: ProductStatus.archived,
      is_available: false,
      updated_at: now,
    },
  });

  const categories = Array.from(
    new Set(catalogItems.map((item) => item.category)),
  );
  for (const category of categories) {
    await tx.tenantProductCategory.upsert({
      where: { tenant_id_name: { tenant_id: tenantId, name: category } },
      update: { deleted_at: null, updated_at: now },
      create: { tenant_id: tenantId, name: category },
    });
  }

  const publicProductWhere: Prisma.ProductWhereInput = {
    tenant_id: tenantId,
    catalog_item_id: { not: null },
    source: ProductSource.catalog,
    status: ProductStatus.active,
    is_available: true,
    deleted_at: null,
  };
  const [activeProducts, activeCategoryRows] = await Promise.all([
    tx.product.count({ where: publicProductWhere }),
    tx.product.groupBy({
      by: ['category'],
      where: publicProductWhere,
    }),
  ]);

  return {
    created,
    linked,
    updated,
    archived: archived.count,
    expected_products: catalogItems.length,
    active_products: activeProducts,
    active_categories: activeCategoryRows.length,
    catalog_in_sync: activeProducts === catalogItems.length,
  };
}

function exactCatalogKey(name: string, category: string): string {
  return `${name}\u0000${category}`;
}
