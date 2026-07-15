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

type MerchantVariant =
  | 'complete_100_products'
  | 'no_products'
  | 'twenty_products'
  | 'single_category'
  | 'missing_location';

export type RankingSeedMerchant = {
  name: string;
  phone: string;
  slug: string;
  ownerName: string;
  variant: MerchantVariant;
};

type CatalogSeedProduct = {
  name: string;
  image_url: string | null;
  category: string;
  price: Prisma.Decimal | null;
  order_mode?: ProductOrderMode;
  order_config?: Prisma.InputJsonValue;
};

export const SUPERMARKET_RANKING_MERCHANTS: RankingSeedMerchant[] = [
  {
    name: 'سوبر ماركت الخير',
    phone: '+201000000001',
    slug: 'khair-supermarket',
    ownerName: 'خالد محمد',
    variant: 'complete_100_products',
  },
  {
    name: 'سوبر ماركت بدون منتجات',
    phone: '+201000000011',
    slug: 'ranking-empty-supermarket',
    ownerName: 'محمود فاروق',
    variant: 'no_products',
  },
  {
    name: 'سوبر ماركت عشرين منتج',
    phone: '+201000000012',
    slug: 'ranking-20-products-supermarket',
    ownerName: 'سامي عادل',
    variant: 'twenty_products',
  },
  {
    name: 'سوبر ماركت تصنيف واحد',
    phone: '+201000000013',
    slug: 'ranking-single-category-supermarket',
    ownerName: 'هاني يوسف',
    variant: 'single_category',
  },
  {
    name: 'سوبر ماركت بدون موقع',
    phone: '+201000000014',
    slug: 'ranking-missing-location-supermarket',
    ownerName: 'كريم نبيل',
    variant: 'missing_location',
  },
] as const;

/**
 * Seeds supermarket tenants for directory ranking tests using existing DB catalog items.
 */
export async function seedSupermarketMerchant(prisma: PrismaClient) {
  const logger = new Logger('SupermarketMerchantSeeder');
  const ownerCredential = process.env.SEED_SUPERMARKET_OWNER_CREDENTIAL;

  await prisma.$transaction(async (tx) => {
    const catalogProducts = await findCatalogProducts(
      tx,
      CATALOG_SOURCE_TALABAT,
    );

    if (catalogProducts.length === 0) {
      logger.warn(
        'No active catalog items found. Supermarket ranking products were not seeded.',
      );
    }

    for (const merchant of SUPERMARKET_RANKING_MERCHANTS) {
      const tenant = await upsertTenant(tx, merchant);

      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenant.id)}, true)`;
      await seedOwner(tx, merchant, tenant.id, ownerCredential, logger);
      await assignDefaultPlan(tx, tenant.id, tenant.slug, logger);

      const products = selectProductsForVariant(
        catalogProducts,
        merchant.variant,
      );
      await seedProducts(tx, tenant.id, products);

      logger.log(
        `Seeded supermarket ranking merchant ${tenant.slug} with ${products.length} catalog-backed products.`,
      );
    }
  });
}

async function upsertTenant(
  tx: Prisma.TransactionClient,
  merchant: RankingSeedMerchant,
) {
  const onboardingCompleted = merchant.variant === 'complete_100_products';
  const onboardingStep = onboardingCompleted ? 6 : 1;
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
        onboarding_completed: onboardingCompleted,
        onboarding_step: onboardingStep,
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
      onboarding_completed: onboardingCompleted,
      onboarding_step: onboardingStep,
    },
  });
}

async function seedOwner(
  tx: Prisma.TransactionClient,
  merchant: RankingSeedMerchant,
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

function selectProductsForVariant(
  catalogProducts: CatalogSeedProduct[],
  variant: MerchantVariant,
) {
  if (variant === 'no_products') return [];
  if (variant === 'twenty_products')
    return takeDistributedProducts(catalogProducts, 20);
  if (variant === 'single_category')
    return takeSingleCategoryProducts(catalogProducts, 30);
  return takeDistributedProducts(catalogProducts, 100);
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

function takeSingleCategoryProducts(
  catalogProducts: CatalogSeedProduct[],
  count: number,
) {
  if (catalogProducts.length === 0) return [];

  const categories = Array.from(groupByCategory(catalogProducts).values()).sort(
    (a, b) => b.length - a.length,
  );
  const products = categories[0] ?? [];
  return Array.from(
    { length: Math.min(count, Math.max(products.length, 1)) },
    (_, index) => products[index % products.length],
  ).slice(0, count);
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
