import { UnauthorizedException } from '@nestjs/common';
import { TenantStatus, UserRole } from '../../../generated/prisma/client';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy merchant approval', () => {
  const payload = {
    sub: 10,
    phone: '201012345678',
    tenantId: 20,
    role: UserRole.owner,
  };

  const createStrategy = (status: TenantStatus) => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: payload.sub,
          tenant: { status },
        }),
      },
    };
    const config = { get: jest.fn().mockReturnValue('test-secret') };

    return new JwtStrategy(prisma as any, config as any);
  };

  it('accepts an existing token while its tenant remains active', async () => {
    await expect(
      createStrategy(TenantStatus.active).validate(payload),
    ).resolves.toEqual(expect.objectContaining({ tenant_id: 20 }));
  });

  it.each([
    TenantStatus.pending,
    TenantStatus.rejected,
    TenantStatus.inactive,
    TenantStatus.suspended,
  ])('invalidates an existing token when tenant status is %s', async (status) => {
    await expect(createStrategy(status).validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
