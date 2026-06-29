const { ValidationPipe } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const request = require('supertest');
const { DataSource } = require('typeorm');

const { AppModule } = require('../dist/app.module');
const {
  validationExceptionFactory,
} = require('../dist/common/utils/validation-exception.factory');
const {
  TypeOrmExceptionFilter,
} = require('../dist/common/filters/db-exception.filter');
const {
  TenantRlsInterceptor,
} = require('../dist/common/interceptors/tenant-rls.interceptor');
const {
  ResponseTransformInterceptor,
} = require('../dist/common/interceptors/response-transform.transform');

const AUTH_SIGNUP_PATH = '/auth/signup';
const AUTH_LOGIN_PATH = '/auth/login';
const AUTH_UPDATE_PASSWORD_PATH = '/auth/update-password';
const PRODUCTS_PATH = '/products';
const PRODUCTS_ITEM_PATH = (id) => `${PRODUCTS_PATH}/${id}`;

jest.setTimeout(120000);

describe('Security E2E (multi-tenant)', () => {
  let app;
  let dataSource;
  let httpServer;
  let tokenTenantA;
  let tokenTenantB;
  let tenantAId;
  let tenantBId;
  let tenantBProductId;
  const password = 'Passw0rd!';

  const runId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    app.useGlobalFilters(new TypeOrmExceptionFilter());

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
    app.useGlobalInterceptors(
      tenantRlsInterceptor,
      new ResponseTransformInterceptor(),
    );

    await app.init();

    httpServer = app.getHttpServer();
    dataSource = app.get(DataSource);

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
  });

  afterAll(async () => {
    await cleanupTenants(dataSource, [tenantAId, tenantBId]);

    if (app) {
      await app.close();
    }
  });

  it('returns 401 when accessing protected route without token', async () => {
    await request(httpServer).get(PRODUCTS_ITEM_PATH(tenantBProductId)).expect(401);
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

async function cleanupTenants(dataSource, tenantIds) {
  if (!dataSource) {
    return;
  }

  const normalizedTenantIds = tenantIds.filter((id) => Number.isInteger(id));
  if (normalizedTenantIds.length === 0) {
    return;
  }

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    for (const tenantId of normalizedTenantIds) {
      await queryRunner.query(`SELECT set_config('app.tenant_id', $1, true)`, [
        String(tenantId),
      ]);

      await queryRunner.query(
        `DELETE FROM "availability_requests" WHERE "tenant_id" = $1`,
        [tenantId],
      );
      await queryRunner.query(
        `DELETE FROM "product_price_history" WHERE "tenant_id" = $1`,
        [tenantId],
      );
      await queryRunner.query(`DELETE FROM "day_closures" WHERE "tenant_id" = $1`, [
        tenantId,
      ]);
      await queryRunner.query(`DELETE FROM "orders" WHERE "tenant_id" = $1`, [
        tenantId,
      ]);
      await queryRunner.query(`DELETE FROM "customers" WHERE "tenant_id" = $1`, [
        tenantId,
      ]);
      await queryRunner.query(`DELETE FROM "products" WHERE "tenant_id" = $1`, [
        tenantId,
      ]);
      await queryRunner.query(
        `DELETE FROM "tenant_product_categories" WHERE "tenant_id" = $1`,
        [tenantId],
      );
    }

    const placeholders = normalizedTenantIds
      .map((_, index) => `$${index + 1}`)
      .join(', ');

    await queryRunner.query(
      `DELETE FROM "users" WHERE "tenant_id" IN (${placeholders})`,
      normalizedTenantIds,
    );
    await queryRunner.query(
      `DELETE FROM "tenants" WHERE "id" IN (${placeholders})`,
      normalizedTenantIds,
    );

    await queryRunner.commitTransaction();
  } catch (error) {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }

    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[security.e2e] cleanup failed: ${message}`);
  } finally {
    await queryRunner.release();
  }
}

function generateEgyptPhone(seed) {
  const uniqueDigits = `${Date.now()}${Math.floor(Math.random() * 100000)}${seed}`
    .slice(-8)
    .padStart(8, '0');

  return `+2010${uniqueDigits}`;
}
