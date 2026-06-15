import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Tenant } from '../../generated/prisma/client';
import { TENANT_CATEGORIES, TenantCategory } from './constants/tenant-category';
import { generateUniqueSlug } from '../common/utils/slug.utils';
import { UpdateTenantDeliverySettingsDto } from './dto/update-tenant-delivery-settings.dto';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { StoresDirectoryService } from 'src/stores-directory/stores-directory.service';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesDirectoryService: StoresDirectoryService,
  ) {}

  async create(
    storeName: string,
    phone: string,
    category?: TenantCategory,
    manager?: Prisma.TransactionClient,
  ): Promise<Tenant> {
    const db = manager || this.prisma;

    const slug = await generateUniqueSlug(storeName, async (slug) => {
      const existing = await this.prisma.tenant.findUnique({
        where: { slug },
      });
      return !!existing;
    });

    const basicPlan = await db.subscriptionPlan.findFirst({
      where: { name: 'الباقة الاساسية' },
    });

    return db.tenant.create({
      data: {
        name: storeName,
        phone,
        slug,
        category: category || TENANT_CATEGORIES.OTHER.value,
        ...(basicPlan && {
          tenant_subscriptions: {
            create: {
              plan_id: basicPlan.id,
              is_active: true,
            },
          },
        }),
      },
    });
  }

  async findOneBySlug(slug: string) {
    return this.prisma.tenant.findUnique({
      where: { slug },
      include: {
        directory_profile: {
          include: { area: true },
        },
      },
    });
  }

  async findOneById(id: number): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({ where: { id } });
  }

  /**
   * Updates merchant delivery settings used for public order creation.
   */
  async updateDeliverySettings(
    id: number,
    dto: UpdateTenantDeliverySettingsDto,
  ): Promise<Tenant> {
    const deliveryStartsAt = dto.delivery_starts_at?.trim() || null;
    const deliveryEndsAt = dto.delivery_ends_at?.trim() || null;

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        delivery_fee: dto.delivery_fee,
        delivery_available: dto.delivery_available,
        delivery_starts_at: deliveryStartsAt,
        delivery_ends_at: deliveryEndsAt,
      },
    });

    await this.storesDirectoryService.recalculateTenantReadiness(id);

    return tenant;
  }

  /**
   * Updates merchant general settings.
   */
  async updateGeneralSettings(
    id: number,
    dto: UpdateTenantSettingsDto,
  ): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category as any, // Cast to any to avoid strict type issues with generated client vs enum
      },
    });
  }
}
