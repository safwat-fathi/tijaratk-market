import { BadRequestException } from '@nestjs/common';
import { DeliveryConfigurationService } from './delivery-configuration.service';

describe('DeliveryConfigurationService', () => {
  describe('resolveOrderDelivery', () => {
    const tenantId = 17;

    it('resolves the exact selected area and its relationship fee', async () => {
      const tx = {
        tenantDeliveryArea: {
          findFirst: jest.fn().mockResolvedValue({
            area_id: 4,
            delivery_fee: 12.5,
          }),
          findMany: jest.fn(),
        },
      };
      const service = new DeliveryConfigurationService({} as any);

      await expect(
        service.resolveOrderDelivery(tx as any, tenantId, { areaId: 4 }),
      ).resolves.toEqual({ areaId: 4, deliveryFee: 12.5 });
      expect(tx.tenantDeliveryArea.findMany).not.toHaveBeenCalled();
    });

    it('supports free delivery without falling back to the tenant fee', async () => {
      const tx = {
        tenantDeliveryArea: {
          findFirst: jest.fn().mockResolvedValue({
            area_id: 7,
            delivery_fee: 0,
          }),
          findMany: jest.fn(),
        },
      };
      const service = new DeliveryConfigurationService({} as any);

      await expect(
        service.resolveOrderDelivery(tx as any, tenantId, {
          areaSlug: 'free-zone',
        }),
      ).resolves.toEqual({ areaId: 7, deliveryFee: 0 });
    });

    it('auto-selects when the merchant has exactly one active area', async () => {
      const tx = {
        tenantDeliveryArea: {
          findFirst: jest.fn(),
          findMany: jest.fn().mockResolvedValue([
            {
              area_id: 9,
              delivery_fee: 18,
            },
          ]),
        },
      };
      const service = new DeliveryConfigurationService({} as any);

      await expect(
        service.resolveOrderDelivery(tx as any, tenantId, {}),
      ).resolves.toEqual({ areaId: 9, deliveryFee: 18 });
    });

    it('requires selection when multiple active areas exist', async () => {
      const tx = {
        tenantDeliveryArea: {
          findFirst: jest.fn(),
          findMany: jest.fn().mockResolvedValue([
            { area_id: 9, delivery_fee: 18 },
            { area_id: 10, delivery_fee: 22 },
          ]),
        },
      };
      const service = new DeliveryConfigurationService({} as any);

      await expect(
        service.resolveOrderDelivery(tx as any, tenantId, {}),
      ).rejects.toThrow('حدد منطقة التوصيل');
    });

    it('rejects inactive, unknown, or cross-merchant areas', async () => {
      const tx = {
        tenantDeliveryArea: {
          findFirst: jest.fn().mockResolvedValue(null),
          findMany: jest.fn(),
        },
      };
      const service = new DeliveryConfigurationService({} as any);

      await expect(
        service.resolveOrderDelivery(tx as any, tenantId, { areaId: 99 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('updateConfiguration', () => {
    it('rejects operating windows shorter than one hour before opening a transaction', async () => {
      const prisma = { $transaction: jest.fn() };
      const service = new DeliveryConfigurationService(prisma as any);

      await expect(
        service.updateConfiguration(1, {
          delivery_available: true,
          delivery_starts_at: '09:00',
          delivery_ends_at: '09:59',
          primary_area_id: 3,
          delivery_areas: [{ area_id: 4, delivery_fee: 10 }],
        }),
      ).rejects.toThrow('بساعة على الأقل');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects duplicate areas before opening a transaction', async () => {
      const prisma = { $transaction: jest.fn() };
      const service = new DeliveryConfigurationService(prisma as any);

      await expect(
        service.updateConfiguration(1, {
          delivery_available: true,
          primary_area_id: 3,
          delivery_areas: [
            { area_id: 3, delivery_fee: 10 },
            { area_id: 3, delivery_fee: 15 },
          ],
        }),
      ).rejects.toThrow('لا يمكن تكرار منطقة التوصيل');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects areas outside the primary hierarchy before writing', async () => {
      const tx = {
        tenant: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce({ id: 1, name: 'متجر' }),
        },
        directoryArea: {
          findMany: jest.fn().mockResolvedValue([
            { id: 3, parent_area_id: null },
            { id: 8, parent_area_id: 4 },
          ]),
        },
        tenantDirectoryProfile: { upsert: jest.fn() },
        tenantDeliveryArea: {
          updateMany: jest.fn(),
          upsert: jest.fn(),
        },
      };
      const prisma = {
        $transaction: jest.fn(
          async (callback: (client: typeof tx) => Promise<unknown>) =>
            callback(tx),
        ),
      };
      const service = new DeliveryConfigurationService(prisma as any);

      await expect(
        service.updateConfiguration(1, {
          delivery_available: true,
          primary_area_id: 3,
          delivery_areas: [{ area_id: 8, delivery_fee: 10 }],
        }),
      ).rejects.toThrow('داخل المنطقة الأساسية');
      expect(tx.tenantDirectoryProfile.upsert).not.toHaveBeenCalled();
      expect(tx.tenantDeliveryArea.updateMany).not.toHaveBeenCalled();
    });

    it('preserves configured areas when delivery is disabled with an empty list', async () => {
      const savedConfiguration = {
        id: 1,
        tenant_delivery_areas: [{ area_id: 3, delivery_fee: 10 }],
      };
      const tx = {
        tenant: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce({ id: 1, name: 'متجر' }),
          update: jest.fn().mockResolvedValue({ id: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(savedConfiguration),
        },
        directoryArea: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: 3, parent_area_id: null }]),
        },
        tenantDirectoryProfile: {
          upsert: jest.fn().mockResolvedValue({ tenant_id: 1 }),
        },
        tenantDeliveryArea: {
          updateMany: jest.fn(),
          upsert: jest.fn(),
        },
      };
      const prisma = {
        $transaction: jest.fn(
          async (callback: (client: typeof tx) => Promise<unknown>) =>
            callback(tx),
        ),
      };
      const service = new DeliveryConfigurationService(prisma as any);

      await expect(
        service.updateConfiguration(1, {
          delivery_available: false,
          primary_area_id: 3,
          delivery_areas: [],
        }),
      ).resolves.toEqual(savedConfiguration);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.tenant.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          delivery_available: false,
          delivery_starts_at: null,
          delivery_ends_at: null,
        },
      });
      expect(tx.tenantDeliveryArea.updateMany).not.toHaveBeenCalled();
      expect(tx.tenantDeliveryArea.upsert).not.toHaveBeenCalled();
    });

    it('writes primary area, availability, hours, memberships, and zero fees in one transaction', async () => {
      const savedConfiguration = {
        id: 1,
        delivery_available: true,
        tenant_delivery_areas: [
          { area_id: 3, delivery_fee: 0, is_active: true },
          { area_id: 4, delivery_fee: 25, is_active: true },
        ],
      };
      const tx = {
        tenant: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce({ id: 1, name: 'متجر' }),
          update: jest.fn().mockResolvedValue({ id: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(savedConfiguration),
        },
        directoryArea: {
          findMany: jest.fn().mockResolvedValue([
            { id: 3, parent_area_id: null },
            { id: 4, parent_area_id: 3 },
          ]),
        },
        tenantDirectoryProfile: {
          upsert: jest.fn().mockResolvedValue({ tenant_id: 1 }),
        },
        tenantDeliveryArea: {
          updateMany: jest.fn().mockResolvedValue({ count: 2 }),
          upsert: jest.fn().mockResolvedValue({}),
        },
      };
      const prisma = {
        $transaction: jest.fn(
          async (callback: (client: typeof tx) => Promise<unknown>) =>
            callback(tx),
        ),
      };
      const service = new DeliveryConfigurationService(prisma as any);

      await expect(
        service.updateConfiguration(1, {
          delivery_available: true,
          delivery_starts_at: '10:00',
          delivery_ends_at: '22:00',
          primary_area_id: 3,
          delivery_areas: [
            { area_id: 3, delivery_fee: 0 },
            { area_id: 4, delivery_fee: 25 },
          ],
        }),
      ).resolves.toEqual(savedConfiguration);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.tenantDirectoryProfile.upsert).toHaveBeenCalledWith({
        where: { tenant_id: 1 },
        update: { area_id: 3 },
        create: {
          tenant_id: 1,
          display_name: 'متجر',
          area_id: 3,
        },
      });
      expect(tx.tenant.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          delivery_available: true,
          delivery_starts_at: '10:00',
          delivery_ends_at: '22:00',
        },
      });
      expect(tx.tenantDeliveryArea.updateMany).toHaveBeenCalledWith({
        where: { tenant_id: 1 },
        data: { is_active: false },
      });
      expect(tx.tenantDeliveryArea.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            area_id: 3,
            delivery_fee: 0,
          }),
        }),
      );
    });
  });
});
