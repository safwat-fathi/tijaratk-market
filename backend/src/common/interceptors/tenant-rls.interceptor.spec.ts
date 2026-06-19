import { ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { TenantRlsInterceptor } from './tenant-rls.interceptor';

const createHttpContext = (request: {
  path: string;
  method?: string;
  user?: { tenant_id?: number };
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
}) =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        headers: {},
        query: {},
        ...request,
      }),
    }),
  }) as ExecutionContext;

describe('TenantRlsInterceptor', () => {
  it('wraps dashboard routes with tenant RLS context', async () => {
    const tx = { $executeRaw: jest.fn() };
    const prisma = {
      $transaction: jest.fn(async (callback) => callback(tx)),
    };
    const interceptor = new TenantRlsInterceptor(prisma as any);
    const next = { handle: jest.fn(() => of('ok')) };

    const result = await new Promise((resolve, reject) => {
      interceptor
        .intercept(
          createHttpContext({
            path: '/dashboard/measurements',
            user: { tenant_id: 42 },
          }),
          next,
        )
        .subscribe({ next: resolve, error: reject });
    });

    expect(result).toBe('ok');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(next.handle).toHaveBeenCalledTimes(1);
  });
});
