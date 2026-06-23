import {
  TenantCancellationPolicyActorType,
  TenantCancellationPolicyEventType,
  TenantStatus,
} from '../../generated/prisma/client';
import { TenantCancellationPolicyService } from './tenant-cancellation-policy.service';

const createState = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  tenant_id: 1,
  window_start: new Date('2026-06-01T00:00:00.000Z'),
  window_end: new Date('2026-06-30T23:59:59.999Z'),
  cancellation_count: 0,
  warning_threshold: 10,
  suspension_threshold: 16,
  is_probation: false,
  last_warning_at: null,
  last_suspension_at: null,
  last_suspension_event_id: null,
  last_suspension_policy: false,
  created_at: new Date('2026-06-01T00:00:00.000Z'),
  updated_at: new Date('2026-06-01T00:00:00.000Z'),
  ...overrides,
});

const createManager = (initialState: any = null) => {
  let state = initialState;
  const events: any[] = [];
  const tenant = { id: 1, status: TenantStatus.active };

  const manager = {
    tenantCancellationPolicyState: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(state)),
      findUniqueOrThrow: jest.fn().mockImplementation(() => Promise.resolve(state)),
      upsert: jest.fn().mockImplementation(({ create, update }) => {
        state = state
          ? { ...state, ...update }
          : createState({ ...create, id: 1 });
        return Promise.resolve(state);
      }),
      update: jest.fn().mockImplementation(({ data }) => {
        state = { ...state, ...data };
        return Promise.resolve(state);
      }),
      updateMany: jest.fn().mockImplementation(({ data }) => {
        if (state) state = { ...state, ...data };
        return Promise.resolve({ count: state ? 1 : 0 });
      }),
    },
    tenantCancellationPolicyEvent: {
      create: jest.fn().mockImplementation(({ data }) => {
        const event = {
          id: events.length + 1,
          created_at: new Date('2026-06-18T10:00:00.000Z'),
          ...data,
        };
        events.push(event);
        return Promise.resolve(event);
      }),
      findFirst: jest.fn().mockImplementation(() =>
        Promise.resolve(events[events.length - 1] ?? null),
      ),
    },
    tenant: {
      update: jest.fn().mockImplementation(({ data }) => {
        Object.assign(tenant, data);
        return Promise.resolve(tenant);
      }),
    },
    __getState: () => state,
    __getEvents: () => events,
    __getTenant: () => tenant,
  };

  return manager as any;
};

describe('TenantCancellationPolicyService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-18T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('issues a warning at the 10th merchant cancellation without suspending', async () => {
    const manager = createManager(createState({ cancellation_count: 9 }));
    const service = new TenantCancellationPolicyService({} as any);

    await service.recordMerchantCancellation(1, 101, manager);

    expect(manager.__getTenant().status).toBe(TenantStatus.active);
    expect(manager.__getEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: TenantCancellationPolicyEventType.warning_issued,
          actor_type: TenantCancellationPolicyActorType.system,
          cancellation_count: 10,
          threshold: 10,
        }),
      ]),
    );
  });

  it('auto-suspends at the 16th normal-cycle merchant cancellation', async () => {
    const manager = createManager(createState({ cancellation_count: 15 }));
    const service = new TenantCancellationPolicyService({} as any);

    await service.recordMerchantCancellation(1, 116, manager);

    expect(manager.__getTenant().status).toBe(TenantStatus.suspended);
    expect(manager.__getState()).toEqual(
      expect.objectContaining({
        cancellation_count: 16,
        last_suspension_policy: true,
      }),
    );
    expect(manager.__getEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: TenantCancellationPolicyEventType.auto_suspended,
          cancellation_count: 16,
          threshold: 16,
        }),
      ]),
    );
  });

  it('starts probation after admin reactivates a policy-suspended merchant', async () => {
    const manager = createManager(
      createState({
        cancellation_count: 16,
        last_suspension_policy: true,
        last_suspension_at: new Date('2026-06-18T10:00:00.000Z'),
      }),
    );
    const service = new TenantCancellationPolicyService({} as any);

    await service.recordAdminStatusChange(
      1,
      TenantStatus.suspended,
      TenantStatus.active,
      manager,
    );

    expect(manager.__getState()).toEqual(
      expect.objectContaining({
        cancellation_count: 0,
        is_probation: true,
        suspension_threshold: 5,
        last_suspension_policy: false,
      }),
    );
    expect(manager.__getEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: TenantCancellationPolicyEventType.admin_reactivated,
          actor_type: TenantCancellationPolicyActorType.admin,
        }),
      ]),
    );
  });

  it('auto-suspends at the 5th probation cancellation', async () => {
    const manager = createManager(
      createState({
        cancellation_count: 4,
        is_probation: true,
        suspension_threshold: 5,
      }),
    );
    const service = new TenantCancellationPolicyService({} as any);

    await service.recordMerchantCancellation(1, 205, manager);

    expect(manager.__getTenant().status).toBe(TenantStatus.suspended);
    expect(manager.__getEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: TenantCancellationPolicyEventType.auto_suspended,
          cancellation_count: 5,
          threshold: 5,
        }),
      ]),
    );
  });

  it('does not start probation for a manual admin suspension', async () => {
    const manager = createManager(createState({ cancellation_count: 3 }));
    const service = new TenantCancellationPolicyService({} as any);

    await service.recordAdminStatusChange(
      1,
      TenantStatus.active,
      TenantStatus.suspended,
      manager,
    );

    expect(manager.__getState()).toEqual(
      expect.objectContaining({
        is_probation: false,
        last_suspension_policy: false,
      }),
    );
    expect(manager.__getEvents()).toEqual([]);
  });
});
