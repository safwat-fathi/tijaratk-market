import './instrument';
import { NestFactory } from '@nestjs/core';
import { NestInterceptor, ValidationPipe } from '@nestjs/common';
import { NextFunction, Request, Response, urlencoded } from 'express';
import { AppModule } from './app.module';
import CONSTANTS from './common/constants';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.transform';
import { AllExceptionFilter } from './common/filters/all-exception.filter';
import { TenantRlsInterceptor } from './common/interceptors/tenant-rls.interceptor';
import { validationExceptionFactory } from './common/utils/validation-exception.factory';
import { requestLoggingMiddleware } from './common/middlewares/request-logging.middleware';
import { AdminAuditInterceptor } from './admin-audit/admin-audit.interceptor';

const parseBooleanEnv = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalFilters(new AllExceptionFilter());
  app.use(requestLoggingMiddleware);

  // Remove COOP header to fix Swagger UI issues
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.removeHeader('Cross-Origin-Opener-Policy');
    next();
  });

  // remove header x-powered-by
  app.use((_: Request, res: Response, next: NextFunction) => {
    res.removeHeader('X-Powered-By');
    next();
  });

  // helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable CSP for Swagger UI
      crossOriginEmbedderPolicy: false, // Required for Swagger UI
      crossOriginResourcePolicy: false, // Allow cross-origin resource loading
    }),
  );

  // cookies
  app.use(cookieParser());

  // urlencoded
  app.use(urlencoded({ extended: true }));

  // cors
  const configuredCorsOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const corsOrigin = configuredCorsOrigins?.length
    ? configuredCorsOrigins
    : process.env.NODE_ENV === 'development';

  app.enableCors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Tenant-Id',
      'X-Request-Id',
      'X-Storefront-Cart-Token',
    ],
  });

  app.useStaticAssets(join(process.cwd(), 'public'));
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  app.use('/docs', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  const swaggerEnabled = parseBooleanEnv(
    process.env.ENABLE_SWAGGER,
    process.env.NODE_ENV === 'development',
  );

  if (swaggerEnabled) {
    // Swagger docs
    const options = new DocumentBuilder()
      .setTitle('Tijaratk API')
      .setDescription('Tijaratk API documentation')
      .setVersion('1.0')
      .setExternalDoc('API Documentation', '/docs')
      .setContact('Tijaratk', 'https://www.tijaratk.com', 'help@tijaratk.com')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Enter JWT token **_only_**',
          in: 'header',
        },
        CONSTANTS.ACCESS_TOKEN, // This name should match the name in @ApiBearerAuth() decorator in your controller
      );

    if (process.env.NODE_ENV === 'development') {
      options.addServer(process.env.APP_URL, 'Local environment');
    } else {
      options.addServer(process.env.APP_URL, 'Production environment');
    }

    const config = options.build();
    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs/json',
      swaggerOptions: {
        persistAuthorization: true,
      },
      customSiteTitle: 'Tijaratk API docs - ' + process.env.NODE_ENV,
      customfavIcon: '/favicon.ico',
    });
  }

  // Global Pipe for validation
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

  // Global Interceptor for success responses
  const tenantRlsInterceptor = app.get(TenantRlsInterceptor);
  const adminAuditInterceptor = app.get(AdminAuditInterceptor);
  const interceptors: NestInterceptor[] = [
    tenantRlsInterceptor,
    adminAuditInterceptor,
    new ResponseTransformInterceptor(),
  ];
  app.useGlobalInterceptors(...interceptors);

  await app.listen(process.env.HTTP_SERVER_PORT, '127.0.0.1');
}
void bootstrap();
