import { BadRequestException } from '@nestjs/common';
import {
  TenantCategory,
  TenantStatus,
} from '../../generated/prisma/client';
import { ZoneStorefrontsService } from './zone-storefronts.service';

describe('ZoneStorefrontsService eligibility diagnostics', () => {
  const zone = {
    id: 5,
    area_id: 26,
    category: TenantCategory.grocery,
    operator_tenant_id: 27,
    area: {
      id: 26,
      name_ar: 'حدائق الأهرام',
      name_en: null,
      slug: 'hadayek-al-ahram',
      is_active: true,
      deleted_at: null,
    },
    operator_tenant: {
      id: 27,
      name: 'ماركت حدائق الأهرام',
      category: TenantCategory.grocery,
      status: TenantStatus.active,
      delivery_available: true,
      deleted_at: null,
    },
  };

  const createService = () => {
    const prisma = {
      zoneStorefront: {
        findUnique: jest.fn().mockResolvedValue(zone),
      },
      tenant: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };
    const service = new ZoneStorefrontsService(
      prisma as never,
      {} as never,
      {} as never,
    );
    return { prisma, service };
  };

  it('uses the centralized eligibility filter for valid merchants', async () => {
    const { prisma, service } = createService();
    prisma.tenant.findFirst.mockResolvedValue({
      id: 8,
      name: 'أسواق توب ماركت',
      phone: '01000000000',
      category: TenantCategory.grocery,
    });

    await expect(service.requireEligibleMerchant(5, 8, false)).resolves.toEqual(
      expect.objectContaining({ id: 8 }),
    );
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 8,
          status: TenantStatus.active,
          delivery_available: true,
          category: TenantCategory.grocery,
          tenant_delivery_areas: {
            some: {
              area_id: 26,
              is_active: true,
              deleted_at: null,
            },
          },
        }),
      }),
    );
  });

  it('returns a stable blocker when the zone delivery area is inactive', async () => {
    const { prisma, service } = createService();
    prisma.tenant.findFirst.mockResolvedValue(null);
    prisma.tenant.findMany.mockResolvedValue([
      {
        id: 8,
        status: TenantStatus.active,
        deleted_at: null,
        delivery_available: true,
        category: TenantCategory.grocery,
        operated_zone_storefront: null,
        tenant_delivery_areas: [{ is_active: false, deleted_at: null }],
      },
    ]);

    let thrown: unknown;
    try {
      await service.requireEligibleMerchant(5, 8, false);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(BadRequestException);
    expect((thrown as BadRequestException).getResponse()).toEqual({
      message: 'Merchant is not eligible for this zone',
      code: 'MERCHANT_DELIVERY_AREA_INACTIVE',
    });
  });

  it('requires an active membership when requested by dispatch workflows', async () => {
    const { prisma, service } = createService();
    prisma.tenant.findFirst.mockResolvedValue({
      id: 8,
      name: 'أسواق توب ماركت',
      phone: '01000000000',
      category: TenantCategory.grocery,
    });

    await service.requireEligibleMerchant(5, 8);

    expect(prisma.tenant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          zone_storefront_memberships: {
            some: { zone_storefront_id: 5, is_active: true },
          },
        }),
      }),
    );
  });

  it('reports catalog and merchant blockers before zone activation', () => {
    const { service } = createService();
    const diagnostics = service as unknown as {
      getActivationBlockers: (
        input: typeof zone,
        catalogReady: boolean,
        activeEligibleMerchants: number,
      ) => string[];
    };

    expect(diagnostics.getActivationBlockers(zone, false, 0)).toEqual([
      'ZONE_CATALOG_NOT_READY',
      'ZONE_NO_ELIGIBLE_ACTIVE_MERCHANT',
    ]);
    expect(diagnostics.getActivationBlockers(zone, true, 1)).toEqual([]);
  });
});
