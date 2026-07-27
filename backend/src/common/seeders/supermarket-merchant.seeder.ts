import { Logger } from '@nestjs/common';
import { ProductOrderMode } from 'src/common/enums/product-order-mode.enum';
import { ProductSource } from 'src/common/enums/product-source.enum';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { Prisma, PrismaClient } from '../../../generated/prisma/client';
import { TENANT_CATEGORIES } from 'src/tenants/constants/tenant-category';
import {
  buildAllowedCatalogCategoryWhere,
  CATALOG_SOURCE_TALABAT,
  CatalogSource,
} from 'src/products/catalog-source-policy';
import { supermarketProducts } from './supermarket-products.data';

export type StandardSeedMerchant = {
  name: string;
  phone: string;
  slug: string;
  ownerName: string;
};

type CatalogSeedProduct = {
  name: string;
  image_url: string | null;
  category: string;
  price: Prisma.Decimal | null;
  order_mode?: ProductOrderMode;
  order_config?: Prisma.InputJsonValue;
};

import { DIRECTORY_AREA_PARENT_ASSIGNMENTS } from './directory-areas.seeder';

export const SUPERMARKET_SEED_MERCHANTS: StandardSeedMerchant[] = [];

let superPhoneCounter = 1000000;
for (const zoneSlugs of Object.values(DIRECTORY_AREA_PARENT_ASSIGNMENTS)) {
  for (const zoneSlug of zoneSlugs) {
    for (let i = 1; i <= 5; i++) {
      superPhoneCounter++;
      SUPERMARKET_SEED_MERCHANTS.push({
        name: `سوبر ماركت ${zoneSlug} ${i}`,
        phone: `+2010${String(superPhoneCounter).padStart(7, '0')}`,
        slug: `${zoneSlug}-supermarket-${i}`,
        ownerName: `مالك ${zoneSlug} ${i}`,
      });
    }
  }
}

/**
 * Seeds supermarket tenants using existing DB catalog items.
 */
export async function seedSupermarketMerchant(prisma: PrismaClient) {
  const logger = new Logger('SupermarketMerchantSeeder');
  const ownerCredential = process.env.SEED_SUPERMARKET_OWNER_CREDENTIAL;

  await prisma.$transaction(
    async (tx) => {
      const catalogProducts = await findCatalogProducts(
        tx,
        CATALOG_SOURCE_TALABAT,
      );

    if (catalogProducts.length === 0) {
      logger.warn(
        'No active catalog items found. Supermarket products were not seeded.',
      );
    }

    for (const merchant of SUPERMARKET_SEED_MERCHANTS) {
      const tenant = await upsertTenant(tx, merchant);

      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenant.id)}, true)`;
      await seedOwner(tx, merchant, tenant.id, ownerCredential, logger);
      await assignDefaultPlan(tx, tenant.id, tenant.slug, logger);

      const products = takeDistributedProducts(catalogProducts, 100);
      await seedProducts(tx, tenant.id, products);

      logger.log(
        `Seeded supermarket merchant ${tenant.slug} with ${products.length} catalog-backed products.`,
      );
    }
  }, { timeout: 120000 });
}

async function upsertTenant(
  tx: Prisma.TransactionClient,
  merchant: StandardSeedMerchant,
) {
  const existingTenant = await tx.tenant.findFirst({
    where: {
      OR: [{ phone: merchant.phone }, { slug: merchant.slug }],
    },
  });

  if (existingTenant) {
    return tx.tenant.update({
      where: { id: existingTenant.id },
      data: {
        name: merchant.name,
        phone: merchant.phone,
        slug: merchant.slug,
        category: TENANT_CATEGORIES.GROCERY.value,
        delivery_fee: 15,
        delivery_available: true,
        delivery_starts_at: '09:00',
        delivery_ends_at: '22:00',
        onboarding_completed: true,
        onboarding_step: 6,
      },
    });
  }

  return tx.tenant.create({
    data: {
      name: merchant.name,
      phone: merchant.phone,
      slug: merchant.slug,
      category: TENANT_CATEGORIES.GROCERY.value,
      delivery_fee: 15,
      delivery_available: true,
      delivery_starts_at: '09:00',
      delivery_ends_at: '22:00',
      onboarding_completed: true,
      onboarding_step: 6,
    },
  });
}

async function seedOwner(
  tx: Prisma.TransactionClient,
  merchant: StandardSeedMerchant,
  tenantId: number,
  ownerCredential: string | undefined,
  logger: Logger,
) {
  const ownerExists = await tx.user.findFirst({
    where: { phone: merchant.phone },
  });

  if (!ownerExists && !ownerCredential) {
    logger.warn(`No owner credential found for ${merchant.slug}`);
    return;
  }

  if (!ownerExists) {
    await tx.user.create({
      data: {
        tenant_id: tenantId,
        phone: merchant.phone,
        name: merchant.ownerName,
        password: ownerCredential!,
        role: 'owner',
      },
    });
  }
}
async function assignDefaultPlan(
  tx: Prisma.TransactionClient,
  tenantId: number,
  slug: string,
  logger: Logger,
) {
  const defaultPlan = await tx.subscriptionPlan.findFirst({
    where: { name: 'الباقة الكاملة' },
  });

  if (!defaultPlan) return;

  const existingSubscription = await tx.tenantSubscription.findFirst({
    where: { tenant_id: tenantId, is_active: true },
  });

  if (!existingSubscription) {
    await tx.tenantSubscription.create({
      data: {
        tenant_id: tenantId,
        plan_id: defaultPlan.id,
        is_active: true,
      },
    });
    logger.log(`Assigned default plan to tenant ${slug}`);
  }
}

async function findCatalogProducts(
  tx: Prisma.TransactionClient,
  preferredSource: CatalogSource,
): Promise<CatalogSeedProduct[]> {
  const preferredProducts = await tx.catalogItem.findMany({
    where: {
      is_active: true,
      source: preferredSource,
      category: buildAllowedCatalogCategoryWhere(preferredSource),
    },
    select: {
      name: true,
      image_url: true,
      category: true,
      price: true,
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }, { id: 'asc' }],
  });

  if (preferredProducts.length > 0) {
    return preferredProducts;
  }

  return supermarketProducts.map((p) => ({
    name: p.name,
    image_url: null,
    category: p.category,
    price: p.current_price ? new Prisma.Decimal(p.current_price) : null,
    order_mode: p.order_mode,
    order_config: p.order_config,
  }));
}

function takeDistributedProducts(
  catalogProducts: CatalogSeedProduct[],
  count: number,
) {
  if (catalogProducts.length === 0) return [];

  const categories = groupByCategory(catalogProducts);
  const selected: CatalogSeedProduct[] = [];

  while (selected.length < count) {
    let addedInRound = false;
    for (const products of categories.values()) {
      if (selected.length >= count) break;
      const product = products[selected.length % products.length];
      if (product) {
        selected.push(product);
        addedInRound = true;
      }
    }
    if (!addedInRound) break;
  }

  return selected.slice(0, count);
}

function groupByCategory(catalogProducts: CatalogSeedProduct[]) {
  const categories = new Map<string, CatalogSeedProduct[]>();
  for (const product of catalogProducts) {
    const category = product.category?.trim() || 'أخرى';
    const products = categories.get(category) ?? [];
    products.push({ ...product, category });
    categories.set(category, products);
  }
  return categories;
}

async function seedProducts(
  tx: Prisma.TransactionClient,
  tenantId: number,
  products: CatalogSeedProduct[],
) {
  await tx.product.updateMany({
    where: { tenant_id: tenantId, status: ProductStatus.ACTIVE },
    data: { status: ProductStatus.ARCHIVED },
  });

  const categoryNames = Array.from(
    new Set(products.map((product) => product.category.trim()).filter(Boolean)),
  );

  for (const categoryName of categoryNames) {
    await tx.tenantProductCategory.upsert({
      where: {
        tenant_id_name: {
          tenant_id: tenantId,
          name: categoryName,
        },
      },
      update: { deleted_at: null },
      create: { tenant_id: tenantId, name: categoryName },
    });
  }

  for (const [index, product] of products.entries()) {
    const name = buildProductName(product.name, index, products);
    const category = product.category.trim() || 'أخرى';
    const existingProduct = await tx.product.findFirst({
      where: {
        tenant_id: tenantId,
        name,
        category,
      },
    });

    const orderMode = product.order_mode ?? ProductOrderMode.QUANTITY;
    const orderConfig = product.order_config ?? { quantity: { unit_label: 'قطعة' } };

    if (existingProduct) {
      await tx.product.update({
        where: { id: existingProduct.id },
        data: {
          image_url: product.image_url,
          source: ProductSource.CATALOG,
          status: ProductStatus.ACTIVE,
          current_price: product.price,
          order_mode: orderMode,
          order_config: orderConfig as Prisma.InputJsonValue,
          is_available: true,
          deleted_at: null,
        },
      });
      continue;
    }

    await tx.product.create({
      data: {
        tenant_id: tenantId,
        name,
        image_url: product.image_url,
        category,
        source: ProductSource.CATALOG,
        status: ProductStatus.ACTIVE,
        current_price: product.price,
        order_mode: orderMode,
        order_config: orderConfig as Prisma.InputJsonValue,
        is_available: true,
      },
    });
  }
}

function buildProductName(
  name: string,
  index: number,
  products: CatalogSeedProduct[],
) {
  const previousUseCount = products
    .slice(0, index)
    .filter((product) => product.name === name).length;

  return previousUseCount === 0
    ? name
    : `${name} - نسخة ${previousUseCount + 1}`;
}
