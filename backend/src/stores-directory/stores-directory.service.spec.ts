import { BadRequestException } from '@nestjs/common';
import { StoresDirectoryService } from './stores-directory.service';

describe('StoresDirectoryService area search', () => {
  const visibleAreas = [
    {
      id: 1,
      name_ar: '6 أكتوبر',
      name_en: '6th of October',
      slug: '6th-of-october',
      storesCount: 2,
    },
    {
      id: 2,
      name_ar: 'حدائق أكتوبر',
      name_en: 'Hadayek October',
      slug: 'hadayek-october',
      storesCount: 1,
    },
  ];

  const createService = () => {
    const service = new StoresDirectoryService({} as any);
    const findPublicDeliveryAreas = jest
      .spyOn(service as any, 'findPublicDeliveryAreas')
      .mockResolvedValue([]);
    const toPublicAreaRows = jest
      .spyOn(service as any, 'toPublicAreaRows')
      .mockReturnValue(visibleAreas);

    return { service, findPublicDeliveryAreas, toPublicAreaRows };
  };

  it('ranks normalized public areas without changing the visibility source', async () => {
    const { service, findPublicDeliveryAreas, toPublicAreaRows } =
      createService();

    const results = await service.findAreas('٦ اكتوبر');

    expect(findPublicDeliveryAreas).toHaveBeenCalledTimes(1);
    expect(toPublicAreaRows).toHaveBeenCalledWith([]);
    expect(results.map((area) => area.id)).toEqual([1]);
  });

  it('cannot return an area excluded from the existing public area rows', async () => {
    const { service } = createService();

    await expect(service.findAreas('منطقة مخفية')).resolves.toEqual([]);
  });

  it('uses the lowest active relationship fee for generic store listings', () => {
    const service = new StoresDirectoryService({} as any);

    const fees = (service as any).buildDeliveryFeeMap([
      { tenant: { id: 10 }, delivery_fee: 25 },
      { tenant: { id: 10 }, delivery_fee: 15 },
      { tenant: { id: 11 }, delivery_fee: 0 },
    ]);

    expect(fees.get(10)).toBe(15);
    expect(fees.get(11)).toBe(0);
  });
});

describe('StoresDirectoryService area hierarchy', () => {
  const createService = () => {
    const prisma = {
      directoryArea: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
      tenantDirectoryProfile: { count: jest.fn() },
      tenantDeliveryArea: { count: jest.fn() },
    };

    return {
      prisma,
      service: new StoresDirectoryService(prisma as any),
    };
  };

  const expectHierarchyError = async (
    operation: Promise<unknown>,
    code: string,
  ) => {
    let thrown: unknown;
    try {
      await operation;
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(BadRequestException);
    expect((thrown as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ code }),
    );
  };

  it('creates a main area with a null parent', async () => {
    const { prisma, service } = createService();
    prisma.directoryArea.create.mockResolvedValue({ id: 1 });

    await service.adminCreateArea({
      name_ar: 'الشيخ زايد',
      slug: 'sheikh-zayed',
    });

    expect(prisma.directoryArea.findFirst).not.toHaveBeenCalled();
    expect(prisma.directoryArea.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ parent_area_id: null }),
    });
  });

  it('creates a sub-area under an existing main area', async () => {
    const { prisma, service } = createService();
    prisma.directoryArea.findFirst.mockResolvedValue({
      id: 1,
      parent_area_id: null,
    });
    prisma.directoryArea.create.mockResolvedValue({ id: 2 });

    await service.adminCreateArea({
      name_ar: 'الحي الأول',
      slug: 'first-district',
      parent_area_id: 1,
    });

    expect(prisma.directoryArea.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ parent_area_id: 1 }),
    });
  });

  it('rejects a parent that is itself a sub-area', async () => {
    const { prisma, service } = createService();
    prisma.directoryArea.findFirst.mockResolvedValue({
      id: 2,
      parent_area_id: 1,
    });

    await expectHierarchyError(
      service.adminCreateArea({
        name_ar: 'منطقة متداخلة',
        slug: 'nested-area',
        parent_area_id: 2,
      }),
      'AREA_PARENT_MUST_BE_MAIN',
    );

    expect(prisma.directoryArea.create).not.toHaveBeenCalled();
  });

  it('rejects a parent that does not exist', async () => {
    const { prisma, service } = createService();
    prisma.directoryArea.findFirst.mockResolvedValue(null);

    await expectHierarchyError(
      service.adminCreateArea({
        name_ar: 'منطقة بلا أب',
        slug: 'missing-parent-area',
        parent_area_id: 99,
      }),
      'AREA_PARENT_NOT_FOUND',
    );

    expect(prisma.directoryArea.create).not.toHaveBeenCalled();
  });

  it('rejects assigning an area as its own parent', async () => {
    const { prisma, service } = createService();
    prisma.directoryArea.findFirst.mockResolvedValueOnce({ id: 4 });
    prisma.directoryArea.count.mockResolvedValue(0);

    await expectHierarchyError(
      service.adminUpdateArea(4, { parent_area_id: 4 }),
      'AREA_PARENT_SELF_REFERENCE',
    );

    expect(prisma.directoryArea.update).not.toHaveBeenCalled();
  });

  it('blocks converting a main area that still has children', async () => {
    const { prisma, service } = createService();
    prisma.directoryArea.findFirst
      .mockResolvedValueOnce({ id: 4 })
      .mockResolvedValueOnce({ id: 9, parent_area_id: null });
    prisma.directoryArea.count.mockResolvedValue(2);

    await expectHierarchyError(
      service.adminUpdateArea(4, { parent_area_id: 9 }),
      'AREA_HAS_CHILDREN',
    );

    expect(prisma.directoryArea.update).not.toHaveBeenCalled();
  });

  it('promotes a sub-area by clearing its parent', async () => {
    const { prisma, service } = createService();
    prisma.directoryArea.findFirst.mockResolvedValue({ id: 4 });
    prisma.directoryArea.update.mockResolvedValue({
      id: 4,
      parent_area_id: null,
    });

    await service.adminUpdateArea(4, { parent_area_id: null });

    expect(prisma.directoryArea.count).not.toHaveBeenCalled();
    expect(prisma.directoryArea.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { parent_area_id: null },
    });
  });

  it('blocks deleting a main area that still has children', async () => {
    const { prisma, service } = createService();
    prisma.directoryArea.findFirst.mockResolvedValue({ id: 4 });
    prisma.tenantDirectoryProfile.count.mockResolvedValue(0);
    prisma.tenantDeliveryArea.count.mockResolvedValue(0);
    prisma.directoryArea.count.mockResolvedValue(1);

    await expectHierarchyError(
      service.adminDeleteArea(4),
      'AREA_HAS_CHILDREN',
    );

    expect(prisma.directoryArea.delete).not.toHaveBeenCalled();
  });
});

describe('StoresDirectoryService missing delivery area requests', () => {
  const createService = () => {
    const prisma = {
      directoryArea: { findFirst: jest.fn() },
      missingDeliveryAreaRequest: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    return { prisma, service: new StoresDirectoryService(prisma as any) };
  };

  it('returns the existing pending request instead of duplicating it', async () => {
    const { prisma, service } = createService();
    prisma.directoryArea.findFirst.mockResolvedValue({ id: 1, child_areas: [] });
    prisma.missingDeliveryAreaRequest.findFirst.mockResolvedValue({ id: 4, status: 'pending' });

    await expect(service.createMissingDeliveryAreaRequest(9, {
      main_area_id: 1,
      requested_area_name: 'الطالبية',
    })).resolves.toEqual({ id: 4, status: 'pending' });
    expect(prisma.missingDeliveryAreaRequest.create).not.toHaveBeenCalled();
  });

  it('rejects a report when the main area already has active children', async () => {
    const { prisma, service } = createService();
    prisma.directoryArea.findFirst.mockResolvedValue({ id: 1, child_areas: [{ id: 2 }] });

    await expect(service.createMissingDeliveryAreaRequest(9, {
      main_area_id: 1,
      requested_area_name: 'الطالبية',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves only to an active child of the report main area', async () => {
    const { prisma, service } = createService();
    prisma.missingDeliveryAreaRequest.findUnique.mockResolvedValue({ id: 4, main_area_id: 1, status: 'pending' });
    prisma.directoryArea.findFirst.mockResolvedValue(null);

    await expect(service.adminResolveMissingDeliveryAreaRequest(4, 7, {
      resolved_area_id: 99,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.missingDeliveryAreaRequest.update).not.toHaveBeenCalled();
  });
});
