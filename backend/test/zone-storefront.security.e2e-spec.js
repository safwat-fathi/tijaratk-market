const { ValidationPipe } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const request = require('supertest');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');

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
  ResponseTransformInterceptor,
} = require('../dist/common/interceptors/response-transform.transform');
const { PrismaService } = require('../dist/prisma/prisma.service');
const {
  requestLoggingMiddleware,
} = require('../dist/common/middlewares/request-logging.middleware');

process.env.ADMIN_MANAGED_STORES_ENABLED = 'true';
process.env.ADMIN_PRODUCT_WRITE_ENABLED = 'true';
process.env.ADMIN_ORDER_WRITE_ENABLED = 'true';
process.env.ZONE_STOREFRONTS_ENABLED = 'true';
process.env.WHATSAPP_NOTIFICATIONS_ENABLED = 'false';

jest.setTimeout(120000);

describe('Zone storefront security E2E', () => {
  let app;
  let prisma;
  let httpServer;
  let platformAdmin;
  let platformAdminToken;
  let grocery;
  let pharmacy;
  const createdTenantIds = [];
  const createdAreaIds = [];
  const createdZoneIds = [];
  const operatorTenantIds = [];
  const password = 'Passw0rd!';
  const runId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionFilter());
    app.use(cookieParser());
    app.use(requestLoggingMiddleware);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: validationExceptionFactory,
      }),
    );
    app.useGlobalInterceptors(
      app.get(TenantRlsInterceptor),
      app.get(AdminAuditInterceptor),
      new ResponseTransformInterceptor(),
    );
    await app.init();
    httpServer = app.getHttpServer();
    prisma = app.get(PrismaService);

    const adminPassword = `ZoneAdminPassw0rd!${runId}`;
    platformAdmin = await prisma.adminUser.create({
      data: {
        name: `Zone Platform Admin ${runId}`,
        phone: generateEgyptPhone(1),
        password: await bcrypt.hash(adminPassword, 10),
        role: 'platform_admin',
      },
    });
    platformAdminToken = await loginAdmin(
      httpServer,
      platformAdmin.phone,
      adminPassword,
    );

    grocery = await createZoneFixture({
      httpServer,
      prisma,
      adminToken: platformAdminToken,
      runId,
      suffix: 'grocery',
      category: 'grocery',
      allowedCategory: 'ألبان و بيض',
      pollutedCategory: 'أدوية',
      merchantCount: 2,
      password,
    });
    pharmacy = await createZoneFixture({
      httpServer,
      prisma,
      adminToken: platformAdminToken,
      runId,
      suffix: 'pharmacy',
      category: 'pharmacy',
      allowedCategory: 'أدوية',
      pollutedCategory: 'أرز ومكرونة',
      merchantCount: 1,
      password,
    });

    for (const fixture of [grocery, pharmacy]) {
      createdAreaIds.push(fixture.area.id);
      createdZoneIds.push(fixture.zone.id);
      operatorTenantIds.push(fixture.zone.operator_tenant.id);
      createdTenantIds.push(
        fixture.zone.operator_tenant.id,
        ...fixture.merchants.map((merchant) => merchant.tenantId),
      );
    }
  });

  afterAll(async () => {
    process.env.ZONE_STOREFRONTS_ENABLED = 'true';
    await cleanupZoneFixtures({
      prisma,
      zoneIds: createdZoneIds,
      operatorTenantIds,
      tenantIds: createdTenantIds,
      areaIds: createdAreaIds,
      adminId: platformAdmin?.id,
      runId,
    });
    if (app) await app.close();
  });

  it('isolates both vertical catalogs and hides internal operator routes', async () => {
    await request(httpServer)
      .post('/admin/zones')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: `Invalid Zone ${runId}`,
        slug: `invalid-zone-${runId}`.toLowerCase(),
        area_id: grocery.area.id,
        category: 'other',
        operations_phone: generateEgyptPhone(20),
      })
      .expect(400);

    for (const fixture of [grocery, pharmacy]) {
      const operatorSlug = `zone-operator-${fixture.zone.slug}`;
      await request(httpServer)
        .get(`/tenants/public/${operatorSlug}`)
        .expect(404);
      const hiddenProducts = await request(httpServer)
        .get(`/products/public/${operatorSlug}`)
        .expect(200);
      expect(unwrapBody(hiddenProducts.body).data).toEqual([]);
      await request(httpServer)
        .post(`/orders/${operatorSlug}`)
        .send({
          customer: {
            name: 'Hidden route customer',
            phone: generateEgyptPhone(21),
            address: 'Hidden operator route',
          },
          free_text_payload: { text: 'must not reach operator route' },
        })
        .expect(404);

      const pollutedResponse = await request(httpServer)
        .get(
          `/zone-storefronts/public/${fixture.zone.slug}/products?search=${encodeURIComponent(fixture.pollutedProductName)}`,
        )
        .expect(200);
      expect(unwrapBody(pollutedResponse.body).data).toEqual([]);

      const allowedResponse = await request(httpServer)
        .get(
          `/zone-storefronts/public/${fixture.zone.slug}/products?search=${encodeURIComponent(fixture.catalogProduct.name)}`,
        )
        .expect(200);
      expect(unwrapBody(allowedResponse.body).data).toEqual([
        expect.objectContaining({ id: fixture.catalogProduct.id }),
      ]);
    }
  });

  it('creates checkout and dispatch atomically from trusted zone data', async () => {
    const fixture = grocery;
    const merchant = fixture.merchants[0];

    await request(httpServer)
      .post('/orders')
      .set('Authorization', `Bearer ${merchant.token}`)
      .send({
        customer: { phone: generateEgyptPhone(30) },
        free_text_payload: { text: 'spoof' },
        order_source: 'zone_storefront',
      })
      .expect(400);

    const countsBefore = await Promise.all([
      countTenantOrders(prisma, fixture.zone.operator_tenant.id),
      prisma.orderDispatch.count({
        where: { zone_storefront_id: fixture.zone.id },
      }),
    ]);
    await request(httpServer)
      .post(`/zone-storefronts/public/${fixture.zone.slug}/orders`)
      .send({
        customer: {
          name: 'Invalid Zone Customer',
          phone: generateEgyptPhone(31),
          address: 'Invalid product address',
        },
        items: [{ product_id: 2147483647, quantity: '1' }],
      })
      .expect(400);
    expect(await countTenantOrders(prisma, fixture.zone.operator_tenant.id)).toBe(
      countsBefore[0],
    );
    expect(
      await prisma.orderDispatch.count({
        where: { zone_storefront_id: fixture.zone.id },
      }),
    ).toBe(countsBefore[1]);

    const response = await createZoneOrder(httpServer, fixture, {
      phone: generateEgyptPhone(32),
      itemOverrides: {
        name: 'Client spoofed name',
        unit_price: 1,
        total_price: 1,
      },
      payloadOverrides: {
        total: 1,
        delivery_fee: 0,
        source_metadata: {
          zone_storefront_id: 999999,
          area_id: 999999,
        },
      },
    });
    fixture.checkout = response;

    const persisted = await withTenant(
      prisma,
      fixture.zone.operator_tenant.id,
      (tx) =>
        tx.order.findUniqueOrThrow({
          where: { id: response.id },
          include: { order_items: true },
        }),
    );
    const dispatch = await prisma.orderDispatch.findUniqueOrThrow({
      where: { order_id: response.id },
    });
    fixture.dispatch = dispatch;
    fixture.orderItem = persisted.order_items[0];

    expect(persisted).toEqual(
      expect.objectContaining({
        tenant_id: fixture.zone.operator_tenant.id,
        delivery_area_id: fixture.area.id,
        order_source: 'zone_storefront',
      }),
    );
    expect(persisted.source_metadata).toEqual(
      expect.objectContaining({
        zone_storefront_id: fixture.zone.id,
        zone_slug: fixture.zone.slug,
        area_id: fixture.area.id,
      }),
    );
    expect(persisted.order_items[0].name_snapshot).toBe(
      fixture.catalogProduct.name,
    );
    expect(Number(persisted.order_items[0].total_price)).toBe(10);
    expect(Number(persisted.total)).toBe(15);
    expect(dispatch.status).toBe('pending');
  });

  it('keeps quotes assignment-scoped through rejection and reassignment', async () => {
    const fixture = grocery;
    const firstMerchant = fixture.merchants[0];
    const secondMerchant = fixture.merchants[1];
    const session = await startManagedSession({
      httpServer,
      adminToken: platformAdminToken,
      adminId: platformAdmin.id,
      tenantId: fixture.zone.operator_tenant.id,
    });
    fixture.managedCookie = session.cookie;

    const contextResponse = await request(httpServer)
      .get(
        `/admin/managed-tenants/${fixture.zone.operator_tenant.id}/zone-dispatches/context`,
      )
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .set('Cookie', session.cookie)
      .expect(200);
    expect(unwrapBody(contextResponse.body).zone.id).toBe(fixture.zone.id);
    await request(httpServer)
      .get(
        `/admin/managed-tenants/${fixture.zone.operator_tenant.id}/orders`,
      )
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .set('Cookie', session.cookie)
      .expect(404);

    const firstAssignmentResponse = await assignDispatch({
      httpServer,
      adminToken: platformAdminToken,
      cookie: session.cookie,
      operatorTenantId: fixture.zone.operator_tenant.id,
      dispatchId: fixture.dispatch.id,
      merchantTenantId: firstMerchant.tenantId,
      expectedVersion: fixture.dispatch.version,
    });
    const firstAssignment = currentAssignment(firstAssignmentResponse);

    await request(httpServer)
      .post(
        `/admin/managed-tenants/${fixture.zone.operator_tenant.id}/zone-dispatches/${fixture.dispatch.id}/assign`,
      )
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .set('Cookie', session.cookie)
      .send({
        target_tenant_id: secondMerchant.tenantId,
        expected_version: fixture.dispatch.version,
      })
      .expect(409);

    await request(httpServer)
      .get(`/assigned-orders/${fixture.dispatch.id}`)
      .set('Authorization', `Bearer ${pharmacy.merchants[0].token}`)
      .expect(404);

    fixture.priceHistoryBefore = await withTenant(
      prisma,
      fixture.zone.operator_tenant.id,
      (tx) =>
        tx.productPriceHistory.count({
          where: { product_id: fixture.catalogProduct.id },
        }),
    );
    const quoteResponse = await request(httpServer)
      .patch(
        `/assigned-orders/${fixture.dispatch.id}/items/${fixture.orderItem.id}/quote`,
      )
      .set('Authorization', `Bearer ${firstMerchant.token}`)
      .send({ total_price: 30, expected_version: firstAssignment.version })
      .expect(200);
    const quotedAssignment = currentAssignment(unwrapBody(quoteResponse.body));

    await request(httpServer)
      .post(`/assigned-orders/${fixture.dispatch.id}/reject`)
      .set('Authorization', `Bearer ${firstMerchant.token}`)
      .send({
        expected_version: quotedAssignment.version,
        reason: 'غير متوفر للتنفيذ حالياً',
      })
      .expect(201);

    const rejectedState = await withTenant(
      prisma,
      fixture.zone.operator_tenant.id,
      (tx) =>
        tx.orderItem.findUniqueOrThrow({
          where: { id: fixture.orderItem.id },
        }),
    );
    expect(Number(rejectedState.total_price)).toBe(10);

    const dispatchAfterRejection = await prisma.orderDispatch.findUniqueOrThrow({
      where: { id: fixture.dispatch.id },
    });
    expect(dispatchAfterRejection.status).toBe('pending');
    const secondAssignmentResponse = await assignDispatch({
      httpServer,
      adminToken: platformAdminToken,
      cookie: session.cookie,
      operatorTenantId: fixture.zone.operator_tenant.id,
      dispatchId: fixture.dispatch.id,
      merchantTenantId: secondMerchant.tenantId,
      expectedVersion: dispatchAfterRejection.version,
    });
    const secondAssignment = currentAssignment(secondAssignmentResponse);
    expect(secondAssignment.quote_lines).toEqual([]);
    expect(secondAssignmentResponse.assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: firstAssignment.id,
          status: 'rejected',
          is_current: false,
          quote_lines: expect.arrayContaining([
            expect.objectContaining({ order_item_id: fixture.orderItem.id }),
          ]),
        }),
      ]),
    );
    fixture.currentAssignment = secondAssignment;
  });

  it('locks accepted snapshot pricing without changing central catalog prices', async () => {
    const fixture = grocery;
    const merchant = fixture.merchants[1];
    const quoteResponse = await request(httpServer)
      .patch(
        `/assigned-orders/${fixture.dispatch.id}/items/${fixture.orderItem.id}/quote`,
      )
      .set('Authorization', `Bearer ${merchant.token}`)
      .send({
        total_price: 20,
        expected_version: fixture.currentAssignment.version,
      })
      .expect(200);
    const quotedAssignment = currentAssignment(unwrapBody(quoteResponse.body));

    await request(httpServer)
      .post(`/assigned-orders/${fixture.dispatch.id}/accept`)
      .set('Authorization', `Bearer ${merchant.token}`)
      .send({ expected_version: fixture.currentAssignment.version })
      .expect(409);
    await request(httpServer)
      .post(`/assigned-orders/${fixture.dispatch.id}/accept`)
      .set('Authorization', `Bearer ${merchant.token}`)
      .send({ expected_version: quotedAssignment.version })
      .expect(201);

    await request(httpServer)
      .patch(
        `/assigned-orders/${fixture.dispatch.id}/items/${fixture.orderItem.id}/quote`,
      )
      .set('Authorization', `Bearer ${merchant.token}`)
      .send({
        total_price: 22,
        expected_version: quotedAssignment.version + 1,
      })
      .expect(404);

    const acceptedState = await withTenant(
      prisma,
      fixture.zone.operator_tenant.id,
      async (tx) => ({
        order: await tx.order.findUniqueOrThrow({
          where: { id: fixture.checkout.id },
          include: { order_items: true },
        }),
        product: await tx.product.findUniqueOrThrow({
          where: { id: fixture.catalogProduct.id },
        }),
        priceHistoryCount: await tx.productPriceHistory.count({
          where: { product_id: fixture.catalogProduct.id },
        }),
      }),
    );
    expect(acceptedState.order.status).toBe('confirmed');
    expect(Number(acceptedState.order.order_items[0].total_price)).toBe(20);
    expect(Number(acceptedState.order.total)).toBe(25);
    expect(Number(acceptedState.product.current_price)).toBe(10);
    expect(acceptedState.priceHistoryCount).toBe(fixture.priceHistoryBefore);

    const trackingResponse = await request(httpServer)
      .get(`/orders/tracking/${fixture.checkout.public_token}`)
      .expect(200);
    const tracking = unwrapBody(trackingResponse.body);
    expect(tracking.fulfilled_by).toEqual({ name: merchant.storeName });
    expect(tracking.zone_storefront.reorder_url).toContain(
      `/market/${fixture.zone.slug}`,
    );
    expect(tracking.tenant).toEqual(
      expect.objectContaining({
        id: fixture.zone.id,
        name: fixture.zone.name,
        slug: fixture.zone.slug,
      }),
    );
    expect(tracking.tenant_id).toBe(fixture.zone.id);

    await request(httpServer)
      .patch(
        `/assigned-orders/${fixture.dispatch.id}/items/${fixture.orderItem.id}/replacement`,
      )
      .set('Authorization', `Bearer ${merchant.token}`)
      .send({ replacement_product_id: fixture.replacementProduct.id })
      .expect(200);
    await request(httpServer)
      .patch(`/assigned-orders/${fixture.dispatch.id}/status`)
      .set('Authorization', `Bearer ${merchant.token}`)
      .send({ status: 'out_for_delivery' })
      .expect(200);

    const normalOrderResponse = await request(httpServer)
      .post('/orders')
      .set('Authorization', `Bearer ${merchant.token}`)
      .send({
        customer: {
          name: 'Normal Merchant Customer',
          phone: generateEgyptPhone(39),
          address: 'Normal merchant address',
        },
        free_text_payload: { text: 'normal merchant order remains isolated' },
      })
      .expect(201);
    const normalOrder = unwrapBody(normalOrderResponse.body);

    const normalOrders = await request(httpServer)
      .get('/orders')
      .set('Authorization', `Bearer ${merchant.token}`)
      .expect(200);
    expect(
      unwrapBody(normalOrders.body).some(
        (order) => order.id === fixture.checkout.id,
      ),
    ).toBe(false);
    expect(
      unwrapBody(normalOrders.body).some((order) => order.id === normalOrder.id),
    ).toBe(true);
  });

  it('keeps tracking and dispatch available when discovery is disabled', async () => {
    const fixture = grocery;
    const rejectionOrder = await createZoneOrder(httpServer, fixture, {
      phone: generateEgyptPhone(40),
    });
    await request(httpServer)
      .patch(`/orders/tracking/${rejectionOrder.public_token}/reject`)
      .send({ reason: 'لم أعد أحتاج الطلب' })
      .expect(200);
    expect(
      (
        await prisma.orderDispatch.findUniqueOrThrow({
          where: { order_id: rejectionOrder.id },
        })
      ).status,
    ).toBe('cancelled');

    const cancellationEventsBefore =
      await prisma.tenantCancellationPolicyEvent.count({
        where: { tenant_id: fixture.zone.operator_tenant.id },
      });
    process.env.ZONE_STOREFRONTS_ENABLED = 'false';
    try {
      await request(httpServer)
        .get(`/zone-storefronts/public/${fixture.zone.slug}`)
        .expect(404);
      await request(httpServer)
        .post(`/zone-storefronts/public/${fixture.zone.slug}/orders`)
        .send({
          customer: {
            name: 'Disabled Checkout',
            phone: generateEgyptPhone(41),
            address: 'Disabled feature address',
          },
          items: [{ product_id: fixture.catalogProduct.id, quantity: '1' }],
        })
        .expect(404);
      await request(httpServer)
        .get(`/orders/tracking/${fixture.checkout.public_token}`)
        .expect(200);

      const acceptedDispatch = await prisma.orderDispatch.findUniqueOrThrow({
        where: { id: fixture.dispatch.id },
      });
      await request(httpServer)
        .post(
          `/admin/managed-tenants/${fixture.zone.operator_tenant.id}/zone-dispatches/${fixture.dispatch.id}/cancel`,
        )
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .set('Cookie', fixture.managedCookie)
        .send({
          expected_version: acceptedDispatch.version,
          reason: 'إلغاء تشغيلي للاختبار',
        })
        .expect(201);
      await request(httpServer)
        .get(`/assigned-orders/${fixture.dispatch.id}`)
        .set('Authorization', `Bearer ${fixture.merchants[1].token}`)
        .expect(404);
    } finally {
      process.env.ZONE_STOREFRONTS_ENABLED = 'true';
    }

    expect(
      await prisma.tenantCancellationPolicyEvent.count({
        where: { tenant_id: fixture.zone.operator_tenant.id },
      }),
    ).toBe(cancellationEventsBefore);
  });
});

async function createZoneFixture({
  httpServer,
  prisma,
  adminToken,
  runId,
  suffix,
  category,
  allowedCategory,
  pollutedCategory,
  merchantCount,
  password,
}) {
  const area = await prisma.directoryArea.create({
    data: {
      name_ar: `منطقة ${suffix} ${runId}`,
      name_en: `${suffix} zone ${runId}`,
      slug: `zone-area-${suffix}-${runId}`.toLowerCase(),
      is_active: true,
    },
  });
  const merchants = [];
  for (let index = 0; index < merchantCount; index += 1) {
    const storeName = `Zone ${suffix} Merchant ${index + 1} ${runId}`;
    const phone = generateEgyptPhone(100 + merchants.length + area.id);
    await signupTenant(httpServer, {
      storeName,
      ownerName: `${suffix} owner ${index + 1}`,
      phone,
      password,
    });
    const session = await loginMerchant(httpServer, phone, password);
    await prisma.tenant.update({
      where: { id: session.tenantId },
      data: { category, status: 'active' },
    });
    merchants.push({ ...session, storeName });
  }

  const zoneResponse = await request(httpServer)
    .post('/admin/zones')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: `Central ${suffix} ${runId}`,
      slug: `central-${suffix}-${runId}`.toLowerCase(),
      area_id: area.id,
      category,
      operations_phone: generateEgyptPhone(200 + area.id),
      delivery_fee: 5,
    })
    .expect(201);
  const zone = unwrapBody(zoneResponse.body);

  await request(httpServer)
    .post(`/admin/zones/${zone.id}/merchants`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tenant_id: merchants[0].tenantId, priority: 10, is_active: true })
    .expect(400);

  await prisma.tenantDeliveryArea.createMany({
    data: merchants.map((merchant) => ({
      tenant_id: merchant.tenantId,
      area_id: area.id,
      is_active: true,
    })),
  });
  for (let index = 0; index < merchants.length; index += 1) {
    await request(httpServer)
      .post(`/admin/zones/${zone.id}/merchants`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tenant_id: merchants[index].tenantId,
        priority: 10 - index,
        is_active: true,
      })
      .expect(201);
  }

  const pollutedProductName = `Polluted ${suffix} ${runId}`;
  const products = await withTenant(
    prisma,
    zone.operator_tenant.id,
    async (tx) => {
      await tx.product.createMany({
        data: Array.from({ length: 100 }, (_, index) => ({
          tenant_id: zone.operator_tenant.id,
          name: `Zone ${suffix} Product ${runId} ${index}`,
          source: 'catalog',
          status: 'active',
          category: allowedCategory,
          current_price: 10,
          is_available: true,
        })),
      });
      await tx.product.create({
        data: {
          tenant_id: zone.operator_tenant.id,
          name: pollutedProductName,
          source: 'catalog',
          status: 'active',
          category: pollutedCategory,
          current_price: 99,
          is_available: true,
        },
      });
      const catalogProducts = await tx.product.findMany({
        where: { tenant_id: zone.operator_tenant.id, category: allowedCategory },
        orderBy: { id: 'asc' },
        take: 2,
      });
      return {
        catalogProduct: catalogProducts[0],
        replacementProduct: catalogProducts[1],
      };
    },
  );
  await request(httpServer)
    .patch(`/admin/zones/${zone.id}/activation`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ is_active: true })
    .expect(200);

  return {
    area,
    zone,
    merchants,
    pollutedProductName,
    ...products,
  };
}

async function createZoneOrder(httpServer, fixture, options) {
  const response = await request(httpServer)
    .post(`/zone-storefronts/public/${fixture.zone.slug}/orders`)
    .send({
      customer: {
        name: 'Zone Customer',
        phone: options.phone,
        address: 'Zone delivery address',
      },
      items: [
        {
          product_id: fixture.catalogProduct.id,
          quantity: '1',
          ...(options.itemOverrides || {}),
        },
      ],
      ...(options.payloadOverrides || {}),
    })
    .expect(201);
  return unwrapBody(response.body);
}

async function startManagedSession({
  httpServer,
  adminToken,
  adminId,
  tenantId,
}) {
  await request(httpServer)
    .put(`/admin/tenants/${tenantId}/accesses/${adminId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      permissions: [
        'orders.read',
        'customers.read_limited',
        'dispatches.read',
        'dispatches.assign',
        'dispatches.cancel',
      ],
    })
    .expect(200);
  const response = await request(httpServer)
    .post('/admin/management-sessions')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tenant_id: tenantId, reason: 'E2E zone dispatch operations' })
    .expect(201);
  const payload = unwrapBody(response.body);
  return {
    payload,
    cookie: `admin_management_session=${payload.session_token}`,
  };
}

async function assignDispatch({
  httpServer,
  adminToken,
  cookie,
  operatorTenantId,
  dispatchId,
  merchantTenantId,
  expectedVersion,
}) {
  const response = await request(httpServer)
    .post(
      `/admin/managed-tenants/${operatorTenantId}/zone-dispatches/${dispatchId}/assign`,
    )
    .set('Authorization', `Bearer ${adminToken}`)
    .set('Cookie', cookie)
    .send({
      target_tenant_id: merchantTenantId,
      expected_version: expectedVersion,
    })
    .expect(201);
  return unwrapBody(response.body);
}

function currentAssignment(dispatch) {
  const assignment = dispatch.assignments.find((item) => item.is_current);
  if (!assignment) throw new Error('Current dispatch assignment is missing');
  return assignment;
}

async function withTenant(prisma, tenantId, callback) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenantId)}, true)`;
    return callback(tx);
  });
}

async function countTenantOrders(prisma, tenantId) {
  return withTenant(prisma, tenantId, (tx) =>
    tx.order.count({ where: { tenant_id: tenantId } }),
  );
}

async function signupTenant(httpServer, input) {
  await request(httpServer)
    .post('/auth/signup')
    .send({
      storeName: input.storeName,
      name: input.ownerName,
      phone: input.phone,
      category: 'other',
      address: '123 Zone E2E Street, Cairo',
      password: input.password,
      confirm_password: input.password,
    })
    .expect((response) => {
      if (![200, 201].includes(response.status)) {
        throw new Error(`Merchant signup failed: ${response.status} ${response.text}`);
      }
    });
}

async function loginMerchant(httpServer, phone, password) {
  const response = await request(httpServer)
    .post('/auth/login')
    .send({ phone, pass: password })
    .expect(201);
  const payload = unwrapBody(response.body);
  return {
    token: payload.access_token,
    tenantId: payload.user.tenant_id,
  };
}

async function loginAdmin(httpServer, phone, password) {
  const response = await request(httpServer)
    .post('/admin/login')
    .send({ phone, password })
    .expect(201);
  return unwrapBody(response.body).admin_access_token;
}

function unwrapBody(body) {
  return body && typeof body === 'object' && body.data !== undefined
    ? body.data
    : body;
}

async function cleanupZoneFixtures({
  prisma,
  zoneIds,
  operatorTenantIds,
  tenantIds,
  areaIds,
  adminId,
  runId,
}) {
  if (!prisma) return;
  try {
    for (const tenantId of operatorTenantIds) {
      await withTenant(prisma, tenantId, async (tx) => {
        await tx.activityLog.deleteMany({ where: { tenant_id: tenantId } });
        await tx.order.deleteMany({ where: { tenant_id: tenantId } });
        await tx.customer.deleteMany({ where: { tenant_id: tenantId } });
        await tx.productPriceHistory.deleteMany({ where: { tenant_id: tenantId } });
        await tx.product.deleteMany({ where: { tenant_id: tenantId } });
        await tx.tenantProductCategory.deleteMany({ where: { tenant_id: tenantId } });
      });
    }
    await prisma.zoneStorefrontMerchant.deleteMany({
      where: { zone_storefront_id: { in: zoneIds } },
    });
    await prisma.zoneStorefront.deleteMany({ where: { id: { in: zoneIds } } });
    if (adminId) {
      await prisma.adminManagementSession.deleteMany({
        where: { admin_user_id: adminId },
      });
      await prisma.adminTenantAccess.deleteMany({
        where: {
          OR: [{ admin_user_id: adminId }, { granted_by_admin_id: adminId }],
        },
      });
      await prisma.adminAuditLog.deleteMany({
        where: {
          OR: [
            { actor_admin_id: adminId },
            { request_id: { contains: runId } },
          ],
        },
      });
      await prisma.adminUser.deleteMany({ where: { id: adminId } });
    }
    for (const tenantId of tenantIds) {
      await withTenant(prisma, tenantId, async (tx) => {
        await tx.activityLog.deleteMany({ where: { tenant_id: tenantId } });
        await tx.order.deleteMany({ where: { tenant_id: tenantId } });
        await tx.customer.deleteMany({ where: { tenant_id: tenantId } });
        await tx.productPriceHistory.deleteMany({ where: { tenant_id: tenantId } });
        await tx.product.deleteMany({ where: { tenant_id: tenantId } });
        await tx.tenantProductCategory.deleteMany({ where: { tenant_id: tenantId } });
      });
    }
    await prisma.user.deleteMany({ where: { tenant_id: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.directoryArea.deleteMany({ where: { id: { in: areaIds } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[zone-storefront.security.e2e] cleanup failed: ${message}`);
  }
}

function generateEgyptPhone(seed) {
  const digits = `${Date.now()}${Math.floor(Math.random() * 100000)}${seed}`
    .slice(-8)
    .padStart(8, '0');
  return `+2010${digits}`;
}
