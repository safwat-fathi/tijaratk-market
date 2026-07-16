import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Tenant, TenantStatus } from '../../generated/prisma/client';
import { TENANT_CATEGORIES, TenantCategory } from './constants/tenant-category';
import { generateUniqueSlug } from '../common/utils/slug.utils';
import { UpdateTenantDeliverySettingsDto } from './dto/update-tenant-delivery-settings.dto';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { StoresDirectoryService } from 'src/stores-directory/stores-directory.service';
import { getDashboardCacheVersionKey } from 'src/merchant-dashboard/merchant-dashboard.service';
import { DeliveryConfigurationService } from 'src/delivery-configuration/delivery-configuration.service';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesDirectoryService: StoresDirectoryService,
    private readonly deliveryConfigurationService: DeliveryConfigurationService,
    @Optional() @Inject(CACHE_MANAGER) private readonly cacheManager?: Cache,
  ) {}

  async create(
    storeName: string,
    phone: string,
    category?: TenantCategory,
    manager?: Prisma.TransactionClient,
    status: TenantStatus = TenantStatus.active,
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
        status,
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
      select: {
        id: true,
        name: true,
        phone: true,
        category: true,
        slug: true,
        status: true,
        delivery_available: true,
        delivery_starts_at: true,
        delivery_ends_at: true,
        instapay_account_name: true,
        instapay_account_number: true,
        ewallet_account_name: true,
        ewallet_account_number: true,
        card_on_delivery_available: true,
        onboarding_completed: true,
        directory_profile: {
          include: { area: true },
        },
        operated_zone_storefront: { select: { id: true } },
        tenant_delivery_areas: {
          where: {
            is_active: true,
            deleted_at: null,
            area: { is_active: true, deleted_at: null },
          },
          select: {
            id: true,
            area_id: true,
            delivery_fee: true,
            is_active: true,
            area: {
              select: {
                id: true,
                name_ar: true,
                name_en: true,
                slug: true,
                parent_area_id: true,
                city: true,
                governorate: true,
                is_active: true,
                sort_order: true,
              },
            },
          },
          orderBy: [
            { area: { sort_order: 'asc' } },
            { area: { name_ar: 'asc' } },
          ],
        },
      },
    });
  }

  async findOneById(id: number) {
    return this.deliveryConfigurationService.getConfiguration(id);
  }

  /**
   * Updates merchant delivery settings used for public order creation.
   */
  async updateDeliverySettings(
    id: number,
    dto: UpdateTenantDeliverySettingsDto,
  ) {
    const tenant =
      await this.deliveryConfigurationService.updateConfiguration(id, dto);

    await this.storesDirectoryService.recalculateTenantReadiness(id);

    return tenant;
  }

  /**
   * Updates merchant general settings.
   */
  async updateGeneralSettings(
    id: number,
    dto: UpdateTenantSettingsDto,
  ) {
    const normalizeOptionalText = (value?: string) => {
      const normalized = value?.trim();
      return normalized || null;
    };

    const existingTenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { category: true },
    });

    await this.prisma.tenant.update({
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

    return this.findOneById(id);
  }

  /**
   * Updates onboarding progress.
   */
  async updateOnboardingProgress(
    id: number,
    dto: import('./dto/update-tenant-onboarding.dto').UpdateTenantOnboardingDto,
  ) {
    await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.onboarding_completed !== undefined && { onboarding_completed: dto.onboarding_completed }),
        ...(dto.onboarding_step !== undefined && { onboarding_step: dto.onboarding_step }),
      },
    });
    return this.findOneById(id);
  }
}
