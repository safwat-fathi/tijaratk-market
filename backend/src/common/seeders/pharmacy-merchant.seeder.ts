import { Logger } from '@nestjs/common';
import { ProductOrderMode } from 'src/common/enums/product-order-mode.enum';
import { ProductSource } from 'src/common/enums/product-source.enum';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { PrismaClient } from '../../../generated/prisma/client';
import { TENANT_CATEGORIES } from 'src/tenants/constants/tenant-category';

const PHARMACY_TENANT = {
  name: 'صيدلية الشفاء',
  phone: '+201000000002',
  slug: 'el-shifaa-pharmacy',
  ownerName: 'أحمد محمد',
} as const;

const pharmacyProducts = [
  {
    name: 'بنادول إكسترا 24 قرص',
    category: 'أدوية',
    current_price: 45,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: { quantity: { unit_label: 'علبة' } },
  },
  {
    name: 'كتافلام 50 مجم 20 قرص',
    category: 'أدوية',
    current_price: 51,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: { quantity: { unit_label: 'علبة' } },
  },
  {
    name: 'فيتامين سي 1000 مجم فوار',
    category: 'فيتامينات ومكملات',
    current_price: 65,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: { quantity: { unit_label: 'عبوة' } },
  },
  {
    name: 'ستريبسيلز عسل وليمون 24 قرص',
    category: 'مسكنات وحلوى الحلق',
    current_price: 115,
    order_mode: ProductOrderMode.QUANTITY,
    order_config: { quantity: { unit_label: 'علبة' } },
  },
];

/**
 * Seeds a pharmacy tenant, owner user, categories, and pharmacy products.
 */
export async function seedPharmacyMerchant(prisma: PrismaClient) {
  const logger = new Logger('PharmacyMerchantSeeder');
  const ownerCredential = process.env.SEED_PHARMACY_OWNER_CREDENTIAL ?? process.env.SEED_SUPERMARKET_OWNER_CREDENTIAL;

  await prisma.$transaction(async (tx) => {
    let tenant = await tx.tenant.findFirst({
      where: {
        OR: [
          { phone: PHARMACY_TENANT.phone },
          { slug: PHARMACY_TENANT.slug },
        ],
      },
    });

    if (!tenant) {
      tenant = await tx.tenant.create({
        data: {
          name: PHARMACY_TENANT.name,
          phone: PHARMACY_TENANT.phone,
          slug: PHARMACY_TENANT.slug,
          category: TENANT_CATEGORIES.PHARMACY.value,
          delivery_fee: 15,
          delivery_available: true,
          delivery_starts_at: '09:00',
          delivery_ends_at: '23:00',
        },
      });
    }

    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenant.id)}, true)`;

    const ownerExists = await tx.user.findFirst({
      where: { phone: PHARMACY_TENANT.phone },
    });

    if (!ownerExists && !ownerCredential) {
      logger.warn('No owner credential found');
      return;
    }

    if (!ownerExists) {
      await tx.user.create({
        data: {
          tenant_id: tenant.id,
          phone: PHARMACY_TENANT.phone,
          name: PHARMACY_TENANT.ownerName,
          password: ownerCredential!,
          role: 'owner',
        },
      });
    }

    const basicPlan = await tx.subscriptionPlan.findFirst({
      where: { name: 'الباقة الاساسية' },
    });

    if (basicPlan) {
      const existingSubscription = await tx.tenantSubscription.findFirst({
        where: { tenant_id: tenant.id, is_active: true },
      });

      if (!existingSubscription) {
        await tx.tenantSubscription.create({
          data: {
            tenant_id: tenant.id,
            plan_id: basicPlan.id,
            is_active: true,
          },
        });
        logger.log(`Assigned basic plan to tenant ${tenant.slug}`);
      }
    }

    const categoryNames = Array.from(
      new Set(pharmacyProducts.map((product) => product.category)),
    );

    for (const categoryName of categoryNames) {
      const categoryExists = await tx.tenantProductCategory.findFirst({
        where: { tenant_id: tenant.id, name: categoryName },
      });

      if (!categoryExists) {
        await tx.tenantProductCategory.create({
          data: { tenant_id: tenant.id, name: categoryName },
        });
      }
    }

    let insertedProducts = 0;

    for (const product of pharmacyProducts) {
      const productExists = await tx.product.findFirst({
        where: {
          tenant_id: tenant.id,
          name: product.name,
          category: product.category,
        },
      });

      if (!productExists) {
        await tx.product.create({
          data: {
            ...product,
            tenant_id: tenant.id,
            source: ProductSource.MANUAL,
            status: ProductStatus.ACTIVE,
            is_available: true,
          },
        });
        insertedProducts += 1;
      }
    }

    logger.log(
      `Seeded pharmacy merchant ${tenant.slug} with ${insertedProducts} new products.`,
    );
  });
}
