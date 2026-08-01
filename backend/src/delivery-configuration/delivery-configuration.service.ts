import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryFeeMode, Prisma } from '../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  DeliveryAreaFeeDto,
  UpdateDeliveryConfigurationDto,
} from './dto/update-delivery-configuration.dto';

/**
 * Matches the zones a shopper can actually order from: an active, non-deleted
 * tenant row pointing at an active child area whose parent is also active.
 * Shared by order creation, cart pricing and directory listings so the three
 * cannot drift apart.
 */
export function activeDeliveryZoneWhere(
  tenantId: number,
): Prisma.TenantDeliveryAreaWhereInput {
  return {
    tenant_id: tenantId,
    is_active: true,
    deleted_at: null,
    area: {
      is_active: true,
      deleted_at: null,
      parent_area_id: { not: null },
      parent_area: {
        is: {
          is_active: true,
          deleted_at: null,
        },
      },
    },
  };
}

/** Every column needed to price a zone, whatever its fee mode. */
export const zonePricingSelect = {
  area_id: true,
  delivery_fee: true,
  fee_mode: true,
  min_delivery_fee: true,
  max_delivery_fee: true,
} satisfies Prisma.TenantDeliveryAreaSelect;

export type ZonePricingRow = Prisma.TenantDeliveryAreaGetPayload<{
  select: typeof zonePricingSelect;
}>;

export type ResolvedZonePricing = {
  areaId: number;
  deliveryFee: number;
  feeMode: DeliveryFeeMode;
  minFee: number | null;
  maxFee: number | null;
};

/** Normalizes a zone row into plain numbers, forcing on_order zones to a zero fee. */
export function toZonePricing(row: ZonePricingRow): ResolvedZonePricing {
  const isDeferred = row.fee_mode === DeliveryFeeMode.on_order;
  return {
    areaId: row.area_id,
    deliveryFee: isDeferred ? 0 : Number(row.delivery_fee),
    feeMode: row.fee_mode,
    minFee: row.min_delivery_fee === null ? null : Number(row.min_delivery_fee),
    maxFee: row.max_delivery_fee === null ? null : Number(row.max_delivery_fee),
  };
}

const configurationSelect = {
  id: true,
  name: true,
  phone: true,
  customer_counter: true,
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
  last_bulk_essentials_added_at: true,
  onboarding_completed: true,
  onboarding_step: true,
  created_at: true,
  updated_at: true,
  directory_profile: {
    include: { area: true },
  },
  tenant_delivery_areas: {
    where: { deleted_at: null },
    include: { area: true },
    orderBy: [
      { area: { sort_order: 'asc' as const } },
      { area: { name_ar: 'asc' as const } },
    ],
  },
} satisfies Prisma.TenantSelect;

@Injectable()
export class DeliveryConfigurationService {
  constructor(private readonly prisma: PrismaService) {}

  getConfiguration(tenantId: number) {
    return this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: configurationSelect,
    });
  }

  async updateConfiguration(
    tenantId: number,
    dto: UpdateDeliveryConfigurationDto,
  ) {
    this.validateTimeWindow(dto);
    this.validateUniqueAreas(dto);
    this.validateAreaPricing(dto);

    if (dto.delivery_available && dto.delivery_areas.length === 0) {
      throw new BadRequestException(
        'يجب إضافة منطقة توصيل واحدة على الأقل عند تفعيل التوصيل',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          directory_profile: { select: { area_id: true } },
        },
      });
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }

      const areaIds = Array.from(
        new Set([
          ...dto.main_area_ids,
          ...dto.delivery_areas.map((area) => area.area_id),
        ]),
      );
      const areas = await tx.directoryArea.findMany({
        where: {
          id: { in: areaIds },
          is_active: true,
          deleted_at: null,
        },
        select: {
          id: true,
          parent_area_id: true,
        },
      });
      if (areas.length !== areaIds.length) {
        throw new BadRequestException(
          'واحدة أو أكثر من مناطق التوصيل غير متاحة',
        );
      }

      const invalidArea = areas.find(
        (area) =>
          !dto.main_area_ids.includes(area.id) &&
          (area.parent_area_id === null || !dto.main_area_ids.includes(area.parent_area_id)),
      );
      if (invalidArea) {
        throw new BadRequestException(
          'مناطق التوصيل يجب أن تكون داخل المنطقة الأساسية',
        );
      }

      const primaryAreaId = dto.main_area_ids[0];

      await tx.tenantDirectoryProfile.upsert({
        where: { tenant_id: tenantId },
        update: { area_id: primaryAreaId },
        create: {
          tenant_id: tenantId,
          display_name: tenant.name,
          area_id: primaryAreaId,
        },
      });

      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          delivery_available: dto.delivery_available,
          delivery_starts_at: dto.delivery_starts_at?.trim() || null,
          delivery_ends_at: dto.delivery_ends_at?.trim() || null,
        },
      });

      const primaryAreaChanged =
        tenant.directory_profile?.area_id !== primaryAreaId;
      const shouldUpdateAreas =
        dto.delivery_available ||
        dto.delivery_areas.length > 0 ||
        primaryAreaChanged;
      if (shouldUpdateAreas) {
        await tx.tenantDeliveryArea.updateMany({
          where: { tenant_id: tenantId },
          data: { is_active: false },
        });

        for (const mainAreaId of dto.main_area_ids) {
          await tx.tenantDeliveryArea.upsert({
            where: {
              tenant_id_area_id: {
                tenant_id: tenantId,
                area_id: mainAreaId,
              },
            },
            update: {
              is_active: false,
              deleted_at: null,
            },
            create: {
              tenant_id: tenantId,
              area_id: mainAreaId,
              delivery_fee: 0,
              is_active: false,
            },
          });
        }

        for (const deliveryArea of dto.delivery_areas) {
          const pricing = this.normalizeAreaPricing(deliveryArea);
          await tx.tenantDeliveryArea.upsert({
            where: {
              tenant_id_area_id: {
                tenant_id: tenantId,
                area_id: deliveryArea.area_id,
              },
            },
            update: {
              ...pricing,
              is_active: true,
              deleted_at: null,
            },
            create: {
              tenant_id: tenantId,
              area_id: deliveryArea.area_id,
              ...pricing,
              is_active: true,
            },
          });
        }
      } else {
        await tx.tenantDeliveryArea.updateMany({
          where: {
            tenant_id: tenantId,
            area_id: { in: dto.main_area_ids },
            is_active: true,
          },
          data: { is_active: false },
        });
      }

      return tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: configurationSelect,
      });
    });
  }

  async resolveOrderDelivery(
    tx: Prisma.TransactionClient,
    tenantId: number,
    input: { areaId?: number; areaSlug?: string | null },
  ): Promise<ResolvedZonePricing> {
    const normalizedSlug = input.areaSlug?.trim() || undefined;
    const zoneWhere = activeDeliveryZoneWhere(tenantId);
    const requestedArea =
      input.areaId || normalizedSlug
        ? await tx.tenantDeliveryArea.findFirst({
            where: {
              ...zoneWhere,
              area: {
                ...(zoneWhere.area as Prisma.DirectoryAreaWhereInput),
                ...(input.areaId
                  ? { id: input.areaId }
                  : { slug: normalizedSlug }),
              },
            },
            select: zonePricingSelect,
          })
        : null;

    if (input.areaId || normalizedSlug) {
      if (!requestedArea) {
        throw new BadRequestException(
          'منطقة التوصيل المختارة غير متاحة لهذا المتجر',
        );
      }
      return toZonePricing(requestedArea);
    }

    const availableAreas = await tx.tenantDeliveryArea.findMany({
      where: zoneWhere,
      select: zonePricingSelect,
      take: 2,
      orderBy: { area_id: 'asc' },
    });

    if (availableAreas.length === 0) {
      throw new BadRequestException(
        'لا توجد مناطق توصيل متاحة لهذا المتجر حالياً',
      );
    }
    if (availableAreas.length > 1) {
      throw new BadRequestException(
        'حدد منطقة التوصيل لمعرفة الرسوم وإكمال الطلب',
      );
    }

    return toZonePricing(availableAreas[0]);
  }

  private validateTimeWindow(dto: UpdateDeliveryConfigurationDto) {
    const hasStart = Boolean(dto.delivery_starts_at);
    const hasEnd = Boolean(dto.delivery_ends_at);
    if (hasStart !== hasEnd) {
      throw new BadRequestException('أدخل وقت بداية ونهاية التوصيل معاً');
    }
    if (dto.delivery_starts_at && dto.delivery_ends_at) {
      const toMinutes = (value: string) => {
        const [hours, minutes] = value.split(':').map(Number);
        return hours * 60 + minutes;
      };
      const startMins = toMinutes(dto.delivery_starts_at);
      let endMins = toMinutes(dto.delivery_ends_at);
      if (endMins <= startMins) {
        endMins += 24 * 60;
      }
      if (endMins - startMins < 60) {
        throw new BadRequestException(
          'يجب أن تكون مدة التوصيل ساعة على الأقل',
        );
      }
    }
  }

  private validateUniqueAreas(dto: UpdateDeliveryConfigurationDto) {
    const areaIds = dto.delivery_areas.map((area) => area.area_id);
    if (new Set(areaIds).size !== areaIds.length) {
      throw new BadRequestException('لا يمكن تكرار منطقة التوصيل');
    }
    const hasOverlap = areaIds.some((id) => dto.main_area_ids.includes(id));
    if (hasOverlap) {
      throw new BadRequestException(
        'المناطق الأساسية لا يمكن إضافتها ضمن مناطق التوصيل',
      );
    }
  }

  private validateAreaPricing(dto: UpdateDeliveryConfigurationDto) {
    for (const area of dto.delivery_areas) {
      const feeMode = area.fee_mode ?? DeliveryFeeMode.fixed;
      if (feeMode !== DeliveryFeeMode.on_order) continue;

      const min = area.min_delivery_fee;
      const max = area.max_delivery_fee;
      if (min != null && max != null && min > max) {
        throw new BadRequestException(
          'أقل رسوم توصيل يجب أن تكون أقل من أو تساوي أعلى رسوم',
        );
      }
    }
  }

  /**
   * Collapses a submitted zone into its stored form: a fixed zone keeps its fee
   * and drops any bounds, an on_order zone stores a zero fee and keeps bounds.
   */
  private normalizeAreaPricing(area: DeliveryAreaFeeDto) {
    const feeMode = area.fee_mode ?? DeliveryFeeMode.fixed;
    if (feeMode === DeliveryFeeMode.on_order) {
      return {
        delivery_fee: 0,
        fee_mode: DeliveryFeeMode.on_order,
        min_delivery_fee: area.min_delivery_fee ?? null,
        max_delivery_fee: area.max_delivery_fee ?? null,
      };
    }
    return {
      delivery_fee: area.delivery_fee,
      fee_mode: DeliveryFeeMode.fixed,
      min_delivery_fee: null,
      max_delivery_fee: null,
    };
  }
}
