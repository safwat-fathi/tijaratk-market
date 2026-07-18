import { Module } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health/health.controller';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { TenantsModule } from './tenants/tenants.module';
import { ProductsModule } from './products/products.module';
import { CustomersModule } from './customers/customers.module';
import { OrdersModule } from './orders/orders.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { TenantRlsInterceptor } from './common/interceptors/tenant-rls.interceptor';
import { AvailabilityRequestsModule } from './availability-requests/availability-requests.module';
import { PrismaModule } from './prisma/prisma.module';
import { AdminModule } from './admin/admin.module';
import { ImportsModule } from './imports/imports.module';
import { StoresDirectoryModule } from './stores-directory/stores-directory.module';
import { MerchantDashboardModule } from './merchant-dashboard/merchant-dashboard.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { AdminAuditModule } from './admin-audit/admin-audit.module';
import { ZoneStorefrontsModule } from './zone-storefronts/zone-storefronts.module';
import { PushNotificationsModule } from './push-notifications/push-notifications.module';

const ENV = process.env.NODE_ENV;

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV ? `.env.${ENV}` : '.env',
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 3600, // Default TTL is 1 hour
    }),
    PrismaModule,
    AdminAuditModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60, // 1 minute
        limit: 10, // 10 requests
      },
    ]),
    UsersModule,
    AuthModule,
    WhatsappModule,
    TenantsModule,
    ProductsModule,
    CustomersModule,
    OrdersModule,
    AvailabilityRequestsModule,
    WebhooksModule,
    AdminModule,
    ImportsModule,
    StoresDirectoryModule,
    MerchantDashboardModule,
    ActivityLogModule,
    ZoneStorefrontsModule,
    PushNotificationsModule,
  ],
  controllers: [HealthController],
  providers: [TenantRlsInterceptor],
})
export class AppModule {}
