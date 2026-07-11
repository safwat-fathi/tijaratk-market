import * as bcrypt from 'bcrypt';
import { TenantStatus, UserRole } from '../../generated/prisma/client';
import { AuthService } from './auth.service';

describe('AuthService merchant approval', () => {
  const createService = () => {
    const tx = {};
    const usersService = {
      findOneByPhone: jest.fn(),
      create: jest.fn(),
    };
    const jwtService = { sign: jest.fn().mockReturnValue('token') };
    const tenantsService = { create: jest.fn() };
    const prisma = {
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(async (callback: (client: unknown) => unknown) =>
        callback(tx),
      ),
    };
    const service = new AuthService(
      usersService as any,
      jwtService as any,
      tenantsService as any,
      prisma as any,
      {} as any,
    );

    return { service, usersService, tenantsService, prisma, tx };
  };

  afterEach(() => jest.restoreAllMocks());

  it('creates the pending tenant and owner in one transaction without issuing a token', async () => {
    const { service, usersService, tenantsService, prisma, tx } =
      createService();
    usersService.findOneByPhone.mockResolvedValue(null);
    tenantsService.create.mockResolvedValue({ id: 41 });
    usersService.create.mockResolvedValue({ id: 52 });

    const result = await service.signup({
      storeName: 'متجر الاختبار',
      name: 'أحمد محمد',
      phone: '01012345678',
      category: 'grocery',
      password: 'secret12',
      confirm_password: 'secret12',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tenantsService.create).toHaveBeenCalledWith(
      'متجر الاختبار',
      expect.any(String),
      'grocery',
      tx,
      TenantStatus.pending,
    );
    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.owner, tenant_id: 41 }),
      tx,
    );
    expect(result).toEqual(
      expect.objectContaining({
        code: 'MERCHANT_APPLICATION_RECEIVED',
        status: TenantStatus.pending,
      }),
    );
    expect(result).not.toHaveProperty('access_token');
  });

  it('does not submit an application when the phone already exists', async () => {
    const { service, usersService, prisma } = createService();
    usersService.findOneByPhone.mockResolvedValue({ id: 9 });

    await expect(
      service.signup({
        storeName: 'متجر مكرر',
        name: 'أحمد محمد',
        phone: '01012345678',
        category: 'grocery',
        password: 'secret12',
        confirm_password: 'secret12',
      }),
    ).rejects.toThrow('User with this phone number already exists');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('propagates owner creation failures from the application transaction', async () => {
    const { service, usersService, tenantsService } = createService();
    usersService.findOneByPhone.mockResolvedValue(null);
    tenantsService.create.mockResolvedValue({ id: 41 });
    usersService.create.mockRejectedValue(new Error('owner creation failed'));

    await expect(
      service.signup({
        storeName: 'متجر الاختبار',
        name: 'أحمد محمد',
        phone: '01012345678',
        category: 'grocery',
        password: 'secret12',
        confirm_password: 'secret12',
      }),
    ).rejects.toThrow('owner creation failed');
  });

  it.each([
    [TenantStatus.pending, 'MERCHANT_APPROVAL_PENDING'],
    [TenantStatus.rejected, 'MERCHANT_APPLICATION_REJECTED'],
    [TenantStatus.inactive, 'MERCHANT_ACCOUNT_INACTIVE'],
    [TenantStatus.suspended, 'MERCHANT_ACCOUNT_SUSPENDED'],
  ])('blocks login when tenant status is %s', async (status, code) => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      phone: '201012345678',
      password: 'hash',
      name: 'Owner',
      role: UserRole.owner,
      tenant_id: 2,
      tenant: { status },
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    await expect(
      service.validateUser('01012345678', 'secret12'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code }),
    } as any);
  });

  it('allows an active tenant to authenticate', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      phone: '201012345678',
      password: 'hash',
      name: 'Owner',
      role: UserRole.owner,
      tenant_id: 2,
      tenant: { status: TenantStatus.active },
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    const user = await service.validateUser('01012345678', 'secret12');

    expect(user).toEqual(expect.objectContaining({ id: 1, tenant_id: 2 }));
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('tenant');
  });
});
