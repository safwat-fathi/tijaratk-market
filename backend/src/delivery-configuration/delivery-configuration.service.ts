import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateDeliveryConfigurationDto } from './dto/update-delivery-configuration.dto';

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
          dto.primary_area_id,
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
          area.id !== dto.primary_area_id &&
          area.parent_area_id !== dto.primary_area_id,
      );
      if (invalidArea) {
        throw new BadRequestException(
          'مناطق التوصيل يجب أن تكون داخل المنطقة الأساسية',
        );
      }

      await tx.tenantDirectoryProfile.upsert({
        where: { tenant_id: tenantId },
        update: { area_id: dto.primary_area_id },
        create: {
          tenant_id: tenantId,
          display_name: tenant.name,
          area_id: dto.primary_area_id,
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
        tenant.directory_profile?.area_id !== dto.primary_area_id;
      const shouldUpdateAreas =
        dto.delivery_available ||
        dto.delivery_areas.length > 0 ||
        primaryAreaChanged;
      if (shouldUpdateAreas) {
        await tx.tenantDeliveryArea.updateMany({
          where: { tenant_id: tenantId },
          data: { is_active: false },
        });

        for (const deliveryArea of dto.delivery_areas) {
          await tx.tenantDeliveryArea.upsert({
            where: {
              tenant_id_area_id: {
                tenant_id: tenantId,
                area_id: deliveryArea.area_id,
              },
            },
            update: {
              delivery_fee: deliveryArea.delivery_fee,
              is_active: true,
              deleted_at: null,
            },
            create: {
              tenant_id: tenantId,
              area_id: deliveryArea.area_id,
              delivery_fee: deliveryArea.delivery_fee,
              is_active: true,
            },
          });
        }
      } else {
        await tx.tenantDeliveryArea.updateMany({
          where: {
            tenant_id: tenantId,
            area_id: dto.primary_area_id,
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
  ): Promise<{ areaId: number; deliveryFee: number }> {
    const normalizedSlug = input.areaSlug?.trim() || undefined;
    const requestedArea =
      input.areaId || normalizedSlug
        ? await tx.tenantDeliveryArea.findFirst({
            where: {
              tenant_id: tenantId,
              is_active: true,
              deleted_at: null,
              area: {
                is_active: true,
                deleted_at: null,
                ...(input.areaId
                  ? { id: input.areaId }
                  : { slug: normalizedSlug }),
              },
            },
            select: { area_id: true, delivery_fee: true },
          })
        : null;

    if (input.areaId || normalizedSlug) {
      if (!requestedArea) {
        throw new BadRequestException(
          'منطقة التوصيل المختارة غير متاحة لهذا المتجر',
        );
      }
      return {
        areaId: requestedArea.area_id,
        deliveryFee: Number(requestedArea.delivery_fee),
      };
    }

    const availableAreas = await tx.tenantDeliveryArea.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        deleted_at: null,
        area: { is_active: true, deleted_at: null },
      },
      select: { area_id: true, delivery_fee: true },
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

    return {
      areaId: availableAreas[0].area_id,
      deliveryFee: Number(availableAreas[0].delivery_fee),
    };
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
    if (areaIds.includes(dto.primary_area_id)) {
      throw new BadRequestException(
        'المنطقة الأساسية لا يمكن إضافتها ضمن مناطق التوصيل',
      );
    }
  }
}
