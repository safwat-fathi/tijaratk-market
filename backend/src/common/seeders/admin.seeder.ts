import { Logger } from '@nestjs/common';
import { AdminRole, PrismaClient } from '../../../generated/prisma/client';
import * as bcrypt from 'bcrypt';

export async function seedAdmin(prisma: PrismaClient) {
  const logger = new Logger('AdminSeeder');
  try {
    logger.log('Seeding Admin and Plans...');

    // 1. Create Admin
    const adminName = process.env.ADMIN_NAME?.trim();
    const adminPhone = process.env.ADMIN_PHONE?.trim();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminName || !adminPhone || !adminPassword) {
      throw new Error(
        'ADMIN_NAME, ADMIN_PHONE, and ADMIN_PASSWORD are required to seed the admin user.',
      );
    }

    const existingAdmin = await prisma.adminUser.findUnique({
      where: { phone: adminPhone },
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await prisma.adminUser.create({
        data: {
          phone: adminPhone,
          password: hashedPassword,
          name: adminName,
          role: AdminRole.platform_admin,
        },
      });
      logger.log(`✅ Admin user created (phone: ${adminPhone})`);
    } else {
      logger.log(`ℹ️ Admin user already exists`);
    }

    // 2. Create Plans
    const plans = [
      {
        name: 'الباقة الكاملة',
        price: 1000.0,
        features: {
          products: 'unlimited',
          orders: 'unlimited',
          reports: 'customer_history',
          offers: true,
          support: 'vip',
          google_presence: true,
          customization: true,
        },
      },
      {
        name: 'الباقة الذهبية',
        price: 1000.0,
        features: {
          products: 'unlimited',
          orders: 'unlimited',
          reports: 'advanced',
          offers: true,
          support: 'vip',
          google_presence: true,
          branches_management: true,
          multiple_accounts: true,
          ai_assistant: true,
          customization: true,
        },
      },
    ];

    for (const plan of plans) {
      const existingPlan = await prisma.subscriptionPlan.findFirst({
        where: { name: plan.name },
      });

      if (!existingPlan) {
        await prisma.subscriptionPlan.create({
          data: plan,
        });
        logger.log(`✅ Plan '${plan.name}' created`);
      } else {
        await prisma.subscriptionPlan.update({
          where: { id: existingPlan.id },
          data: {
            price: plan.price,
            features: plan.features,
          },
        });
        logger.log(`✅ Plan '${plan.name}' updated`);
      }
    }

    // 3. Clean up the basic plan if it exists
    const fullPlan = await prisma.subscriptionPlan.findFirst({
      where: { name: 'الباقة الكاملة' },
    });

    if (fullPlan) {
      const basicPlan = await prisma.subscriptionPlan.findFirst({
        where: { name: 'الباقة الاساسية' },
      });
      if (basicPlan) {
        // Reassign subscriptions to the full plan
        await prisma.tenantSubscription.updateMany({
          where: { plan_id: basicPlan.id },
          data: { plan_id: fullPlan.id },
        });
        // Delete the basic plan
        await prisma.subscriptionPlan.delete({
          where: { id: basicPlan.id },
        });
        logger.log('✅ Reassigned basic plan subscriptions and deleted basic plan');
      }
    }

    logger.log('Admin seeding completed successfully.');
  } catch (error) {
    logger.error('Admin seeding failed:', error);
    throw error;
  }
}
