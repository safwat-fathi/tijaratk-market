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
import {
  type DeliveryAvailability,
  DeliverySchedulingService,
} from 'src/delivery-configuration/delivery-scheduling.service';
import {
  ACTIVE_PRODUCT_FOR_ORDERS_WHERE,
  buildProductOrderReadiness,
} from 'src/products/order-readiness-policy';
import {
  StorefrontOrderAvailabilityDto,
  type StorefrontOrderUnavailableReason,
} from './dto/storefront-order-availability.dto';
import { DbTenantContext } from 'src/common/contexts/db-tenant.context';

const STOREFRONT_UNAVAILABLE_MESSAGES: Record<
  StorefrontOrderUnavailableReason,
  string
> = {
  setup_incomplete:
    'هذا المتجر ما زال قيد التجهيز ولا يستقبل الطلبات حالياً.',
  insufficient_products:
    'هذا المتجر يجهّز قائمة المنتجات ولا يستقبل الطلبات حالياً.',
  delivery_unavailable: 'التوصيل غير متاح من هذا المتجر حالياً.',
};

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesDirectoryService: StoresDirectoryService,
    private readonly deliveryConfigurationService: DeliveryConfigurationService,
    private readonly deliverySchedulingService: DeliverySchedulingService,
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

  getDeliveryAvailability(tenant: {
    delivery_available: boolean;
    delivery_starts_at: string | null;
    delivery_ends_at: string | null;
  }) {
    return this.deliverySchedulingService.getAvailability(tenant, new Date(), {
      allowAlwaysOpenWithoutHours: true,
    });
  }

  /** Resolves the authoritative public ordering state for one merchant storefront. */
  async getStorefrontOrderAvailability(
    tenant: Pick<
      Tenant,
      | 'id'
      | 'category'
      | 'onboarding_completed'
      | 'delivery_available'
      | 'delivery_starts_at'
      | 'delivery_ends_at'
    >,
  ): Promise<StorefrontOrderAvailabilityDto> {
    const scopedManager = DbTenantContext.getManager();
    if (scopedManager) {
      return this.resolveStorefrontOrderAvailability(tenant, scopedManager);
    }

    return this.prisma.$transaction(async (manager) => {
      await manager.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenant.id)}, true)`;
      return this.resolveStorefrontOrderAvailability(tenant, manager);
    });
  }

  /** Calculates storefront ordering state through a tenant-scoped database client. */
  private async resolveStorefrontOrderAvailability(
    tenant: Pick<
      Tenant,
      | 'id'
      | 'category'
      | 'onboarding_completed'
      | 'delivery_available'
      | 'delivery_starts_at'
      | 'delivery_ends_at'
    >,
    manager: Prisma.TransactionClient,
  ): Promise<StorefrontOrderAvailabilityDto> {
    const [activeProductsCount, activeDeliveryAreasCount] = await Promise.all([
      manager.product.count({
        where: {
          tenant_id: tenant.id,
          ...ACTIVE_PRODUCT_FOR_ORDERS_WHERE,
        },
      }),
      manager.tenantDeliveryArea.count({
        where: {
          tenant_id: tenant.id,
          is_active: true,
          deleted_at: null,
          area: { is_active: true, deleted_at: null },
        },
      }),
    ]);
    const productReadiness = buildProductOrderReadiness(
      activeProductsCount,
      tenant.category,
    );
    const deliveryAvailability = this.resolvePublicDeliveryAvailability(tenant);

    let reason: StorefrontOrderUnavailableReason | null = null;
    if (!tenant.onboarding_completed) {
      reason = 'setup_incomplete';
    } else if (productReadiness.status !== 'ready_for_orders') {
      reason = 'insufficient_products';
    } else if (
      activeDeliveryAreasCount === 0 ||
      deliveryAvailability.ordering_mode === 'unavailable'
    ) {
      reason = 'delivery_unavailable';
    }

    return {
      accepting_orders: reason === null,
      reason,
      message: reason ? STOREFRONT_UNAVAILABLE_MESSAGES[reason] : null,
      delivery_availability: deliveryAvailability,
    };
  }

  /** Converts invalid or disabled delivery configuration into a fail-closed public state. */
  private resolvePublicDeliveryAvailability(
    tenant: Pick<
      Tenant,
      'delivery_available' | 'delivery_starts_at' | 'delivery_ends_at'
    >,
  ): DeliveryAvailability {
    try {
      return this.getDeliveryAvailability(tenant);
    } catch {
      return {
        timezone: 'Africa/Cairo',
        state: 'unavailable',
        ordering_mode: 'unavailable',
        operating_hours: {
          starts_at: tenant.delivery_starts_at,
          ends_at: tenant.delivery_ends_at,
        },
        schedule_constraints: null,
        slots: [],
      };
    }
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
