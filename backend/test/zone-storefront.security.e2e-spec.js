const { ValidationPipe } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const request = require('supertest');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const { readdir } = require('node:fs/promises');
const { join } = require('node:path');
const { createHash, createHmac } = require('node:crypto');

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
const {
  MetaConversionsWorker,
} = require('../dist/meta-conversions/meta-conversions.worker');
const {
  MetaConversionsService,
} = require('../dist/meta-conversions/meta-conversions.service');
const {
  GoogleAnalyticsWorker,
} = require('../dist/google-analytics/google-analytics.worker');
const {
  GoogleAnalyticsService,
} = require('../dist/google-analytics/google-analytics.service');
const { decrypt } = require('../dist/common/utils/encryption.util');

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
    })
      .overrideProvider(MetaConversionsWorker)
      .useValue({
        onApplicationBootstrap: () => undefined,
        onModuleDestroy: () => undefined,
      })
      .overrideProvider(GoogleAnalyticsWorker)
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
      secondAllowedCategory: 'مشروبات',
      pollutedCategory: 'أدوية',
      merchantCount: 2,
      password,
    });
    pharmacy = await createZoneFixture({
      httpServer,
      prisma,
      adminToken: platformAdminToken,
      runId,
      area: grocery.area,
      suffix: 'pharmacy',
      category: 'pharmacy',
      allowedCategory: 'أدوية',
      secondAllowedCategory: 'عناية شخصية',
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

  it('allows one zone per category in an area and rejects true duplicates', async () => {
    expect(pharmacy.area.id).toBe(grocery.area.id);

    const duplicateCategoryResponse = await request(httpServer)
      .post('/admin/zones')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: `Duplicate grocery ${runId}`,
        slug: `duplicate-grocery-${runId}`.toLowerCase(),
        area_id: grocery.area.id,
        category: 'grocery',
        operations_phone: generateEgyptPhone(22),
      })
      .expect(409);
    expect(duplicateCategoryResponse.body).toEqual(
      expect.objectContaining({
        message: 'يوجد بالفعل واجهة سوبر ماركت لهذه المنطقة.',
        errors: expect.objectContaining({
          code: 'ZONE_AREA_CATEGORY_CONFLICT',
        }),
      }),
    );

    const duplicatePharmacyResponse = await request(httpServer)
      .post('/admin/zones')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: `Duplicate pharmacy ${runId}`,
        slug: `duplicate-pharmacy-${runId}`.toLowerCase(),
        area_id: pharmacy.area.id,
        category: 'pharmacy',
        operations_phone: generateEgyptPhone(25),
      })
      .expect(409);
    expect(duplicatePharmacyResponse.body).toEqual(
      expect.objectContaining({
        message: 'يوجد بالفعل واجهة صيدلية لهذه المنطقة.',
        errors: expect.objectContaining({
          code: 'ZONE_AREA_CATEGORY_CONFLICT',
        }),
      }),
    );

    const slugConflictArea = await prisma.directoryArea.create({
      data: {
        name_ar: `منطقة تعارض الرابط ${runId}`,
        name_en: `slug conflict ${runId}`,
        slug: `zone-slug-conflict-${runId}`.toLowerCase(),
        is_active: true,
      },
    });
    createdAreaIds.push(slugConflictArea.id);
    const duplicateSlugResponse = await request(httpServer)
      .post('/admin/zones')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: `Duplicate slug ${runId}`,
        slug: grocery.zone.slug,
        area_id: slugConflictArea.id,
        category: 'grocery',
        operations_phone: generateEgyptPhone(23),
      })
      .expect(409);
    expect(duplicateSlugResponse.body.errors).toEqual(
      expect.objectContaining({ code: 'ZONE_SLUG_CONFLICT' }),
    );

    const concurrentArea = await prisma.directoryArea.create({
      data: {
        name_ar: `منطقة التزامن ${runId}`,
        name_en: `concurrent zone ${runId}`,
        slug: `zone-concurrent-${runId}`.toLowerCase(),
        is_active: true,
      },
    });
    createdAreaIds.push(concurrentArea.id);
    const concurrentPayload = {
      name: `Concurrent zone ${runId}`,
      slug: `concurrent-zone-${runId}`.toLowerCase(),
      area_id: concurrentArea.id,
      category: 'pharmacy',
      operations_phone: generateEgyptPhone(24),
    };
    const concurrentResponses = await Promise.all([
      request(httpServer)
        .post('/admin/zones')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send(concurrentPayload),
      request(httpServer)
        .post('/admin/zones')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send(concurrentPayload),
    ]);
    expect(concurrentResponses.map((response) => response.status).sort()).toEqual([
      201,
      409,
    ]);
    const createdResponse = concurrentResponses.find(
      (response) => response.status === 201,
    );
    const conflictResponse = concurrentResponses.find(
      (response) => response.status === 409,
    );
    expect(createdResponse).toBeDefined();
    expect(conflictResponse).toBeDefined();
    const createdZone = unwrapBody(createdResponse.body);
    createdZoneIds.push(createdZone.id);
    operatorTenantIds.push(createdZone.operator_tenant.id);
    createdTenantIds.push(createdZone.operator_tenant.id);
    expect(conflictResponse.body.errors).toEqual(
      expect.objectContaining({
        code: expect.stringMatching(
          /^ZONE_(AREA_CATEGORY|SLUG|OPERATOR_SLUG|CREATE)_CONFLICT$/,
        ),
      }),
    );
  });

  it('discovers only active, ready, source-compatible zones', async () => {
    const initialResponse = await request(httpServer)
      .get('/zone-storefronts/public')
      .expect(200);
    expect(unwrapBody(initialResponse.body)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: grocery.zone.id }),
        expect.objectContaining({ id: pharmacy.zone.id }),
      ]),
    );

    await prisma.zoneStorefront.update({
      where: { id: grocery.zone.id },
      data: { is_active: false },
    });
    await prisma.zoneStorefrontMerchant.updateMany({
      where: { zone_storefront_id: pharmacy.zone.id },
      data: { is_active: false },
    });
    try {
      const unreadyResponse = await request(httpServer)
        .get('/zone-storefronts/public')
        .expect(200);
      expect(unwrapBody(unreadyResponse.body)).toEqual([]);
    } finally {
      await prisma.zoneStorefront.update({
        where: { id: grocery.zone.id },
        data: { is_active: true },
      });
      await prisma.zoneStorefrontMerchant.updateMany({
        where: { zone_storefront_id: pharmacy.zone.id },
        data: { is_active: true },
      });
    }

    await prisma.tenant.update({
      where: { id: grocery.zone.operator_tenant.id },
      data: { category: 'other' },
    });
    try {
      const incompatibleResponse = await request(httpServer)
        .get('/zone-storefronts/public')
        .expect(200);
      const discoveredIds = unwrapBody(incompatibleResponse.body).map(
        (zone) => zone.id,
      );
      expect(discoveredIds).not.toContain(grocery.zone.id);
      expect(discoveredIds).toContain(pharmacy.zone.id);
    } finally {
      await prisma.tenant.update({
        where: { id: grocery.zone.operator_tenant.id },
        data: { category: 'grocery' },
      });
    }
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

      const manualResponse = await request(httpServer)
        .get(
          `/zone-storefronts/public/${fixture.zone.slug}/products?search=${encodeURIComponent(fixture.manualProduct.name)}`,
        )
        .expect(200);
      expect(unwrapBody(manualResponse.body).data).toEqual([]);

      for (const excludedName of fixture.excludedCatalogItemNames) {
        const excludedResponse = await request(httpServer)
          .get(
            `/zone-storefronts/public/${fixture.zone.slug}/products?search=${encodeURIComponent(excludedName)}`,
          )
          .expect(200);
        expect(unwrapBody(excludedResponse.body).data).toEqual([]);
      }

      const categoryResponse = await request(httpServer)
        .get(`/zone-storefronts/public/${fixture.zone.slug}/categories`)
        .expect(200);
      expect(unwrapBody(categoryResponse.body)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ category: fixture.allowedCategory }),
          expect.objectContaining({ category: fixture.secondAllowedCategory }),
        ]),
      );
    }
  });

  it('synchronizes essentials idempotently and preserves zone-controlled fields', async () => {
    const fixture = grocery;
    const legacyCatalogItem = await prisma.catalogItem.create({
      data: {
        name: `Legacy essential ${runId}`,
        category: fixture.allowedCategory,
        source: fixture.catalogSource,
        external_id: `zone-legacy-${runId}`,
        is_active: true,
        is_essential: true,
        price: 44,
      },
    });
    const duplicateName = `Duplicate essential ${runId}`;
    const duplicateCatalogItems = await Promise.all(
      [1, 2].map((index) =>
        prisma.catalogItem.create({
          data: {
            name: duplicateName,
            category: fixture.allowedCategory,
            source: fixture.catalogSource,
            external_id: `zone-duplicate-${runId}-${index}`,
            is_active: true,
            is_essential: true,
            price: 50 + index,
          },
        }),
      ),
    );
    const legacyProduct = await withTenant(
      prisma,
      fixture.zone.operator_tenant.id,
      (tx) =>
        tx.product.create({
          data: {
            tenant_id: fixture.zone.operator_tenant.id,
            name: legacyCatalogItem.name,
            category: legacyCatalogItem.category,
            source: 'catalog',
            status: 'active',
            current_price: 33,
            is_available: false,
          },
        }),
    );
    const duplicateLegacyProduct = await withTenant(
      prisma,
      fixture.zone.operator_tenant.id,
      (tx) =>
        tx.product.create({
          data: {
            tenant_id: fixture.zone.operator_tenant.id,
            name: duplicateName,
            category: fixture.allowedCategory,
            source: 'catalog',
            status: 'active',
            current_price: 88,
            is_available: false,
          },
        }),
    );
    await withTenant(prisma, fixture.zone.operator_tenant.id, (tx) =>
      tx.product.update({
        where: { id: fixture.replacementProduct.id },
        data: { current_price: 77, is_available: false },
      }),
    );
    await prisma.catalogItem.update({
      where: { id: fixture.replacementCatalogItem.id },
      data: {
        name: `${fixture.replacementCatalogItem.name} محدث`,
        image_url: `https://example.test/${runId}.png`,
      },
    });

    const syncResponse = await request(httpServer)
      .post(`/admin/zones/${fixture.zone.id}/catalog/sync-essentials`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({})
      .expect(201);
    const syncResult = unwrapBody(syncResponse.body);
    expect(syncResult).toEqual(
      expect.objectContaining({
        linked: expect.any(Number),
        expected_products: expect.any(Number),
        active_products: expect.any(Number),
        active_categories: expect.any(Number),
        catalog_in_sync: true,
      }),
    );
    expect(syncResult.linked).toBeGreaterThanOrEqual(1);
    const expectedProducts = await prisma.catalogItem.count({
      where: {
        source: fixture.catalogSource,
        is_active: true,
        is_essential: true,
        deleted_at: null,
      },
    });
    expect(syncResult.expected_products).toBe(expectedProducts);
    expect(syncResult.active_products).toBe(expectedProducts);
    const adminZoneResponse = await request(httpServer)
      .get(`/admin/zones/${fixture.zone.id}`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .expect(200);
    expect(unwrapBody(adminZoneResponse.body).readiness).toEqual(
      expect.objectContaining({
        essential_catalog_products: expectedProducts,
        active_products: expectedProducts,
        catalog_in_sync: true,
      }),
    );

    const duplicateProducts = await withTenant(
      prisma,
      fixture.zone.operator_tenant.id,
      (tx) =>
        tx.product.findMany({
          where: {
            tenant_id: fixture.zone.operator_tenant.id,
            catalog_item_id: {
              in: duplicateCatalogItems.map((item) => item.id),
            },
          },
          orderBy: { catalog_item_id: 'asc' },
        }),
    );
    expect(duplicateProducts).toHaveLength(2);
    expect(duplicateProducts.every((product) => product.is_available)).toBe(
      true,
    );
    expect(duplicateProducts.map((product) => product.catalog_item_id)).toEqual(
      duplicateCatalogItems.map((item) => item.id).sort((a, b) => a - b),
    );
    expect(duplicateProducts.map((product) => product.id)).toContain(
      duplicateLegacyProduct.id,
    );
    expect(
      Number(
        duplicateProducts.find(
          (product) => product.id === duplicateLegacyProduct.id,
        ).current_price,
      ),
    ).toBe(88);
    const publicProductsResponse = await request(httpServer)
      .get(`/zone-storefronts/public/${fixture.zone.slug}/products?limit=1`)
      .expect(200);
    expect(unwrapBody(publicProductsResponse.body).meta.total).toBe(
      expectedProducts,
    );

    const retained = await withTenant(
      prisma,
      fixture.zone.operator_tenant.id,
      async (tx) => ({
        replacement: await tx.product.findUniqueOrThrow({
          where: { id: fixture.replacementProduct.id },
        }),
        legacy: await tx.product.findUniqueOrThrow({
          where: { id: legacyProduct.id },
        }),
        manual: await tx.product.findUniqueOrThrow({
          where: { id: fixture.manualProduct.id },
        }),
        polluted: await tx.product.findUniqueOrThrow({
          where: { id: fixture.pollutedProduct.id },
        }),
      }),
    );
    expect(retained.replacement).toEqual(
      expect.objectContaining({
        name: `${fixture.replacementCatalogItem.name} محدث`,
        current_price: expect.anything(),
        is_available: true,
      }),
    );
    expect(Number(retained.replacement.current_price)).toBe(77);
    expect(retained.legacy).toEqual(
      expect.objectContaining({
        catalog_item_id: legacyCatalogItem.id,
        is_available: true,
      }),
    );
    expect(Number(retained.legacy.current_price)).toBe(33);
    expect(retained.manual.status).toBe('active');
    expect(retained.manual.catalog_item_id).toBeNull();
    expect(retained.polluted.status).toBe('archived');

    await request(httpServer)
      .patch(`/admin/catalog-items/${legacyCatalogItem.id}`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({ is_active: false, is_essential: true })
      .expect(400);
    await request(httpServer)
      .patch(`/admin/catalog-items/${legacyCatalogItem.id}`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({ is_active: false })
      .expect(200);
    const deactivatedCatalogItem = await prisma.catalogItem.findUniqueOrThrow({
      where: { id: legacyCatalogItem.id },
    });
    expect(deactivatedCatalogItem).toEqual(
      expect.objectContaining({ is_active: false, is_essential: false }),
    );
    await request(httpServer)
      .post(`/admin/zones/${fixture.zone.id}/catalog/sync-essentials`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({})
      .expect(201);
    const removedLegacy = await withTenant(
      prisma,
      fixture.zone.operator_tenant.id,
      (tx) => tx.product.findUniqueOrThrow({ where: { id: legacyProduct.id } }),
    );
    expect(removedLegacy.status).toBe('archived');

    await withTenant(prisma, fixture.zone.operator_tenant.id, (tx) =>
      tx.product.update({
        where: { id: fixture.replacementProduct.id },
        data: { is_available: true },
      }),
    );

    const idempotentResponse = await request(httpServer)
      .post(`/admin/zones/${fixture.zone.id}/catalog/sync-essentials`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({})
      .expect(201);
    expect(unwrapBody(idempotentResponse.body)).toEqual(
      expect.objectContaining({
        created: 0,
        linked: 0,
        updated: 0,
        archived: 0,
      }),
    );
  });

  it('uses exact active system categories and archives retired category products', async () => {
    const fixture = grocery;
    const activeCategory = `تصنيف حالي ${runId}`;
    const retiredCategory = `تصنيف محذوف ${runId}`;
    const activeCatalogItem = await prisma.catalogItem.create({
      data: {
        name: `Current taxonomy essential ${runId}`,
        category: activeCategory,
        source: fixture.catalogSource,
        external_id: `zone-current-taxonomy-${runId}`,
        is_active: true,
        is_essential: true,
        price: 21,
      },
    });
    const retiredCatalogItem = await prisma.catalogItem.create({
      data: {
        name: `Retired taxonomy essential ${runId}`,
        category: retiredCategory,
        source: fixture.catalogSource,
        external_id: `zone-retired-taxonomy-${runId}`,
        is_active: true,
        is_essential: true,
        price: 22,
      },
    });
    await prisma.catalogCategory.createMany({
      data: [
        { source: fixture.catalogSource, name: activeCategory },
        { source: fixture.catalogSource, name: retiredCategory },
      ],
    });

    try {
      await request(httpServer)
        .post(`/admin/zones/${fixture.zone.id}/catalog/sync-essentials`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({})
        .expect(201);

      const initiallySynced = await withTenant(
        prisma,
        fixture.zone.operator_tenant.id,
        (tx) =>
          tx.product.findMany({
            where: {
              tenant_id: fixture.zone.operator_tenant.id,
              catalog_item_id: {
                in: [activeCatalogItem.id, retiredCatalogItem.id],
              },
            },
          }),
      );
      expect(initiallySynced).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            catalog_item_id: activeCatalogItem.id,
            category: activeCategory,
            status: 'active',
          }),
          expect.objectContaining({
            catalog_item_id: retiredCatalogItem.id,
            category: retiredCategory,
            status: 'active',
          }),
        ]),
      );

      await prisma.catalogCategory.update({
        where: {
          source_name: {
            source: fixture.catalogSource,
            name: retiredCategory,
          },
        },
        data: { deleted_at: new Date() },
      });

      const syncResponse = await request(httpServer)
        .post(`/admin/zones/${fixture.zone.id}/catalog/sync-essentials`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({})
        .expect(201);
      expect(unwrapBody(syncResponse.body).archived).toBeGreaterThanOrEqual(1);

      const reconciled = await withTenant(
        prisma,
        fixture.zone.operator_tenant.id,
        (tx) =>
          tx.product.findMany({
            where: {
              tenant_id: fixture.zone.operator_tenant.id,
              catalog_item_id: {
                in: [activeCatalogItem.id, retiredCatalogItem.id],
              },
            },
          }),
      );
      expect(reconciled).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            catalog_item_id: activeCatalogItem.id,
            category: activeCategory,
            status: 'active',
          }),
          expect.objectContaining({
            catalog_item_id: retiredCatalogItem.id,
            status: 'archived',
            is_available: false,
          }),
        ]),
      );

      const categoriesResponse = await request(httpServer)
        .get(`/zone-storefronts/public/${fixture.zone.slug}/categories`)
        .expect(200);
      const publicCategoryNames = unwrapBody(categoriesResponse.body).map(
        (category) => category.category,
      );
      expect(publicCategoryNames).toContain(activeCategory);
      expect(publicCategoryNames).not.toContain(retiredCategory);
    } finally {
      await prisma.catalogItem.updateMany({
        where: { id: { in: [activeCatalogItem.id, retiredCatalogItem.id] } },
        data: { is_active: false, is_essential: false },
      });
      await prisma.catalogCategory.deleteMany({
        where: {
          source: fixture.catalogSource,
          name: { in: [activeCategory, retiredCategory] },
        },
      });
      await request(httpServer)
        .post(`/admin/zones/${fixture.zone.id}/catalog/sync-essentials`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({})
        .expect(201);
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
    const dashboardBeforeCheckout = await getAdminDashboardStats(
      httpServer,
      platformAdminToken,
    );
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
    expect(
      await getAdminDashboardStats(httpServer, platformAdminToken),
    ).toEqual(dashboardBeforeCheckout);

    const checkoutPhone = generateEgyptPhone(32);
    const response = await createZoneOrder(httpServer, fixture, {
      phone: checkoutPhone,
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
    fixture.checkoutPhone = checkoutPhone;

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

    const dashboardAfterCheckout = await getAdminDashboardStats(
      httpServer,
      platformAdminToken,
    );
    expect(dashboardAfterCheckout.totalOrders).toBe(
      dashboardBeforeCheckout.totalOrders + 1,
    );
    expect(dashboardAfterCheckout.completedOrders).toBe(
      dashboardBeforeCheckout.completedOrders,
    );
    fixture.dashboardStatsAfterCheckout = dashboardAfterCheckout;
  });

  it('enqueues encrypted Meta purchases only for signed consented public checkouts', async () => {
    const fixture = grocery;
    await withMetaTestConfig(async ({ signingSecret }) => {
      const unsignedPhone = generateEgyptPhone(320);
      const signedHeaders = buildSignedMetaHeaders(signingSecret, {
        ip: '203.0.113.24',
        userAgent: 'Tijaratk Meta E2E Browser/1.0',
      });
      const unsignedOrder = await createZoneOrder(httpServer, fixture, {
        phone: unsignedPhone,
        headers: signedHeaders,
      });
      expect(unsignedOrder.meta_purchase).toBeUndefined();
      expect(
        await prisma.metaConversionOutbox.findUnique({
          where: { order_id: unsignedOrder.id },
        }),
      ).toBeNull();

      const zonePhone = generateEgyptPhone(321);
      const consentCookies = [
        'tijaratk_marketing_consent=granted',
        '_fbp=fb.1.1721000000000.123456789',
        '_fbc=fb.1.1721000000000.AbCdEf123',
      ].join('; ');
      const zoneOrder = await createZoneOrder(httpServer, fixture, {
        phone: zonePhone,
        headers: signedHeaders,
        cookies: consentCookies,
      });
      expect(zoneOrder.meta_purchase).toEqual({
        event_id: expect.any(String),
        value: 15,
        currency: 'EGP',
      });

      const zoneOutbox = await prisma.metaConversionOutbox.findUniqueOrThrow({
        where: { order_id: zoneOrder.id },
      });
      expect(zoneOutbox).toEqual(
        expect.objectContaining({
          event_id: zoneOrder.meta_purchase.event_id,
          event_name: 'Purchase',
          status: 'pending',
          attempt_count: 0,
          encrypted_payload: expect.any(String),
        }),
      );
      expect(
        await prisma.metaConversionOutbox.count({
          where: { order_id: zoneOrder.id },
        }),
      ).toBe(1);
      expect(zoneOutbox.encrypted_payload).not.toContain(zonePhone);

      const zonePayload = JSON.parse(decrypt(zoneOutbox.encrypted_payload));
      expect(zonePayload).toEqual(
        expect.objectContaining({
          event_name: 'Purchase',
          event_id: zoneOrder.meta_purchase.event_id,
          action_source: 'website',
          event_source_url: `https://tijaratk.com/market/${fixture.zone.slug}`,
          user_data: expect.objectContaining({
            ph: [hashMetaPhone(zonePhone)],
            client_ip_address: '203.0.113.24',
            client_user_agent: 'Tijaratk Meta E2E Browser/1.0',
            fbp: 'fb.1.1721000000000.123456789',
            fbc: 'fb.1.1721000000000.AbCdEf123',
          }),
          custom_data: expect.objectContaining({
            currency: 'EGP',
            value: 15,
            conversion_type: 'order_created',
            storefront_type: 'zone',
            content_ids: [String(fixture.catalogProduct.id)],
          }),
        }),
      );
      const serializedZonePayload = JSON.stringify(zonePayload);
      expect(serializedZonePayload).not.toContain(zonePhone);
      expect(serializedZonePayload).not.toContain('Zone Customer');
      expect(serializedZonePayload).not.toContain('Zone delivery address');

      const merchant = fixture.merchants[0];
      const merchantTenant = await prisma.tenant.update({
        where: { id: merchant.tenantId },
        data: {
          onboarding_completed: true,
          delivery_available: true,
          delivery_fee: 0,
        },
      });
      await withTenant(prisma, merchant.tenantId, (tx) =>
        tx.product.createMany({
          data: Array.from({ length: 100 }, (_, index) => ({
            tenant_id: merchant.tenantId,
            name: `Meta merchant product ${runId} ${index + 1}`,
            category: fixture.allowedCategory,
            source: 'manual',
            status: 'active',
            current_price: 12,
            is_available: true,
          })),
        }),
      );
      const merchantProduct = await withTenant(
        prisma,
        merchant.tenantId,
        (tx) =>
          tx.product.findFirstOrThrow({
            where: {
              tenant_id: merchant.tenantId,
              name: { startsWith: `Meta merchant product ${runId}` },
            },
            orderBy: { id: 'asc' },
          }),
      );

      const merchantPhone = generateEgyptPhone(322);
      const merchantResponse = await request(httpServer)
        .post(`/orders/${merchantTenant.slug}`)
        .set('Cookie', consentCookies)
        .set(signedHeaders)
        .send({
          customer: {
            name: 'Meta Merchant Customer',
            phone: merchantPhone,
            address: 'Meta merchant delivery address',
          },
          items: [{ product_id: merchantProduct.id, quantity: '1' }],
        })
        .expect(201);
      const merchantOrder = unwrapBody(merchantResponse.body);
      expect(merchantOrder.meta_purchase).toEqual({
        event_id: expect.any(String),
        value: 12,
        currency: 'EGP',
      });
      const merchantOutbox =
        await prisma.metaConversionOutbox.findUniqueOrThrow({
          where: { order_id: merchantOrder.id },
        });
      const merchantPayload = JSON.parse(
        decrypt(merchantOutbox.encrypted_payload),
      );
      expect(merchantPayload).toEqual(
        expect.objectContaining({
          event_id: merchantOrder.meta_purchase.event_id,
          event_source_url: `https://tijaratk.com/${merchantTenant.slug}`,
          user_data: expect.objectContaining({
            ph: [hashMetaPhone(merchantPhone)],
          }),
          custom_data: expect.objectContaining({
            storefront_type: 'tenant',
            conversion_type: 'order_created',
          }),
        }),
      );

      const dashboardResponse = await request(httpServer)
        .post('/orders')
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({
          customer: { phone: generateEgyptPhone(323) },
          free_text_payload: { text: 'Dashboard order must not be tracked' },
        })
        .expect(201);
      const dashboardOrder = unwrapBody(dashboardResponse.body);
      expect(dashboardOrder.meta_purchase).toBeUndefined();
      expect(
        await prisma.metaConversionOutbox.findUnique({
          where: { order_id: dashboardOrder.id },
        }),
      ).toBeNull();

      const metaService = app.get(MetaConversionsService);
      const originalFetch = global.fetch;
      try {
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ events_received: 1 }),
        });
        const concurrentWorkers = Array.from(
          { length: 3 },
          () => new MetaConversionsWorker(prisma, metaService),
        );
        await Promise.all(concurrentWorkers.map((worker) => worker.tick()));
        expect(global.fetch).toHaveBeenCalledTimes(2);

        const deliveredRows = await prisma.metaConversionOutbox.findMany({
          where: { id: { in: [zoneOutbox.id, merchantOutbox.id] } },
          orderBy: { id: 'asc' },
        });
        expect(deliveredRows).toHaveLength(2);
        for (const deliveredRow of deliveredRows) {
          expect(deliveredRow.status).toBe('sent');
          expect(deliveredRow.encrypted_payload).toBeNull();
          expect(deliveredRow.sent_at).toBeTruthy();
        }

        const retryOrder = await createZoneOrder(httpServer, fixture, {
          phone: generateEgyptPhone(324),
          headers: buildSignedMetaHeaders(signingSecret, {
            ip: '203.0.113.25',
            userAgent: 'Tijaratk Retry E2E Browser/1.0',
          }),
          cookies: consentCookies,
        });
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
        });
        const retryWorker = new MetaConversionsWorker(prisma, metaService);
        await retryWorker.tick();
        const retryRow = await prisma.metaConversionOutbox.findUniqueOrThrow({
          where: { order_id: retryOrder.id },
        });
        expect(retryRow).toEqual(
          expect.objectContaining({
            status: 'pending',
            attempt_count: 1,
            last_error_code: 'http_500',
          }),
        );
        expect(retryRow.next_attempt_at.getTime()).toBeGreaterThan(Date.now());

        await prisma.metaConversionOutbox.update({
          where: { id: retryRow.id },
          data: {
            status: 'processing',
            locked_by: 'crashed-worker',
            locked_at: new Date(Date.now() - 3 * 60 * 1000),
            next_attempt_at: new Date(0),
          },
        });
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ events_received: 1 }),
        });
        await retryWorker.tick();
        expect(
          await prisma.metaConversionOutbox.findUniqueOrThrow({
            where: { id: retryRow.id },
          }),
        ).toEqual(expect.objectContaining({ status: 'pending' }));
        await retryWorker.tick();
        expect(
          await prisma.metaConversionOutbox.findUniqueOrThrow({
            where: { id: retryRow.id },
          }),
        ).toEqual(
          expect.objectContaining({
            status: 'sent',
            encrypted_payload: null,
          }),
        );

        const deadOrder = await createZoneOrder(httpServer, fixture, {
          phone: generateEgyptPhone(325),
          headers: buildSignedMetaHeaders(signingSecret, {
            ip: '203.0.113.26',
            userAgent: 'Tijaratk Dead Letter E2E Browser/1.0',
          }),
          cookies: consentCookies,
        });
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 400,
        });
        const deadLetterWorker = new MetaConversionsWorker(
          prisma,
          metaService,
        );
        await deadLetterWorker.tick();
        expect(
          await prisma.metaConversionOutbox.findUniqueOrThrow({
            where: { order_id: deadOrder.id },
          }),
        ).toEqual(
          expect.objectContaining({
            status: 'dead_letter',
            attempt_count: 1,
            last_error_code: 'http_400',
            terminal_at: expect.any(Date),
          }),
        );
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  it('persists consented GA4 identifiers and delivers an idempotent direct-store lifecycle', async () => {
    const fixture = grocery;
    const merchant = fixture.merchants[0];

    await withGa4TestConfig(async () => {
      const tenant = await prisma.tenant.update({
        where: { id: merchant.tenantId },
        data: {
          onboarding_completed: true,
          delivery_available: true,
          delivery_fee: 0,
        },
      });
      const product = await withTenant(prisma, merchant.tenantId, (tx) =>
        tx.product.create({
          data: {
            tenant_id: merchant.tenantId,
            name: `GA4 merchant product ${runId}`,
            category: fixture.allowedCategory,
            source: 'manual',
            status: 'active',
            current_price: 24,
            is_available: true,
          },
        }),
      );
      const consentCookie = 'tijaratk_marketing_consent=granted';

      const checkout = async ({ suffix, consent = true }) => {
        const draftResponse = await request(httpServer)
          .put(`/storefront-cart-drafts/${tenant.slug}`)
          .send({
            items: [
              {
                product_id: product.id,
                selection_mode: 'quantity',
                selection_quantity: 1,
              },
            ],
            delivery_area_id: fixture.area.id,
          })
          .expect(200);
        const draftToken = unwrapBody(draftResponse.body).token;
        const checkoutRequest = request(httpServer)
          .post(`/storefront-cart-drafts/${tenant.slug}/checkout`)
          .set('X-Storefront-Cart-Token', draftToken);
        if (consent) checkoutRequest.set('Cookie', consentCookie);
        const response = await checkoutRequest
          .send({
            customer: {
              name: `GA4 Customer ${suffix}`,
              phone: generateEgyptPhone(400 + suffix),
              address: 'GA4 delivery address',
            },
            delivery_address: 'GA4 delivery address',
            ga_client_id: `1721000000.${suffix}`,
            ga_session_id: '1721000000',
          })
          .expect(201);
        return {
          body: unwrapBody(response.body),
          draftToken,
        };
      };

      const tracked = await checkout({ suffix: 1 });
      expect(tracked.body).not.toHaveProperty('ga_client_id');
      expect(tracked.body).not.toHaveProperty('ga_session_id');
      const retryResponse = await request(httpServer)
        .post(`/storefront-cart-drafts/${tenant.slug}/checkout`)
        .set('X-Storefront-Cart-Token', tracked.draftToken)
        .set('Cookie', consentCookie)
        .send({
          customer: {
            name: 'Retry must not replace the original order',
            phone: generateEgyptPhone(451),
            address: 'Retry address',
          },
          delivery_address: 'Retry address',
          ga_client_id: '999.999',
          ga_session_id: '999',
        })
        .expect(201);
      const retried = unwrapBody(retryResponse.body);
      expect(retried.id).toBe(tracked.body.id);
      expect(retried).not.toHaveProperty('ga_client_id');
      expect(retried).not.toHaveProperty('ga_session_id');

      const persisted = await withTenant(prisma, merchant.tenantId, (tx) =>
        tx.order.findUniqueOrThrow({ where: { id: tracked.body.id } }),
      );
      expect(persisted).toEqual(
        expect.objectContaining({
          ga_client_id: '1721000000.1',
          ga_session_id: '1721000000',
          order_source: 'storefront',
        }),
      );

      await request(httpServer)
        .patch(`/orders/${tracked.body.id}`)
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ status: 'confirmed' })
        .expect(200);
      await request(httpServer)
        .patch(`/orders/${tracked.body.id}`)
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ status: 'confirmed' })
        .expect(200);
      expect(
        await prisma.ga4EventOutbox.count({
          where: {
            order_id: tracked.body.id,
            event_name: 'order_confirmed',
          },
        }),
      ).toBe(1);

      await request(httpServer)
        .patch(`/orders/${tracked.body.id}`)
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ status: 'out_for_delivery' })
        .expect(200);
      await request(httpServer)
        .patch(`/orders/${tracked.body.id}`)
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ status: 'completed' })
        .expect(200);

      const cancelled = await checkout({ suffix: 2 });
      await request(httpServer)
        .patch(`/orders/${cancelled.body.id}`)
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({
          status: 'cancelled',
          cancellation_reason: 'GA4 E2E cancellation',
        })
        .expect(200);

      const unconsented = await checkout({ suffix: 3, consent: false });
      await request(httpServer)
        .patch(`/orders/${unconsented.body.id}`)
        .set('Authorization', `Bearer ${merchant.token}`)
        .send({ status: 'confirmed' })
        .expect(200);
      const unconsentedOrder = await withTenant(
        prisma,
        merchant.tenantId,
        (tx) => tx.order.findUniqueOrThrow({ where: { id: unconsented.body.id } }),
      );
      expect(unconsentedOrder.ga_client_id).toBeNull();
      expect(
        await prisma.ga4EventOutbox.count({
          where: { order_id: unconsented.body.id },
        }),
      ).toBe(0);

      const ga4Service = app.get(GoogleAnalyticsService);
      await withTenant(prisma, fixture.zone.operator_tenant.id, async (tx) => {
        await tx.order.update({
          where: { id: fixture.checkout.id },
          data: {
            ga_client_id: '1721000000.4',
            ga_session_id: '1721000000',
          },
        });
        await ga4Service.enqueueLifecycleEvent({
          manager: tx,
          orderId: fixture.checkout.id,
          eventName: 'order_confirmed',
          previousStatus: 'draft',
        });
      });
      expect(
        await prisma.ga4EventOutbox.count({
          where: { order_id: fixture.checkout.id },
        }),
      ).toBe(0);

      const lifecycleRows = await prisma.ga4EventOutbox.findMany({
        where: {
          order_id: { in: [tracked.body.id, cancelled.body.id] },
        },
        orderBy: { id: 'asc' },
      });
      expect(lifecycleRows.map((row) => row.event_name).sort()).toEqual([
        'order_cancelled',
        'order_confirmed',
        'purchase',
      ]);
      for (const row of lifecycleRows) {
        expect(row.encrypted_payload).not.toContain('GA4 Customer');
        const payload = JSON.parse(decrypt(row.encrypted_payload));
        expect(JSON.stringify(payload)).not.toContain('GA4 delivery address');
        expect(payload.client_id).toMatch(/^1721000000\.[12]$/);
      }

      const originalFetch = global.fetch;
      try {
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          status: 204,
        });
        const worker = new GoogleAnalyticsWorker(prisma, ga4Service);
        await worker.tick();
        expect(global.fetch).toHaveBeenCalledTimes(3);
        for (const [endpoint, requestOptions] of global.fetch.mock.calls) {
          expect(String(endpoint)).toContain(
            'measurement_id=G-TEST1234',
          );
          expect(String(endpoint)).toContain('api_secret=ga4-e2e-secret');
          expect(JSON.parse(requestOptions.body)).toEqual(
            expect.objectContaining({
              client_id: expect.any(String),
              events: expect.any(Array),
            }),
          );
        }
        const deliveredRows = await prisma.ga4EventOutbox.findMany({
          where: { id: { in: lifecycleRows.map((row) => row.id) } },
        });
        expect(deliveredRows).toHaveLength(3);
        expect(
          deliveredRows.every(
            (row) => row.status === 'sent' && row.encrypted_payload === null,
          ),
        ).toBe(true);

        const retryable = await checkout({ suffix: 5 });
        await request(httpServer)
          .patch(`/orders/${retryable.body.id}`)
          .set('Authorization', `Bearer ${merchant.token}`)
          .send({ status: 'confirmed' })
          .expect(200);
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
        });
        const retryWorker = new GoogleAnalyticsWorker(prisma, ga4Service);
        await retryWorker.tick();
        expect(
          await prisma.ga4EventOutbox.findFirstOrThrow({
            where: {
              order_id: retryable.body.id,
              event_name: 'order_confirmed',
            },
          }),
        ).toEqual(
          expect.objectContaining({
            status: 'pending',
            attempt_count: 1,
            last_error_code: 'http_500',
          }),
        );
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  it('removes uploaded prescriptions rejected before zone order persistence', async () => {
    const filesBefore = await listZonePrescriptionFiles();
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const cases = [
      {
        slug: `missing-zone-${runId}`,
        productId: pharmacy.catalogProduct.id,
        status: 404,
      },
      {
        slug: grocery.zone.slug,
        productId: grocery.catalogProduct.id,
        status: 400,
      },
      {
        slug: pharmacy.zone.slug,
        productId: 2147483647,
        status: 400,
      },
    ];

    for (const [index, testCase] of cases.entries()) {
      await request(httpServer)
        .post(`/zone-storefronts/public/${testCase.slug}/orders`)
        .field(
          'customer',
          JSON.stringify({
            name: 'Prescription Cleanup Customer',
            phone: generateEgyptPhone(330 + index),
            address: 'Prescription cleanup address',
          }),
        )
        .field(
          'items',
          JSON.stringify([{ product_id: testCase.productId, quantity: '1' }]),
        )
        .attach('prescription_file', image, {
          filename: `cleanup-${index}.png`,
          contentType: 'image/png',
        })
        .expect(testCase.status);

      expect(await listZonePrescriptionFiles()).toEqual(filesBefore);
    }
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

    const rejectedInboxResponse = await request(httpServer)
      .get('/orders/inbox-summary')
      .set('Authorization', `Bearer ${firstMerchant.token}`)
      .expect(200);
    expect(unwrapBody(rejectedInboxResponse.body).assigned_counts).toEqual({
      pending: 0,
      accepted: 0,
      total: 0,
    });

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

    const pendingInboxResponse = await request(httpServer)
      .get('/orders/inbox-summary')
      .set('Authorization', `Bearer ${secondMerchant.token}`)
      .expect(200);
    const pendingInbox = unwrapBody(pendingInboxResponse.body);
    expect(pendingInbox.assigned_counts).toEqual({
      pending: 1,
      accepted: 0,
      total: 1,
    });
    expect(pendingInbox.new_orders_count).toBe(
      pendingInbox.owned_status_counts.draft + 1,
    );

    const dashboardAfterReassignment = await getAdminDashboardStats(
      httpServer,
      platformAdminToken,
    );
    expect(dashboardAfterReassignment.totalOrders).toBe(
      fixture.dashboardStatsAfterCheckout.totalOrders,
    );
    expect(dashboardAfterReassignment.completedOrders).toBe(
      fixture.dashboardStatsAfterCheckout.completedOrders,
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

    await prisma.zoneStorefront.update({
      where: { id: fixture.zone.id },
      data: { is_active: false },
    });
    try {
      const inactiveTrackingResponse = await request(httpServer)
        .get(`/orders/tracking/${fixture.checkout.public_token}`)
        .expect(200);
      expect(
        unwrapBody(inactiveTrackingResponse.body).zone_storefront.reorder_url,
      ).toBeNull();
    } finally {
      await prisma.zoneStorefront.update({
        where: { id: fixture.zone.id },
        data: { is_active: true },
      });
    }

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
    fixture.normalOrder = normalOrder;

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

  it('returns tenant-isolated inbox counters and updates them after confirmation', async () => {
    const fixture = grocery;
    const merchant = fixture.merchants[1];

    const inboxResponse = await request(httpServer)
      .get('/orders/inbox-summary')
      .set('Authorization', `Bearer ${merchant.token}`)
      .expect(200);
    const inbox = unwrapBody(inboxResponse.body);
    expect(inbox.assigned_counts).toEqual({
      pending: 0,
      accepted: 1,
      total: 1,
    });
    expect(inbox.owned_status_counts.draft).toBeGreaterThanOrEqual(1);
    expect(inbox.new_orders_count).toBe(inbox.owned_status_counts.draft);

    const datedInboxResponse = await request(httpServer)
      .get('/orders/inbox-summary')
      .query({ date: '2000-01-01' })
      .set('Authorization', `Bearer ${merchant.token}`)
      .expect(200);
    const datedInbox = unwrapBody(datedInboxResponse.body);
    expect(datedInbox.owned_status_counts).toEqual({
      draft: 0,
      confirmed: 0,
      out_for_delivery: 0,
      completed: 0,
      cancelled: 0,
      rejected_by_customer: 0,
    });
    expect(datedInbox.assigned_counts).toEqual(inbox.assigned_counts);
    expect(datedInbox.new_orders_count).toBe(0);

    const otherTenantResponse = await request(httpServer)
      .get('/orders/inbox-summary')
      .set('Authorization', `Bearer ${pharmacy.merchants[0].token}`)
      .expect(200);
    const otherTenantInbox = unwrapBody(otherTenantResponse.body);
    expect(otherTenantInbox.assigned_counts).toEqual({
      pending: 0,
      accepted: 0,
      total: 0,
    });
    expect(otherTenantInbox.new_orders_count).toBe(
      otherTenantInbox.owned_status_counts.draft,
    );

    await request(httpServer)
      .patch(`/orders/${fixture.normalOrder.id}`)
      .set('Authorization', `Bearer ${merchant.token}`)
      .send({ status: 'confirmed' })
      .expect(200);

    const confirmedInboxResponse = await request(httpServer)
      .get('/orders/inbox-summary')
      .set('Authorization', `Bearer ${merchant.token}`)
      .expect(200);
    const confirmedInbox = unwrapBody(confirmedInboxResponse.body);
    expect(confirmedInbox.assigned_counts).toEqual(inbox.assigned_counts);
    expect(confirmedInbox.owned_status_counts.draft).toBe(
      inbox.owned_status_counts.draft - 1,
    );
    expect(confirmedInbox.owned_status_counts.confirmed).toBe(
      inbox.owned_status_counts.confirmed + 1,
    );
    expect(confirmedInbox.new_orders_count).toBe(inbox.new_orders_count - 1);
  });

  it('counts a completed assigned order once across its full lifecycle', async () => {
    const fixture = grocery;
    const merchant = fixture.merchants[0];
    const dashboardBeforeCheckout = await getAdminDashboardStats(
      httpServer,
      platformAdminToken,
    );
    const completedOrder = await createZoneOrder(httpServer, fixture, {
      phone: generateEgyptPhone(42),
    });
    const dispatch = await prisma.orderDispatch.findUniqueOrThrow({
      where: { order_id: completedOrder.id },
    });
    const dashboardAfterCheckout = await getAdminDashboardStats(
      httpServer,
      platformAdminToken,
    );
    expect(dashboardAfterCheckout.totalOrders).toBe(
      dashboardBeforeCheckout.totalOrders + 1,
    );
    expect(dashboardAfterCheckout.completedOrders).toBe(
      dashboardBeforeCheckout.completedOrders,
    );

    const assignedDispatch = await assignDispatch({
      httpServer,
      adminToken: platformAdminToken,
      cookie: fixture.managedCookie,
      operatorTenantId: fixture.zone.operator_tenant.id,
      dispatchId: dispatch.id,
      merchantTenantId: merchant.tenantId,
      expectedVersion: dispatch.version,
    });
    const assignment = currentAssignment(assignedDispatch);
    await request(httpServer)
      .post(`/assigned-orders/${dispatch.id}/accept`)
      .set('Authorization', `Bearer ${merchant.token}`)
      .send({ expected_version: assignment.version })
      .expect(201);
    await request(httpServer)
      .patch(`/assigned-orders/${dispatch.id}/status`)
      .set('Authorization', `Bearer ${merchant.token}`)
      .send({ status: 'out_for_delivery' })
      .expect(200);
    await request(httpServer)
      .patch(`/assigned-orders/${dispatch.id}/status`)
      .set('Authorization', `Bearer ${merchant.token}`)
      .send({ status: 'completed' })
      .expect(200);

    const dashboardAfterCompletion = await getAdminDashboardStats(
      httpServer,
      platformAdminToken,
    );
    expect(dashboardAfterCompletion.totalOrders).toBe(
      dashboardAfterCheckout.totalOrders,
    );
    expect(dashboardAfterCompletion.completedOrders).toBe(
      dashboardAfterCheckout.completedOrders + 1,
    );
    expect(
      await getAdminDashboardStats(httpServer, platformAdminToken),
    ).toEqual(dashboardAfterCompletion);
  });

  it('keeps tracking available and blocks dispatch when disabled', async () => {
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
      const discoveryResponse = await request(httpServer)
        .get('/zone-storefronts/public')
        .expect(200);
      expect(unwrapBody(discoveryResponse.body)).toEqual([]);
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
      const trackingResponse = await request(httpServer)
        .get(`/orders/tracking/${fixture.checkout.public_token}`)
        .expect(200);
      expect(unwrapBody(trackingResponse.body).zone_storefront).toEqual(
        expect.objectContaining({
          id: fixture.zone.id,
          reorder_url: null,
        }),
      );

      const normalTrackingResponse = await request(httpServer)
        .get(`/orders/tracking/${fixture.normalOrder.public_token}`)
        .expect(200);
      expect(unwrapBody(normalTrackingResponse.body)).toEqual(
        expect.objectContaining({
          id: fixture.normalOrder.id,
          zone_storefront: null,
          tenant: expect.objectContaining({ slug: expect.any(String) }),
        }),
      );

      const customerOrdersResponse = await request(httpServer)
        .get('/customers/public/by-access-code/orders')
        .query({
          code: fixture.checkout.customer_access_code,
          phone: fixture.checkoutPhone,
        })
        .expect(200);
      const customerOrder = unwrapBody(customerOrdersResponse.body).find(
        (order) => order.id === fixture.checkout.id,
      );
      expect(customerOrder).toEqual(
        expect.objectContaining({
          zone_storefront: expect.objectContaining({
            id: fixture.zone.id,
            reorder_url: null,
          }),
          tenant: expect.objectContaining({
            id: fixture.zone.id,
            slug: fixture.zone.slug,
          }),
        }),
      );

      const acceptedDispatch = await prisma.orderDispatch.findUniqueOrThrow({
        where: { id: fixture.dispatch.id },
      });
      await request(httpServer)
        .get('/admin/zones')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(404);
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
        .expect(404);
      await request(httpServer)
        .get('/assigned-orders')
        .set('Authorization', `Bearer ${fixture.merchants[1].token}`)
        .expect(404);
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
  area: providedArea,
  suffix,
  category,
  allowedCategory,
  secondAllowedCategory,
  pollutedCategory,
  merchantCount,
  password,
}) {
  const area =
    providedArea ??
    (await prisma.directoryArea.create({
      data: {
        name_ar: `منطقة ${suffix} ${runId}`,
        name_en: `${suffix} zone ${runId}`,
        slug: `zone-area-${suffix}-${runId}`.toLowerCase(),
        is_active: true,
      },
    }));
  const merchants = [];
  for (let index = 0; index < merchantCount; index += 1) {
    const storeName = `Zone ${suffix} Merchant ${index + 1} ${runId}`;
    const phone = generateEgyptPhone(
      (category === 'pharmacy' ? 500 : 100) + merchants.length + area.id,
    );
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

  const catalogSource = category === 'pharmacy' ? 'chefaa_csv' : 'talabat_csv';
  const catalogItems = await Promise.all(
    [allowedCategory, secondAllowedCategory].map((itemCategory, index) =>
      prisma.catalogItem.create({
        data: {
          name: `Zone ${suffix} Essential ${runId} ${index + 1}`,
          category: itemCategory,
          source: catalogSource,
          external_id: `zone-${suffix}-${runId}-${index + 1}`,
          is_active: true,
          is_essential: true,
          essential_sort_order: index + 1,
          price: 10 + index,
        },
      }),
    ),
  );
  const wrongSource =
    catalogSource === 'talabat_csv' ? 'chefaa_csv' : 'talabat_csv';
  const wrongSourceCategory =
    wrongSource === 'chefaa_csv' ? 'أدوية' : 'ألبان و بيض';
  const excludedCatalogItems = await Promise.all([
    prisma.catalogItem.create({
      data: {
        name: `Zone ${suffix} Nonessential ${runId}`,
        category: allowedCategory,
        source: catalogSource,
        external_id: `zone-${suffix}-${runId}-nonessential`,
        is_active: true,
        is_essential: false,
        price: 12,
      },
    }),
    prisma.catalogItem.create({
      data: {
        name: `Zone ${suffix} Invalid Category ${runId}`,
        category: pollutedCategory,
        source: catalogSource,
        external_id: `zone-${suffix}-${runId}-invalid-category`,
        is_active: true,
        is_essential: false,
        price: 12,
      },
    }),
    prisma.catalogItem.create({
      data: {
        name: `Zone ${suffix} Inactive ${runId}`,
        category: secondAllowedCategory,
        source: catalogSource,
        external_id: `zone-${suffix}-${runId}-inactive`,
        is_active: false,
        is_essential: false,
        price: 12,
      },
    }),
    prisma.catalogItem.create({
      data: {
        name: `Zone ${suffix} Wrong Source ${runId}`,
        category: wrongSourceCategory,
        source: wrongSource,
        external_id: `zone-${suffix}-${runId}-wrong-source`,
        is_active: true,
        is_essential: true,
        price: 12,
      },
    }),
  ]);

  await request(httpServer)
    .post(`/admin/zones/${zone.id}/merchants`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tenant_id: merchants[0].tenantId, priority: 10, is_active: true })
    .expect(400);

  await prisma.tenantDeliveryArea.createMany({
    data: merchants.map((merchant) => ({
      tenant_id: merchant.tenantId,
      area_id: area.id,
      delivery_fee: 15,
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
  const fixtureProducts = await withTenant(
    prisma,
    zone.operator_tenant.id,
    async (tx) => {
      const pollutedProduct = await tx.product.create({
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
      const manualProduct = await tx.product.create({
        data: {
          tenant_id: zone.operator_tenant.id,
          name: `Manual ${suffix} ${runId}`,
          source: 'manual',
          status: 'active',
          category: allowedCategory,
          current_price: 15,
          is_available: true,
        },
      });
      return { pollutedProduct, manualProduct };
    },
  );
  await request(httpServer)
    .post(`/admin/zones/${zone.id}/catalog/sync-essentials`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({})
    .expect(201);
  const products = await withTenant(
    prisma,
    zone.operator_tenant.id,
    (tx) =>
      tx.product.findMany({
        where: {
          tenant_id: zone.operator_tenant.id,
          catalog_item_id: { in: catalogItems.map((item) => item.id) },
        },
      }),
  );
  const productByCatalogItemId = new Map(
    products.map((product) => [product.catalog_item_id, product]),
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
    allowedCategory,
    secondAllowedCategory,
    catalogSource,
    catalogProduct: productByCatalogItemId.get(catalogItems[0].id),
    replacementProduct: productByCatalogItemId.get(catalogItems[1].id),
    replacementCatalogItem: catalogItems[1],
    excludedCatalogItemNames: excludedCatalogItems.map((item) => item.name),
    pollutedProductName,
    ...fixtureProducts,
  };
}

async function createZoneOrder(httpServer, fixture, options) {
  const checkoutRequest = request(httpServer).post(
    `/zone-storefronts/public/${fixture.zone.slug}/orders`,
  );
  if (options.headers) checkoutRequest.set(options.headers);
  if (options.cookies) checkoutRequest.set('Cookie', options.cookies);

  const response = await checkoutRequest
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

function buildSignedMetaHeaders(signingSecret, { ip, userAgent }) {
  const encodedContext = Buffer.from(
    JSON.stringify({ ip, userAgent, timestamp: Date.now() }),
  ).toString('base64url');
  const signature = createHmac('sha256', signingSecret)
    .update(encodedContext)
    .digest('base64url');
  return {
    'x-tijaratk-meta-context': encodedContext,
    'x-tijaratk-meta-context-signature': signature,
  };
}

function hashMetaPhone(phone) {
  return createHash('sha256').update(phone.replace(/\D/g, '')).digest('hex');
}

async function withMetaTestConfig(callback) {
  const keys = [
    'CLIENT_URL',
    'ENCRYPTION_PASSWORD',
    'META_CAPI_ACCESS_TOKEN',
    'META_CAPI_TEST_EVENT_CODE',
    'META_CONTEXT_SIGNING_SECRET',
    'META_GRAPH_API_VERSION',
    'META_PIXEL_ID',
  ];
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  const signingSecret = `meta-e2e-signing-${Date.now()}`;

  Object.assign(process.env, {
    CLIENT_URL: 'https://tijaratk.com',
    ENCRYPTION_PASSWORD: 'meta-e2e-encryption-password',
    META_CAPI_ACCESS_TOKEN: 'meta-e2e-access-token',
    META_CONTEXT_SIGNING_SECRET: signingSecret,
    META_GRAPH_API_VERSION: 'v23.0',
    META_PIXEL_ID: '123456789012345',
  });
  delete process.env.META_CAPI_TEST_EVENT_CODE;

  try {
    return await callback({ signingSecret });
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

async function withGa4TestConfig(callback) {
  const keys = [
    'ENCRYPTION_PASSWORD',
    'GA4_API_SECRET',
    'GA4_MEASUREMENT_ID',
  ];
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, {
    ENCRYPTION_PASSWORD: 'ga4-e2e-encryption-password',
    GA4_API_SECRET: 'ga4-e2e-secret',
    GA4_MEASUREMENT_ID: 'G-TEST1234',
  });

  try {
    return await callback();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
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

async function getAdminDashboardStats(httpServer, adminToken) {
  const response = await request(httpServer)
    .get('/admin/dashboard-stats')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  return unwrapBody(response.body);
}

function unwrapBody(body) {
  return body && typeof body === 'object' && body.data !== undefined
    ? body.data
    : body;
}

async function listZonePrescriptionFiles() {
  const directory = join(process.cwd(), 'uploads', 'prescriptions');
  try {
    return (await readdir(directory))
      .filter((name) => name.startsWith('zone-prescription-'))
      .sort();
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
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
    await prisma.catalogItem.deleteMany({
      where: { external_id: { contains: runId } },
    });
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
