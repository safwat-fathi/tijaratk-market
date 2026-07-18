const { ValidationPipe } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const request = require('supertest');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');

const pushEnvironmentKeys = [
  'PUSH_NOTIFICATIONS_ENABLED',
  'PUSH_VAPID_PUBLIC_KEY',
  'PUSH_VAPID_PRIVATE_KEY',
  'PUSH_VAPID_SUBJECT',
  'ENCRYPTION_PASSWORD',
];
const originalPushEnvironment = Object.fromEntries(
  pushEnvironmentKeys.map((key) => [key, process.env[key]]),
);

process.env.PUSH_NOTIFICATIONS_ENABLED = 'true';
process.env.PUSH_VAPID_PUBLIC_KEY = 'e2e-public-key';
process.env.PUSH_VAPID_PRIVATE_KEY = 'e2e-private-key';
process.env.PUSH_VAPID_SUBJECT = 'mailto:e2e@tijaratk.test';
process.env.ENCRYPTION_PASSWORD =
  process.env.ENCRYPTION_PASSWORD || 'e2e-push-encryption-password';

const { AppModule } = require('../dist/app.module');
const {
  validationExceptionFactory,
} = require('../dist/common/utils/validation-exception.factory');
const { AllExceptionFilter } = require('../dist/common/filters/all-exception.filter');
const {
  TenantRlsInterceptor,
} = require('../dist/common/interceptors/tenant-rls.interceptor');
const {
  AdminAuditInterceptor,
} = require('../dist/admin-audit/admin-audit.interceptor');
const {
  AdminAuditService,
} = require('../dist/admin-audit/admin-audit.service');
const {
  AdminProvisioningService,
} = require('../dist/cli/admin-provisioning/admin-provisioning.service');
const {
  CreateAdminCommand,
} = require('../dist/cli/commands/create-admin.command/create-admin.command');
const {
  ResponseTransformInterceptor,
} = require('../dist/common/interceptors/response-transform.transform');
const { PrismaService } = require('../dist/prisma/prisma.service');
const {
  requestLoggingMiddleware,
} = require('../dist/common/middlewares/request-logging.middleware');
const {
  PushNotificationsWorker,
} = require('../dist/push-notifications/push-notifications.worker');
const {
  PushNotificationsService,
} = require('../dist/push-notifications/push-notifications.service');
const webPush = require('web-push');

const AUTH_SIGNUP_PATH = '/auth/signup';
const AUTH_LOGIN_PATH = '/auth/login';
const AUTH_UPDATE_PASSWORD_PATH = '/auth/update-password';
const PRODUCTS_PATH = '/products';
const PRODUCTS_ITEM_PATH = (id) => `${PRODUCTS_PATH}/${id}`;
const ADMIN_LOGIN_PATH = '/admin/login';

process.env.ADMIN_MANAGED_STORES_ENABLED = 'true';
process.env.ADMIN_PRODUCT_WRITE_ENABLED = 'true';
process.env.ADMIN_ORDER_WRITE_ENABLED = 'true';

jest.setTimeout(120000);

describe('Security E2E (multi-tenant)', () => {
  let app;
  let prisma;
  let adminAuditService;
  let adminProvisioningService;
  let pushNotificationsService;
  let httpServer;
  let tokenTenantA;
  let tokenTenantB;
  let tenantAId;
  let tenantBId;
  let tenantBProductId;
  let platformAdmin;
  let operationsAdmin;
  let platformAdminToken;
  let operationsAdminToken;
  const provisionedAdminIds = [];
  const password = 'Passw0rd!';

  const runId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      providers: [AdminProvisioningService],
    })
      .overrideProvider(PushNotificationsWorker)
      .useValue({
        onApplicationBootstrap: () => undefined,
        onModuleDestroy: () => undefined,
      })
      .compile();

    app = moduleRef.createNestApplication();

    app.useGlobalFilters(new AllExceptionFilter());
    app.use(cookieParser());
    app.use(requestLoggingMiddleware);

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        exceptionFactory: validationExceptionFactory,
      }),
    );

    const tenantRlsInterceptor = app.get(TenantRlsInterceptor);
    const adminAuditInterceptor = app.get(AdminAuditInterceptor);
    app.useGlobalInterceptors(
      tenantRlsInterceptor,
      adminAuditInterceptor,
      new ResponseTransformInterceptor(),
    );

    await app.init();

    httpServer = app.getHttpServer();
    prisma = app.get(PrismaService);
    adminAuditService = app.get(AdminAuditService);
    adminProvisioningService = app.get(AdminProvisioningService);
    pushNotificationsService = app.get(PushNotificationsService);

    const tenantAPhone = generateEgyptPhone(1);
    const tenantBPhone = generateEgyptPhone(2);

    await signupTenant(httpServer, {
      storeName: `E2E Store A ${runId}`,
      ownerName: 'E2E Owner A',
      phone: tenantAPhone,
      password,
    });

    await signupTenant(httpServer, {
      storeName: `E2E Store B ${runId}`,
      ownerName: 'E2E Owner B',
      phone: tenantBPhone,
      password,
    });

    const tenantALogin = await loginAndGetSession(httpServer, {
      phone: tenantAPhone,
      pass: password,
    });
    tokenTenantA = tenantALogin.token;
    tenantAId = tenantALogin.tenantId;

    const tenantBLogin = await loginAndGetSession(httpServer, {
      phone: tenantBPhone,
      pass: password,
    });
    tokenTenantB = tenantBLogin.token;
    tenantBId = tenantBLogin.tenantId;

    const createProductResponse = await request(httpServer)
      .post(PRODUCTS_PATH)
      .set('Authorization', `Bearer ${tokenTenantB}`)
      .send({
        name: `E2E Product B ${runId}`,
        category: 'E2E',
        current_price: 12.5,
      })
      .expect((res) => {
        if (![200, 201].includes(res.status)) {
          throw new Error(
            `Expected 200/201 when creating tenant B product, got ${res.status}: ${res.text}`,
          );
        }
      });

    tenantBProductId = parseId(createProductResponse.body);

    const adminPassword = `AdminPassw0rd!${runId}`;
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    platformAdmin = await prisma.adminUser.create({
      data: {
        name: `Platform Admin ${runId}`,
        phone: generateEgyptPhone(3),
        password: passwordHash,
        role: 'platform_admin',
      },
    });
    operationsAdmin = await prisma.adminUser.create({
      data: {
        name: `Operations Admin ${runId}`,
        phone: generateEgyptPhone(4),
        password: passwordHash,
        role: 'operations_admin',
      },
    });
    platformAdminToken = await loginAdmin(
      httpServer,
      platformAdmin.phone,
      adminPassword,
    );
    operationsAdminToken = await loginAdmin(
      httpServer,
      operationsAdmin.phone,
      adminPassword,
    );
  });

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.pushNotificationOutbox.deleteMany({
          where: {
            OR: [
              {
                tenant_id: {
                  in: [tenantAId, tenantBId].filter(Number.isInteger),
                },
              },
              { event_key: { contains: runId } },
            ],
          },
        });
        await prisma.pushSubscription.deleteMany({
          where: {
            OR: [
              {
                merchant_tenant_id: {
                  in: [tenantAId, tenantBId].filter(Number.isInteger),
                },
              },
              {
                admin_user_id: {
                  in: [platformAdmin?.id, operationsAdmin?.id].filter(
                    Number.isInteger,
                  ),
                },
              },
            ],
          },
        });
      }
      await cleanupManagedAdmins(
        prisma,
        [platformAdmin?.id, operationsAdmin?.id, ...provisionedAdminIds],
        runId,
      );
      await cleanupTenants(prisma, [tenantAId, tenantBId]);
    } finally {
      if (app) await app.close();
      for (const key of pushEnvironmentKeys) {
        const originalValue = originalPushEnvironment[key];
        if (originalValue === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = originalValue;
        }
      }
    }
  });

  it('returns 401 when accessing protected route without token', async () => {
    await request(httpServer).get(PRODUCTS_ITEM_PATH(tenantBProductId)).expect(401);
  });

  it('isolates encrypted merchant push subscriptions by authenticated user', async () => {
    const configResponse = await request(httpServer)
      .get('/push-notifications/config')
      .expect(200);
    expect(unwrapBody(configResponse.body)).toEqual({
      enabled: true,
      publicKey: 'e2e-public-key',
    });

    const endpoint = `https://push.example.test/merchant-${runId}`;
    const payload = {
      endpoint,
      expirationTime: null,
      keys: { p256dh: `p256dh-${runId}-merchant`, auth: `auth-${runId}` },
    };
    await request(httpServer)
      .post('/push-notifications/subscriptions')
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .send(payload)
      .expect(201);

    const tenantAUser = await prisma.user.findFirstOrThrow({
      where: { tenant_id: tenantAId },
    });
    let stored = await prisma.pushSubscription.findFirstOrThrow({
      where: { merchant_user_id: tenantAUser.id },
    });
    expect(stored.merchant_tenant_id).toBe(tenantAId);
    expect(stored.encrypted_subscription).not.toContain(endpoint);
    expect(stored.encrypted_subscription).not.toContain(payload.keys.p256dh);
    expect(stored.encrypted_subscription).not.toContain(payload.keys.auth);

    await request(httpServer)
      .post('/push-notifications/subscriptions')
      .set('Authorization', `Bearer ${tokenTenantB}`)
      .send(payload)
      .expect(201);
    const tenantBUser = await prisma.user.findFirstOrThrow({
      where: { tenant_id: tenantBId },
    });
    stored = await prisma.pushSubscription.findUniqueOrThrow({
      where: { endpoint_hash: stored.endpoint_hash },
    });
    expect(stored.merchant_user_id).toBe(tenantBUser.id);
    expect(stored.merchant_tenant_id).toBe(tenantBId);

    await request(httpServer)
      .delete('/push-notifications/subscriptions')
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .send({ endpoint })
      .expect(200);
    expect(
      await prisma.pushSubscription.count({
        where: { endpoint_hash: stored.endpoint_hash },
      }),
    ).toBe(1);

    await request(httpServer)
      .delete('/push-notifications/subscriptions')
      .set('Authorization', `Bearer ${tokenTenantB}`)
      .send({ endpoint })
      .expect(200);
    expect(
      await prisma.pushSubscription.count({
        where: { endpoint_hash: stored.endpoint_hash },
      }),
    ).toBe(0);
  });

  it('rechecks administrator role, assignment, and permission at delivery time', async () => {
    const platformEndpoint = `https://push.example.test/platform-${runId}`;
    const operationsEndpoint = `https://push.example.test/operations-${runId}`;
    const subscription = (endpoint) => ({
      endpoint,
      expirationTime: null,
      keys: {
        p256dh: `p256dh-${runId}-${endpoint.length}`,
        auth: `auth-${runId}`,
      },
    });
    await request(httpServer)
      .post('/admin/push-notifications/subscriptions')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send(subscription(platformEndpoint))
      .expect(201);
    await request(httpServer)
      .post('/admin/push-notifications/subscriptions')
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .send(subscription(operationsEndpoint))
      .expect(201);

    const access = await prisma.adminTenantAccess.upsert({
      where: {
        admin_user_id_tenant_id: {
          admin_user_id: operationsAdmin.id,
          tenant_id: tenantAId,
        },
      },
      create: {
        admin_user_id: operationsAdmin.id,
        tenant_id: tenantAId,
        granted_by_admin_id: platformAdmin.id,
        permissions: ['orders.read'],
      },
      update: {
        is_active: true,
        revoked_at: null,
        expires_at: null,
        permissions: ['orders.read'],
      },
    });

    const event = {
      id: 1,
      event_key: `merchant-order:e2e-${runId}`,
      event_type: 'merchant_order_created',
      tenant_id: tenantAId,
      order_id: 1,
      dispatch_id: null,
      assignment_id: null,
      zone_id: null,
      payload: { storeName: 'E2E Store', orderNumber: '1' },
      attempt_count: 1,
      created_at: new Date(),
    };
    const permitted =
      await pushNotificationsService.resolveDeliveryTargets(event);
    expect(
      permitted.some((target) => target.adminRole === 'platform_admin'),
    ).toBe(true);
    expect(
      permitted.some((target) => target.adminRole === 'operations_admin'),
    ).toBe(true);

    const zoneEvent = {
      ...event,
      event_key: `zone-order:e2e-${runId}`,
      event_type: 'zone_order_created',
      dispatch_id: 10,
      zone_id: 20,
    };
    const missingDispatchPermission =
      await pushNotificationsService.resolveDeliveryTargets(zoneEvent);
    expect(
      missingDispatchPermission.some(
        (target) => target.adminRole === 'operations_admin',
      ),
    ).toBe(false);

    await prisma.adminTenantAccess.update({
      where: { id: access.id },
      data: { permissions: ['dispatches.read'] },
    });
    const dispatchPermitted =
      await pushNotificationsService.resolveDeliveryTargets(zoneEvent);
    expect(
      dispatchPermitted.some(
        (target) => target.adminRole === 'operations_admin',
      ),
    ).toBe(true);

    await prisma.adminTenantAccess.update({
      where: { id: access.id },
      data: { expires_at: new Date(Date.now() - 60_000) },
    });
    const expired =
      await pushNotificationsService.resolveDeliveryTargets(zoneEvent);
    expect(
      expired.some((target) => target.adminRole === 'platform_admin'),
    ).toBe(true);
    expect(
      expired.some((target) => target.adminRole === 'operations_admin'),
    ).toBe(false);

    await prisma.adminTenantAccess.update({
      where: { id: access.id },
      data: { is_active: false, revoked_at: new Date(), expires_at: null },
    });
    const revoked =
      await pushNotificationsService.resolveDeliveryTargets(event);
    expect(
      revoked.some((target) => target.adminRole === 'platform_admin'),
    ).toBe(true);
    expect(
      revoked.some((target) => target.adminRole === 'operations_admin'),
    ).toBe(false);

    await request(httpServer)
      .delete('/admin/push-notifications/subscriptions')
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .send({ endpoint: platformEndpoint })
      .expect(200);
    expect(
      await prisma.pushSubscription.count({
        where: { admin_user_id: platformAdmin.id },
      }),
    ).toBe(1);

    await request(httpServer)
      .delete('/admin/push-notifications/subscriptions')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({ endpoint: platformEndpoint })
      .expect(200);
    await request(httpServer)
      .delete('/admin/push-notifications/subscriptions')
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .send({ endpoint: operationsEndpoint })
      .expect(200);
  });

  it('enqueues only customer-created orders and deduplicates their events', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantAId },
      select: { slug: true },
    });
    const dashboardResponse = await request(httpServer)
      .post('/orders')
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .send({
        customer: { phone: generateEgyptPhone(81) },
        free_text_payload: { text: 'Dashboard order must not notify' },
      })
      .expect(201);
    const dashboardOrder = unwrapBody(dashboardResponse.body);
    expect(
      await prisma.pushNotificationOutbox.findUnique({
        where: { event_key: `merchant-order:${dashboardOrder.id}` },
      }),
    ).toBeNull();

    await request(httpServer)
      .post(`/orders/${tenant.slug}`)
      .send({
        customer: { phone: generateEgyptPhone(811) },
        free_text_payload: { text: 'Source spoof must be rejected' },
        order_source: 'zone_storefront',
      })
      .expect(400);

    const publicResponse = await request(httpServer)
      .post(`/orders/${tenant.slug}`)
      .send({
        customer: {
          name: 'Push E2E Customer',
          phone: generateEgyptPhone(82),
          address: 'Privacy-sensitive test address',
        },
        free_text_payload: { text: 'Privacy-sensitive order contents' },
      })
      .expect(201);
    const publicOrder = unwrapBody(publicResponse.body);
    const eventKey = `merchant-order:${publicOrder.id}`;
    await prisma.$transaction((tx) =>
      pushNotificationsService.enqueueMerchantOrder(tx, {
        orderId: publicOrder.id,
        tenantId: tenantAId,
        storeName: `E2E Store A ${runId}`,
      }),
    );

    const events = await prisma.pushNotificationOutbox.findMany({
      where: { event_key: eventKey },
    });
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events[0].payload)).not.toContain('Customer');
    expect(JSON.stringify(events[0].payload)).not.toContain('address');
    expect(JSON.stringify(events[0].payload)).not.toContain('contents');
    await prisma.pushNotificationOutbox.deleteMany({
      where: { event_key: eventKey },
    });
  });

  it('retries transient failures and removes invalid assignment endpoints', async () => {
    const endpoint = `https://push.example.test/retry-${runId}`;
    await request(httpServer)
      .post('/push-notifications/subscriptions')
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .send({
        endpoint,
        expirationTime: null,
        keys: {
          p256dh: `p256dh-${runId}-retry`,
          auth: `auth-${runId}-retry`,
        },
      })
      .expect(201);

    const zoneTargets = await pushNotificationsService.resolveDeliveryTargets({
      id: 1,
      event_key: `zone-order:merchant-exclusion-${runId}`,
      event_type: 'zone_order_created',
      tenant_id: tenantAId,
      order_id: 1,
      dispatch_id: 2,
      assignment_id: null,
      zone_id: 3,
      payload: { storeName: 'E2E Zone', orderNumber: '1' },
      attempt_count: 1,
      created_at: new Date(),
    });
    expect(
      zoneTargets.some((target) => target.actor === 'merchant'),
    ).toBe(false);

    const assignmentId = Number(`${Date.now()}`.slice(-8));
    const eventKey = `zone-assignment:${assignmentId}`;
    await prisma.$transaction((tx) =>
      pushNotificationsService.enqueueZoneAssignment(tx, {
        assignmentId,
        dispatchId: assignmentId + 1,
        orderId: assignmentId + 2,
        targetTenantId: tenantAId,
        merchantName: `E2E Store A ${runId}`,
        zoneId: assignmentId + 3,
        zoneName: 'E2E Zone',
      }),
    );
    await prisma.$transaction((tx) =>
      pushNotificationsService.enqueueZoneAssignment(tx, {
        assignmentId,
        dispatchId: assignmentId + 1,
        orderId: assignmentId + 2,
        targetTenantId: tenantAId,
        merchantName: `E2E Store A ${runId}`,
        zoneId: assignmentId + 3,
        zoneName: 'E2E Zone',
      }),
    );
    expect(
      await prisma.pushNotificationOutbox.count({
        where: { event_key: eventKey },
      }),
    ).toBe(1);

    const event = await prisma.pushNotificationOutbox.findUniqueOrThrow({
      where: { event_key: eventKey },
    });
    const envelope = pushNotificationsService.buildEnvelope(
      {
        ...event,
        attempt_count: 1,
      },
      {
        subscriptionId: 1,
        encryptedSubscription: 'not-used',
        actor: 'merchant',
      },
    );
    expect(envelope.url).toBe(
      `/merchant/assigned-orders/${assignmentId + 1}`,
    );
    expect(Object.keys(envelope).sort()).toEqual(
      [
        'body',
        'createdAt',
        'eventId',
        'tag',
        'title',
        'type',
        'url',
        'version',
      ].sort(),
    );

    const worker = new PushNotificationsWorker(
      prisma,
      pushNotificationsService,
    );
    const sendNotification = jest.spyOn(webPush, 'sendNotification');
    try {
      sendNotification.mockRejectedValueOnce({ statusCode: 503 });
      await worker.tick();
      let storedEvent = await prisma.pushNotificationOutbox.findUniqueOrThrow({
        where: { event_key: eventKey },
      });
      expect(storedEvent.status).toBe('pending');
      expect(storedEvent.attempt_count).toBe(1);
      expect(storedEvent.last_error_code).toBe('push_http_503');

      await prisma.pushNotificationOutbox.update({
        where: { event_key: eventKey },
        data: { next_attempt_at: new Date(0) },
      });
      sendNotification.mockRejectedValueOnce({ statusCode: 410 });
      await worker.tick();
      storedEvent = await prisma.pushNotificationOutbox.findUniqueOrThrow({
        where: { event_key: eventKey },
      });
      expect(storedEvent.status).toBe('sent');
      expect(
        await prisma.pushSubscription.count({
          where: { merchant_tenant_id: tenantAId },
        }),
      ).toBe(0);
    } finally {
      sendNotification.mockRestore();
      await prisma.pushNotificationOutbox.deleteMany({
        where: { event_key: eventKey },
      });
      await request(httpServer)
        .delete('/push-notifications/subscriptions')
        .set('Authorization', `Bearer ${tokenTenantA}`)
        .send({ endpoint });
    }
  });

  it('rejects merchant signup without the required store address', async () => {
    await request(httpServer)
      .post(AUTH_SIGNUP_PATH)
      .send({
        storeName: `Missing Address Store ${runId}`,
        name: 'Missing Address Owner',
        phone: generateEgyptPhone(5),
        category: 'other',
        password,
        confirm_password: password,
      })
      .expect(400);
  });

  it('updates password for an authenticated merchant token', async () => {
    await request(httpServer)
      .post(AUTH_UPDATE_PASSWORD_PATH)
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .send({
        currentPassword: password,
        newPassword: `NewPassw0rd!${runId}`,
      })
      .expect(200);
  });

  it('prevents cross-tenant READ', async () => {
    await request(httpServer)
      .get(PRODUCTS_ITEM_PATH(tenantBProductId))
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .expect(404);
  });

  it('prevents cross-tenant UPDATE', async () => {
    await request(httpServer)
      .patch(PRODUCTS_ITEM_PATH(tenantBProductId))
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .send({ name: `Updated by tenant A ${runId}` })
      .expect(404);
  });

  it('prevents cross-tenant DELETE', async () => {
    await request(httpServer)
      .delete(PRODUCTS_ITEM_PATH(tenantBProductId))
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .expect(404);
  });

  it('blocks mass-assignment attempts', async () => {
    await request(httpServer)
      .post(PRODUCTS_PATH)
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .send({
        name: `Mass assignment ${runId}`,
        category: 'E2E',
        tenant_id: 999999,
        role: 'admin',
        isAdmin: true,
      })
      .expect(400);
  });

  it('rejects pagination abuse (limit too large)', async () => {
    await request(httpServer)
      .get(`${PRODUCTS_PATH}?search=te&page=1&limit=100000`)
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .expect(400);
  });

  it('restricts platform access administration to platform admins', async () => {
    await request(httpServer)
      .get('/admin/admin-users')
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .expect(403);

    await request(httpServer)
      .get('/admin/admin-users')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .expect(200);

    await request(httpServer)
      .get('/admin/activity-logs')
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .expect(403);

    await request(httpServer)
      .get('/admin/activity-logs?limit=1')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .expect(200);
  });

  it('audits login identity and masks unknown login identifiers', async () => {
    const successfulLoginAudit = await prisma.adminAuditLog.findFirst({
      where: {
        actor_admin_id: operationsAdmin.id,
        action: 'admin.login.succeeded',
        outcome: 'success',
      },
      orderBy: { id: 'desc' },
    });
    expect(successfulLoginAudit).toEqual(
      expect.objectContaining({
        actor_admin_name_snapshot: operationsAdmin.name,
        actor_admin_role_snapshot: 'operations_admin',
      }),
    );

    const unknownPhone = generateEgyptPhone(9);
    const unknownLoginRequestId = `unknown-admin-login-${runId}`;
    await request(httpServer)
      .post(ADMIN_LOGIN_PATH)
      .set('X-Request-Id', unknownLoginRequestId)
      .send({ phone: unknownPhone, password: 'DefinitelyWrong1!' })
      .expect(401);

    const unknownAudit = await prisma.adminAuditLog.findFirstOrThrow({
      where: { request_id: unknownLoginRequestId },
    });
    expect(unknownAudit).toEqual(
      expect.objectContaining({
        actor_admin_id: null,
        actor_admin_name_snapshot: null,
        actor_admin_role_snapshot: null,
        action: 'admin.login.denied',
        outcome: 'denied',
      }),
    );
    expect(unknownAudit.metadata.login_identifier_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(unknownAudit.metadata)).not.toContain(unknownPhone);

    const routineReadRequestId = `admin-read-${runId}`;
    await request(httpServer)
      .get('/admin/plans')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .set('X-Request-Id', routineReadRequestId)
      .expect(200);
    expect(
      await prisma.adminAuditLog.count({
        where: { request_id: routineReadRequestId, outcome: 'success' },
      }),
    ).toBe(0);
  });

  it('requires assignment, session, matching tenant, and exact permission', async () => {
    await request(httpServer)
      .post('/admin/management-sessions')
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .send({ tenant_id: tenantAId, reason: 'E2E managed store review' })
      .expect(403);

    await request(httpServer)
      .put(`/admin/tenants/${tenantAId}/accesses/${operationsAdmin.id}`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        permissions: [
          'products.read',
          'products.create',
          'products.update',
          'activity_logs.read',
        ],
      })
      .expect(200);

    const sessionResponse = await request(httpServer)
      .post('/admin/management-sessions')
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .send({ tenant_id: tenantAId, reason: 'E2E managed store review' })
      .expect(201);
    const session = unwrapBody(sessionResponse.body);
    const managedCookie = `admin_management_session=${session.session_token}`;

    const switchedSessionResponse = await request(httpServer)
      .post('/admin/management-sessions')
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .send({ tenant_id: tenantAId, reason: 'E2E second managed review' })
      .expect(201);
    const switchedSession = unwrapBody(switchedSessionResponse.body);
    const switchedCookie =
      `admin_management_session=${switchedSession.session_token}`;

    await request(httpServer)
      .get(`/admin/managed-tenants/${tenantAId}/products`)
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .set('Cookie', managedCookie)
      .expect(403);

    await request(httpServer)
      .get(`/admin/managed-tenants/${tenantAId}/products`)
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .set('Cookie', switchedCookie)
      .expect(200);

    const catalogResponse = await request(httpServer)
      .get(`/admin/managed-tenants/${tenantAId}/catalog`)
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .set('Cookie', switchedCookie)
      .expect(200);
    expect(unwrapBody(catalogResponse.body).data).toEqual([]);

    process.env.ADMIN_PRODUCT_WRITE_ENABLED = 'false';
    await request(httpServer)
      .post(`/admin/managed-tenants/${tenantAId}/products`)
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .set('Cookie', switchedCookie)
      .send({ name: `Feature flag product ${runId}` })
      .expect(403);
    process.env.ADMIN_PRODUCT_WRITE_ENABLED = 'true';

    await request(httpServer)
      .get(`/admin/managed-tenants/${tenantAId}/products`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .set('Cookie', switchedCookie)
      .expect(403);

    const sourceCategory = `E2E Source ${runId}`;
    const targetCategory = `E2E Target ${runId}`;
    const mutationRequestId = `managed-product-${runId}`;
    const createdProductResponse = await request(httpServer)
      .post(`/admin/managed-tenants/${tenantAId}/products`)
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .set('Cookie', switchedCookie)
      .set('X-Request-Id', mutationRequestId)
      .send({
        name: `Managed product ${runId}`,
        category: sourceCategory,
        current_price: 18.5,
      })
      .expect(201);
    const managedProduct = unwrapBody(createdProductResponse.body);

    const unchangedSourceResponse = await request(httpServer)
      .post(`/admin/managed-tenants/${tenantAId}/products`)
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .set('Cookie', switchedCookie)
      .send({
        name: `Unchanged source product ${runId}`,
        category: sourceCategory,
        current_price: 19.5,
      })
      .expect(201);
    const unchangedSourceProduct = unwrapBody(unchangedSourceResponse.body);

    await request(httpServer)
      .post(`/admin/managed-tenants/${tenantAId}/products`)
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .set('Cookie', switchedCookie)
      .send({
        name: `Target category product ${runId}`,
        category: targetCategory,
        current_price: 20.5,
      })
      .expect(201);

    const activityResponse = await request(httpServer)
      .get(`/admin/managed-tenants/${tenantAId}/activity-logs?limit=50`)
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .set('Cookie', switchedCookie)
      .expect(200);
    const activityItems = unwrapBody(activityResponse.body).items;
    const productActivity = activityItems.find(
      (item) =>
        item.action === 'product.created' && item.entity_id === managedProduct.id,
    );
    expect(productActivity).toEqual(
      expect.objectContaining({
        management_session_id: switchedSession.session.id,
        request_id: mutationRequestId,
        actor: expect.objectContaining({
          type: 'admin',
          id: operationsAdmin.id,
          name: operationsAdmin.name,
          role: 'operations_admin',
        }),
      }),
    );

    const adminAuditResponse = await request(httpServer)
      .get(
        `/admin/activity-logs?admin_id=${operationsAdmin.id}&role=operations_admin&tenant_id=${tenantAId}&outcome=success&limit=50`,
      )
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .expect(200);
    const matchingAuditItems = unwrapBody(adminAuditResponse.body).items.filter(
      (item) => item.request_id === mutationRequestId,
    );
    expect(matchingAuditItems).toHaveLength(1);
    expect(matchingAuditItems[0]).toEqual(
      expect.objectContaining({
        outcome: 'success',
        actor: {
          id: operationsAdmin.id,
          name: operationsAdmin.name,
          role: 'operations_admin',
        },
      }),
    );
    expect(JSON.stringify(matchingAuditItems[0].metadata)).not.toMatch(
      /password|token|cookie/i,
    );

    const categoryMoveRequestId = `managed-product-category-move-${runId}`;
    await request(httpServer)
      .patch(
        `/admin/managed-tenants/${tenantAId}/products/${managedProduct.id}/details`,
      )
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .set('Cookie', switchedCookie)
      .set('X-Request-Id', categoryMoveRequestId)
      .send({ category: targetCategory })
      .expect(200);

    const [movedProduct, unchangedProduct] = await Promise.all([
      prisma.product.findUniqueOrThrow({ where: { id: managedProduct.id } }),
      prisma.product.findUniqueOrThrow({
        where: { id: unchangedSourceProduct.id },
      }),
    ]);
    expect(movedProduct.category).toBe(targetCategory);
    expect(unchangedProduct.category).toBe(sourceCategory);

    const categoryMoveActivity = await prisma.activityLog.findFirstOrThrow({
      where: { request_id: categoryMoveRequestId },
    });
    expect(categoryMoveActivity).toEqual(
      expect.objectContaining({
        actor_admin_id: operationsAdmin.id,
        management_session_id: switchedSession.session.id,
        action: 'product.updated',
        old_values: expect.objectContaining({ category: sourceCategory }),
        new_values: expect.objectContaining({ category: targetCategory }),
      }),
    );

    await prisma.adminUser.update({
      where: { id: operationsAdmin.id },
      data: { name: `Renamed Operations Admin ${runId}` },
    });
    const historicalActivityResponse = await request(httpServer)
      .get(`/admin/managed-tenants/${tenantAId}/activity-logs?limit=50`)
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .set('Cookie', switchedCookie)
      .expect(200);
    const historicalProductActivity = unwrapBody(
      historicalActivityResponse.body,
    ).items.find((item) => item.request_id === mutationRequestId);
    expect(historicalProductActivity.actor.name).toBe(operationsAdmin.name);
    const historicalAuditResponse = await request(httpServer)
      .get(`/admin/activity-logs?action=product.created&limit=50`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .expect(200);
    const historicalAudit = unwrapBody(historicalAuditResponse.body).items.find(
      (item) => item.request_id === mutationRequestId,
    );
    expect(historicalAudit.actor.name).toBe(operationsAdmin.name);

    const failedMutationRequestId = `managed-product-failed-${runId}`;
    await request(httpServer)
      .patch(`/admin/managed-tenants/${tenantAId}/products/2147483647/details`)
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .set('Cookie', switchedCookie)
      .set('X-Request-Id', failedMutationRequestId)
      .send({ name: `Missing managed product ${runId}` })
      .expect(404);

    const activityAfterFailureResponse = await request(httpServer)
      .get(`/admin/managed-tenants/${tenantAId}/activity-logs?limit=50`)
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .set('Cookie', switchedCookie)
      .expect(200);
    expect(
      unwrapBody(activityAfterFailureResponse.body).items.some(
        (item) => item.request_id === failedMutationRequestId,
      ),
    ).toBe(false);
    expect(
      await prisma.adminAuditLog.count({
        where: {
          request_id: failedMutationRequestId,
          outcome: 'success',
        },
      }),
    ).toBe(0);

    await request(httpServer)
      .get(`/admin/managed-tenants/${tenantBId}/products`)
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .set('Cookie', switchedCookie)
      .expect(404);

    await request(httpServer)
      .get(`/admin/managed-tenants/${tenantAId}/orders`)
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .set('Cookie', switchedCookie)
      .expect(403);

    await request(httpServer)
      .delete(`/admin/tenants/${tenantAId}/accesses/${operationsAdmin.id}`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .expect(200);

    await request(httpServer)
      .get(`/admin/managed-tenants/${tenantAId}/products`)
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .set('Cookie', switchedCookie)
      .expect(403);

    await request(httpServer)
      .patch(`/admin/admin-users/${operationsAdmin.id}/status`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({ is_active: false })
      .expect(200);

    await request(httpServer)
      .get('/admin/managed-tenants')
      .set('Authorization', `Bearer ${operationsAdminToken}`)
      .expect(401);
  });

  it('provisions both admin roles with normalized phones and one safe CLI audit each', async () => {
    const password = `CliStrong!${runId}`;
    const platformPhone = generateEgyptPhone(51);
    const operationsPhone = generateEgyptPhone(52);
    const platformAdminFromCli = await adminProvisioningService.createAdmin({
      name: `  CLI Platform ${runId}  `,
      phone: `0${platformPhone.slice(3)}`,
      role: 'platform_admin',
      password,
      passwordConfirmation: password,
    });
    const operationsAdminFromCli = await adminProvisioningService.createAdmin({
      name: `CLI Operations ${runId}`,
      phone: operationsPhone,
      role: 'operations_admin',
      password,
      passwordConfirmation: password,
    });
    provisionedAdminIds.push(
      platformAdminFromCli.id,
      operationsAdminFromCli.id,
    );

    expect(platformAdminFromCli).toEqual(
      expect.objectContaining({
        name: `CLI Platform ${runId}`,
        phone: platformPhone,
        role: 'platform_admin',
      }),
    );
    expect(operationsAdminFromCli.role).toBe('operations_admin');

    const storedPlatformAdmin = await prisma.adminUser.findUniqueOrThrow({
      where: { id: platformAdminFromCli.id },
    });
    expect(storedPlatformAdmin.is_active).toBe(true);
    expect(await bcrypt.compare(password, storedPlatformAdmin.password)).toBe(
      true,
    );

    for (const createdAdmin of [
      platformAdminFromCli,
      operationsAdminFromCli,
    ]) {
      const audits = await prisma.adminAuditLog.findMany({
        where: {
          action: 'admin.account.created_cli',
          entity_type: 'admin',
          entity_id: createdAdmin.id,
        },
      });
      expect(audits).toHaveLength(1);
      expect(audits[0]).toEqual(
        expect.objectContaining({
          actor_admin_id: null,
          actor_admin_name_snapshot: null,
          actor_admin_role_snapshot: null,
          tenant_id: null,
          management_session_id: null,
          outcome: 'success',
          ip_address: null,
          metadata: {
            source: 'cli',
            created_admin_role: createdAdmin.role,
          },
        }),
      );
      expect(audits[0].request_id).toMatch(/^cli-[0-9a-f-]{36}$/);
      const serializedMetadata = JSON.stringify(audits[0].metadata);
      expect(serializedMetadata).not.toContain(createdAdmin.phone);
      expect(serializedMetadata).not.toContain(password);
    }

    await loginAdmin(httpServer, platformAdminFromCli.phone, password);
  });

  it('rejects invalid or duplicate CLI credentials without a success audit', async () => {
    const auditCountBefore = await prisma.adminAuditLog.count({
      where: { action: 'admin.account.created_cli' },
    });
    const weakPhone = generateEgyptPhone(53);
    await expect(
      adminProvisioningService.createAdmin({
        name: `CLI Weak ${runId}`,
        phone: weakPhone,
        role: 'operations_admin',
        password: 'weak-password',
        passwordConfirmation: 'weak-password',
      }),
    ).rejects.toThrow('uppercase');
    await expect(
      adminProvisioningService.createAdmin({
        name: `CLI Mismatch ${runId}`,
        phone: generateEgyptPhone(54),
        role: 'operations_admin',
        password: `CliStrong!${runId}`,
        passwordConfirmation: `Different!${runId}`,
      }),
    ).rejects.toThrow('does not match');
    const overlongPassword = `Aa1!${'x'.repeat(69)}`;
    await expect(
      adminProvisioningService.createAdmin({
        name: `CLI Overlong ${runId}`,
        phone: generateEgyptPhone(57),
        role: 'operations_admin',
        password: overlongPassword,
        passwordConfirmation: overlongPassword,
      }),
    ).rejects.toThrow('72 UTF-8 bytes');

    const existingAdmin = await prisma.adminUser.findFirstOrThrow({
      where: { id: { in: provisionedAdminIds } },
    });
    await expect(
      adminProvisioningService.createAdmin({
        name: `CLI Duplicate ${runId}`,
        phone: `0${existingAdmin.phone.slice(3)}`,
        role: 'platform_admin',
        password: `CliStrong!${runId}`,
        passwordConfirmation: `CliStrong!${runId}`,
      }),
    ).rejects.toThrow('already exists');

    expect(await prisma.adminUser.count({ where: { phone: weakPhone } })).toBe(
      0,
    );
    expect(
      await prisma.adminAuditLog.count({
        where: { action: 'admin.account.created_cli' },
      }),
    ).toBe(auditCountBefore);
  });

  it('rolls back CLI administrator creation when its audit fails', async () => {
    const phone = generateEgyptPhone(55);
    const password = `CliStrong!${runId}`;
    const recordSpy = jest
      .spyOn(adminAuditService, 'record')
      .mockRejectedValueOnce(new Error('Forced CLI audit failure'));

    try {
      await expect(
        adminProvisioningService.createAdmin({
          name: `CLI Rollback ${runId}`,
          phone,
          role: 'operations_admin',
          password,
          passwordConfirmation: password,
        }),
      ).rejects.toThrow('No changes were saved');
    } finally {
      recordSpy.mockRestore();
    }

    expect(await prisma.adminUser.count({ where: { phone } })).toBe(0);
  });

  it('prints only masked administrator credentials from the CLI command', async () => {
    const password = `CliStrong!${runId}`;
    const phone = generateEgyptPhone(56);
    const command = new CreateAdminCommand(
      {
        ask: jest.fn().mockResolvedValue({
          password,
          passwordConfirmation: password,
        }),
      },
      {
        createAdmin: jest.fn().mockResolvedValue({
          id: 123,
          name: 'CLI Output Admin',
          phone,
          role: 'operations_admin',
        }),
      },
    );
    const outputSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    let output;

    try {
      await command.run([], {
        name: 'CLI Output Admin',
        phone,
        role: 'operations_admin',
      });
      output = outputSpy.mock.calls.flat().join('');
    } finally {
      outputSpy.mockRestore();
    }

    expect(output).toContain('CLI Output Admin');
    expect(output).toContain('operations_admin');
    expect(output).not.toContain(phone);
    expect(output).not.toContain(password);
  });

  it('audits administrator logout with the trusted identity snapshot', async () => {
    const logoutRequestId = `admin-logout-${runId}`;
    await request(httpServer)
      .post('/admin/logout')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .set('X-Request-Id', logoutRequestId)
      .expect((res) => {
        if (![200, 201].includes(res.status)) {
          throw new Error(`Expected logout success, got ${res.status}: ${res.text}`);
        }
      });

    const logoutAudit = await prisma.adminAuditLog.findFirstOrThrow({
      where: { request_id: logoutRequestId, action: 'admin.logout.succeeded' },
    });
    expect(logoutAudit).toEqual(
      expect.objectContaining({
        actor_admin_id: platformAdmin.id,
        actor_admin_name_snapshot: platformAdmin.name,
        actor_admin_role_snapshot: 'platform_admin',
        outcome: 'success',
      }),
    );
  });

  it('rolls back a mutation when its atomic audit cannot be persisted', async () => {
    const planName = `Atomic audit rollback ${runId}`;
    await expect(
      adminAuditService.runWithSuccessAudit(
        {
          actor: { id: 2147483647 },
          entityType: 'subscription',
          action: 'admin.plan.atomicity_probe',
          title: 'Atomicity probe',
        },
        (tx) =>
          tx.subscriptionPlan.create({
            data: { name: planName, price: 1 },
          }),
      ),
    ).rejects.toBeDefined();

    expect(
      await prisma.subscriptionPlan.count({ where: { name: planName } }),
    ).toBe(0);
  });
});

function unwrapBody(body) {
  if (
    body &&
    typeof body === 'object' &&
    body.data &&
    typeof body.data === 'object'
  ) {
    return body.data;
  }

  return body;
}

function parseId(body) {
  const payload = unwrapBody(body);
  const id = payload && typeof payload === 'object' ? payload.id : undefined;

  if (!id) {
    throw new Error(
      `Could not parse id from response body: ${JSON.stringify(body)}`,
    );
  }

  return id;
}

async function signupTenant(httpServer, input) {
  const response = await request(httpServer).post(AUTH_SIGNUP_PATH).send({
    storeName: input.storeName,
    name: input.ownerName,
    phone: input.phone,
    category: 'other',
    address: input.address || '123 E2E Test Street, Cairo',
    password: input.password,
    confirm_password: input.password,
  });

  if (![200, 201].includes(response.status)) {
    throw new Error(
      `Signup failed for ${input.phone}: ${response.status} ${response.text}`,
    );
  }
}

async function loginAndGetSession(httpServer, creds) {
  const response = await request(httpServer).post(AUTH_LOGIN_PATH).send(creds);

  if (![200, 201].includes(response.status)) {
    throw new Error(
      `Login failed for ${creds.phone}: ${response.status} ${response.text}`,
    );
  }

  const payload = unwrapBody(response.body);
  const token =
    payload?.access_token ||
    response.body?.access_token ||
    payload?.token ||
    response.body?.token;

  const tenantId = payload?.user?.tenant_id || response.body?.user?.tenant_id;

  if (!token) {
    throw new Error(
      `Token was not found in login response: ${JSON.stringify(response.body)}`,
    );
  }

  if (!tenantId) {
    throw new Error(
      `tenant_id was not found in login response: ${JSON.stringify(response.body)}`,
    );
  }

  return { token, tenantId };
}

async function loginAdmin(httpServer, phone, password) {
  const response = await request(httpServer)
    .post(ADMIN_LOGIN_PATH)
    .send({ phone, password })
    .expect(201);
  const payload = unwrapBody(response.body);
  if (!payload.admin_access_token) {
    throw new Error(`Admin token missing: ${JSON.stringify(response.body)}`);
  }
  return payload.admin_access_token;
}

async function cleanupManagedAdmins(prisma, adminIds, auditRequestMarker) {
  if (!prisma) return;
  const ids = adminIds.filter((id) => Number.isInteger(id));
  if (ids.length === 0) return;
  await prisma.adminAuditLog.deleteMany({
    where: {
      OR: [
        { actor_admin_id: { in: ids } },
        { entity_type: 'admin', entity_id: { in: ids } },
        { request_id: { contains: auditRequestMarker } },
      ],
    },
  });
  await prisma.adminManagementSession.deleteMany({
    where: { admin_user_id: { in: ids } },
  });
  await prisma.adminTenantAccess.deleteMany({
    where: {
      OR: [
        { admin_user_id: { in: ids } },
        { granted_by_admin_id: { in: ids } },
      ],
    },
  });
  await prisma.adminUser.deleteMany({ where: { id: { in: ids } } });
}

async function cleanupTenants(prisma, tenantIds) {
  if (!prisma) {
    return;
  }

  const normalizedTenantIds = tenantIds.filter((id) => Number.isInteger(id));
  if (normalizedTenantIds.length === 0) {
    return;
  }

  try {
    for (const tenantId of normalizedTenantIds) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenantId)}, true)`;
        await tx.activityLog.deleteMany({ where: { tenant_id: tenantId } });
        await tx.availabilityRequest.deleteMany({ where: { tenant_id: tenantId } });
        await tx.productPriceHistory.deleteMany({ where: { tenant_id: tenantId } });
        await tx.dayClosure.deleteMany({ where: { tenant_id: tenantId } });
        await tx.order.deleteMany({ where: { tenant_id: tenantId } });
        await tx.customer.deleteMany({ where: { tenant_id: tenantId } });
        await tx.product.deleteMany({ where: { tenant_id: tenantId } });
        await tx.tenantProductCategory.deleteMany({ where: { tenant_id: tenantId } });
      });
    }
    await prisma.user.deleteMany({ where: { tenant_id: { in: normalizedTenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: normalizedTenantIds } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[security.e2e] cleanup failed: ${message}`);
  }
}

function generateEgyptPhone(seed) {
  const uniqueDigits = `${Date.now()}${Math.floor(Math.random() * 100000)}${seed}`
    .slice(-8)
    .padStart(8, '0');

  return `+2010${uniqueDigits}`;
}
