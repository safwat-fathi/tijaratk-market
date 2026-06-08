import { Logger } from '@nestjs/common';
import { ProductOrderMode } from 'src/common/enums/product-order-mode.enum';
import { ProductSource } from 'src/common/enums/product-source.enum';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { PrismaClient } from '../../../generated/prisma/client';
import { TENANT_CATEGORIES } from 'src/tenants/constants/tenant-category';

const SUPERMARKET_TENANT = {
  name: 'سوبر ماركت الخير',
  phone: '+201000000001',
  slug: 'khair-supermarket',
  ownerName: 'خالد محمد',
} as const;

const ownerCredential = process.env.SEED_SUPERMARKET_OWNER_CREDENTIAL;

import { supermarketProducts } from './supermarket-products.data';

/**
 * Seeds a supermarket tenant, owner user, categories, and product inventory.
 */
export async function seedSupermarketMerchant(prisma: PrismaClient) {
  const logger = new Logger('SupermarketMerchantSeeder');

  await prisma.$transaction(async (tx) => {
    let tenant = await tx.tenant.findFirst({
      where: {
        OR: [
          { phone: SUPERMARKET_TENANT.phone },
          { slug: SUPERMARKET_TENANT.slug },
        ],
      },
    });

    if (!tenant) {
      tenant = await tx.tenant.create({
        data: {
          name: SUPERMARKET_TENANT.name,
          phone: SUPERMARKET_TENANT.phone,
          slug: SUPERMARKET_TENANT.slug,
          category: TENANT_CATEGORIES.GROCERY.value,
          delivery_fee: 15,
          delivery_available: true,
          delivery_starts_at: '09:00',
          delivery_ends_at: '22:00',
        },
      });
    }

    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenant.id)}, true)`;

    const ownerExists = await tx.user.findFirst({
      where: { phone: SUPERMARKET_TENANT.phone },
    });

    if (!ownerExists && !ownerCredential) {
      logger.warn('No owner credential found');
      return;
    }

    if (!ownerExists) {
      await tx.user.create({
        data: {
          tenant_id: tenant.id,
          phone: SUPERMARKET_TENANT.phone,
          name: SUPERMARKET_TENANT.ownerName,
          password: ownerCredential,
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
      new Set(supermarketProducts.map((product) => product.category)),
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

    for (const product of supermarketProducts) {
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
      `Seeded supermarket merchant ${tenant.slug} with ${insertedProducts} new products.`,
    );
  });
}
