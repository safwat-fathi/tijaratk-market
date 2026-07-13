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
});
