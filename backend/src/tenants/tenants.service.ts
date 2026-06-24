import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Tenant } from '../../generated/prisma/client';
import { TENANT_CATEGORIES, TenantCategory } from './constants/tenant-category';
import { generateUniqueSlug } from '../common/utils/slug.utils';
import { UpdateTenantDeliverySettingsDto } from './dto/update-tenant-delivery-settings.dto';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { StoresDirectoryService } from 'src/stores-directory/stores-directory.service';
import { getDashboardCacheVersionKey } from 'src/merchant-dashboard/merchant-dashboard.service';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesDirectoryService: StoresDirectoryService,
    @Optional() @Inject(CACHE_MANAGER) private readonly cacheManager?: Cache,
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

    const defaultPlan = await db.subscriptionPlan.findFirst({
      where: { name: 'الباقة الكاملة' },
    });

    return db.tenant.create({
      data: {
        name: storeName,
        phone,
        slug,
        category: category || TENANT_CATEGORIES.OTHER.value,
        delivery_fee: 20,
        ...(defaultPlan && {
          tenant_subscriptions: {
            create: {
              plan_id: defaultPlan.id,
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
    const normalizeOptionalText = (value?: string) => {
      const normalized = value?.trim();
      return normalized || null;
    };

    const existingTenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { category: true },
    });

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        instapay_account_name: normalizeOptionalText(dto.instapay_account_name),
        instapay_account_number: normalizeOptionalText(
          dto.instapay_account_number,
        ),
        ewallet_account_name: normalizeOptionalText(dto.ewallet_account_name),
        ewallet_account_number: normalizeOptionalText(
          dto.ewallet_account_number,
        ),
        card_on_delivery_available: dto.card_on_delivery_available === true,
      },
    });

    if (existingTenant?.category !== dto.category) {
      await this.cacheManager?.set(
        getDashboardCacheVersionKey(id),
        Date.now().toString(),
      );
    }

    return tenant;
  }

  /**
   * Updates onboarding progress.
   */
  async updateOnboardingProgress(
    id: number,
    dto: import('./dto/update-tenant-onboarding.dto').UpdateTenantOnboardingDto,
  ): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.onboarding_completed !== undefined && { onboarding_completed: dto.onboarding_completed }),
        ...(dto.onboarding_step !== undefined && { onboarding_step: dto.onboarding_step }),
      },
    });
  }
}
