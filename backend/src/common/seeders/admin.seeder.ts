import { Logger } from '@nestjs/common';
import { PrismaClient } from '../../../generated/prisma/client';
import * as bcrypt from 'bcrypt';

export async function seedAdmin(prisma: PrismaClient) {
  const logger = new Logger('AdminSeeder');
  try {
    logger.log('Seeding Admin and Plans...');

    // 1. Create Admin
    const adminPhone = process.env.ADMIN_PHONE?.trim();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPhone || !adminPassword) {
      throw new Error(
        'ADMIN_PHONE and ADMIN_PASSWORD are required to seed the admin user.',
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
          name: 'System Admin',
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
        price: 599.0,
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
        price: 699.0,
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
        logger.log(`ℹ️ Plan '${plan.name}' already exists`);
      }
    }

    logger.log('Admin seeding completed successfully.');
  } catch (error) {
    logger.error('Admin seeding failed:', error);
    throw error;
  }
}
