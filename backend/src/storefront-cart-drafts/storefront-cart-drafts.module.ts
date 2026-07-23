import { Module } from '@nestjs/common';
import { MetaConversionsModule } from 'src/meta-conversions/meta-conversions.module';
import { OrdersModule } from 'src/orders/orders.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TenantsModule } from 'src/tenants/tenants.module';
import { StorefrontCartDraftsCleanupWorker } from './storefront-cart-drafts-cleanup.worker';
import { StorefrontCartDraftsController } from './storefront-cart-drafts.controller';
import { StorefrontCartDraftsService } from './storefront-cart-drafts.service';
import { GoogleAnalyticsModule } from 'src/google-analytics/google-analytics.module';

/** Anonymous merchant-cart persistence and checkout boundary. */
@Module({
  imports: [
    PrismaModule,
    TenantsModule,
    OrdersModule,
    MetaConversionsModule,
    GoogleAnalyticsModule,
  ],
  controllers: [StorefrontCartDraftsController],
  providers: [StorefrontCartDraftsService, StorefrontCartDraftsCleanupWorker],
})
export class StorefrontCartDraftsModule {}
