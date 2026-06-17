import { Logger } from '@nestjs/common';
import { ProductOrderMode } from 'src/common/enums/product-order-mode.enum';
import { ProductSource } from 'src/common/enums/product-source.enum';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { Prisma, PrismaClient } from '../../../generated/prisma/client';
import { TENANT_CATEGORIES } from 'src/tenants/constants/tenant-category';
import {
  buildAllowedCatalogCategoryWhere,
  CATALOG_SOURCE_CHEFAA,
} from 'src/products/catalog-source-policy';

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
};

export const PHARMACY_RANKING_MERCHANTS: RankingSeedMerchant[] = [
  {
    name: 'صيدلية الشفاء',
    phone: '+201000000002',
    slug: 'el-shifaa-pharmacy',
    ownerName: 'أحمد محمد',
    variant: 'complete_100_products',
  },
  {
    name: 'صيدلية بدون منتجات',
    phone: '+201000000021',
    slug: 'ranking-empty-pharmacy',
    ownerName: 'محمد عادل',
    variant: 'no_products',
  },
  {
    name: 'صيدلية عشرين منتج',
    phone: '+201000000022',
    slug: 'ranking-20-products-pharmacy',
    ownerName: 'مصطفى حسن',
    variant: 'twenty_products',
  },
  {
    name: 'صيدلية تصنيف واحد',
    phone: '+201000000023',
    slug: 'ranking-single-category-pharmacy',
    ownerName: 'عمر سامي',
    variant: 'single_category',
  },
  {
    name: 'صيدلية بدون موقع',
    phone: '+201000000024',
    slug: 'ranking-missing-location-pharmacy',
    ownerName: 'إسلام نبيل',
    variant: 'missing_location',
  },
] as const;

/**
 * Seeds pharmacy tenants for directory ranking tests using existing DB catalog items.
 */
export async function seedPharmacyMerchant(prisma: PrismaClient) {
  const logger = new Logger('PharmacyMerchantSeeder');
  const ownerCredential =
    process.env.SEED_PHARMACY_OWNER_CREDENTIAL ??
    process.env.SEED_SUPERMARKET_OWNER_CREDENTIAL;

  await prisma.$transaction(async (tx) => {
    const catalogProducts = await findCatalogProducts(
      tx,
      CATALOG_SOURCE_CHEFAA,
    );

    if (catalogProducts.length === 0) {
      logger.warn(
        'No active catalog items found. Pharmacy ranking products were not seeded.',
      );
    }

    for (const merchant of PHARMACY_RANKING_MERCHANTS) {
      const tenant = await upsertTenant(tx, merchant);

      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenant.id)}, true)`;
      await seedOwner(tx, merchant, tenant.id, ownerCredential, logger);
      await assignBasicPlan(tx, tenant.id, tenant.slug, logger);

      const products = selectProductsForVariant(
        catalogProducts,
        merchant.variant,
      );
      await seedProducts(tx, tenant.id, products);

      logger.log(
        `Seeded pharmacy ranking merchant ${tenant.slug} with ${products.length} catalog-backed products.`,
      );
    }
  });
}

async function upsertTenant(
  tx: Prisma.TransactionClient,
  merchant: RankingSeedMerchant,
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
        category: TENANT_CATEGORIES.PHARMACY.value,
        delivery_fee: 15,
        delivery_available: true,
        delivery_starts_at: '09:00',
        delivery_ends_at: '23:00',
      },
    });
  }

  return tx.tenant.create({
    data: {
      name: merchant.name,
      phone: merchant.phone,
      slug: merchant.slug,
      category: TENANT_CATEGORIES.PHARMACY.value,
      delivery_fee: 15,
      delivery_available: true,
      delivery_starts_at: '09:00',
      delivery_ends_at: '23:00',
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

async function assignBasicPlan(
  tx: Prisma.TransactionClient,
  tenantId: number,
  slug: string,
  logger: Logger,
) {
  const basicPlan = await tx.subscriptionPlan.findFirst({
    where: { name: 'الباقة الاساسية' },
  });

  if (!basicPlan) return;

  const existingSubscription = await tx.tenantSubscription.findFirst({
    where: { tenant_id: tenantId, is_active: true },
  });

  if (!existingSubscription) {
    await tx.tenantSubscription.create({
      data: {
        tenant_id: tenantId,
        plan_id: basicPlan.id,
        is_active: true,
      },
    });
    logger.log(`Assigned basic plan to tenant ${slug}`);
  }
}

async function findCatalogProducts(
  tx: Prisma.TransactionClient,
  preferredSource: string,
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

  return [];
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

    if (existingProduct) {
      await tx.product.update({
        where: { id: existingProduct.id },
        data: {
          image_url: product.image_url,
          source: ProductSource.CATALOG,
          status: ProductStatus.ACTIVE,
          current_price: product.price,
          order_mode: ProductOrderMode.QUANTITY,
          order_config: { quantity: { unit_label: 'علبة' } },
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
        order_mode: ProductOrderMode.QUANTITY,
        order_config: { quantity: { unit_label: 'علبة' } },
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
