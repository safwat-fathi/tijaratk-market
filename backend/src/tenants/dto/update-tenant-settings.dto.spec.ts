import { validate } from 'class-validator';
import { TenantCategory } from '../../../generated/prisma/client';
import { UpdateTenantSettingsDto } from './update-tenant-settings.dto';

const buildDto = (overrides: Partial<UpdateTenantSettingsDto> = {}) =>
  Object.assign(new UpdateTenantSettingsDto(), {
    name: 'صيدلية الشفاء',
    category: TenantCategory.pharmacy,
    ...overrides,
  });

describe('UpdateTenantSettingsDto payment account validation', () => {
  it('allows payment methods to be omitted', async () => {
    const errors = await validate(buildDto());

    expect(errors).toHaveLength(0);
  });

  it('allows configured Instapay and e-wallet account pairs', async () => {
    const errors = await validate(
      buildDto({
        instapay_account_name: 'Ahmed Mohamed',
        instapay_account_number: 'ahmed@instapay',
        ewallet_account_name: 'Ahmed Mohamed',
        ewallet_account_number: '01000000000',
      }),
    );

    expect(errors).toHaveLength(0);
  });

  it('rejects Instapay account name without number', async () => {
    const errors = await validate(
      buildDto({ instapay_account_name: 'Ahmed Mohamed' }),
    );

    expect(
      errors.some((error) => error.property === 'instapay_account_number'),
    ).toBe(true);
  });

  it('rejects e-wallet number without account name', async () => {
    const errors = await validate(
      buildDto({ ewallet_account_number: '01000000000' }),
    );

    expect(
      errors.some((error) => error.property === 'ewallet_account_name'),
    ).toBe(true);
  });

});
