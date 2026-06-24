import { TenantCategory } from '../../generated/prisma/client';
import { getDashboardCacheVersionKey } from 'src/merchant-dashboard/merchant-dashboard.service';
import { TenantsService } from './tenants.service';

const createService = (existingCategory: TenantCategory) => {
  const updatedTenant = {
    id: 1,
    name: 'Store',
    category: TenantCategory.greengrocer,
  };
  const prisma = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ category: existingCategory }),
      update: jest.fn().mockResolvedValue(updatedTenant),
    },
  };
  const storesDirectoryService = {
    recalculateTenantReadiness: jest.fn(),
  };
  const cacheManager = {
    set: jest.fn(),
  };
  const service = new TenantsService(
    prisma as any,
    storesDirectoryService as any,
    cacheManager as any,
  );

  return { service, prisma, cacheManager, updatedTenant };
};

const updateSettingsDto = {
  name: 'Store',
  category: TenantCategory.greengrocer,
  card_on_delivery_available: false,
};

describe('TenantsService', () => {
  it('bumps dashboard cache version when tenant category changes', async () => {
    const { service, cacheManager, updatedTenant } = createService(
      TenantCategory.grocery,
    );

    await expect(
      service.updateGeneralSettings(1, updateSettingsDto),
    ).resolves.toBe(updatedTenant);

    expect(cacheManager.set).toHaveBeenCalledWith(
      getDashboardCacheVersionKey(1),
      expect.any(String),
    );
  });

  it('does not bump dashboard cache version when tenant category is unchanged', async () => {
    const { service, cacheManager } = createService(TenantCategory.greengrocer);

    await service.updateGeneralSettings(1, updateSettingsDto);

    expect(cacheManager.set).not.toHaveBeenCalled();
  });
});
