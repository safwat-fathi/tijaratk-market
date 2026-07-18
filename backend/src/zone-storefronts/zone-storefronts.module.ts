import { Module } from '@nestjs/common';
import { ActivityLogModule } from 'src/activity-log/activity-log.module';
import { AdminManagedModule } from 'src/admin-managed/admin-managed.module';
import { OrdersModule } from 'src/orders/orders.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { OrderDispatchService } from './order-dispatch.service';
import {
  AdminZoneStorefrontsController,
  AssignedOrdersController,
  ManagedZoneDispatchesController,
  ZoneStorefrontsController,
} from './zone-storefronts.controller';
import { ZoneStorefrontNotificationsService } from './zone-storefront-notifications.service';
import { ZoneStorefrontsService } from './zone-storefronts.service';
import { MetaConversionsModule } from 'src/meta-conversions/meta-conversions.module';
import { ZoneCatalogReconciliationService } from './zone-catalog-reconciliation.service';
import { ZoneCatalogReconciliationWorker } from './zone-catalog-reconciliation.worker';
import { PushNotificationsModule } from 'src/push-notifications/push-notifications.module';

/** Encapsulates public zones, control-plane membership, and manual dispatch. */
@Module({
  imports: [
    PrismaModule,
    OrdersModule,
    ActivityLogModule,
    AdminManagedModule,
    MetaConversionsModule,
    PushNotificationsModule,
  ],
  controllers: [
    ZoneStorefrontsController,
    AdminZoneStorefrontsController,
    ManagedZoneDispatchesController,
    AssignedOrdersController,
  ],
  providers: [
    ZoneStorefrontsService,
    OrderDispatchService,
    ZoneStorefrontNotificationsService,
    ZoneCatalogReconciliationService,
    ZoneCatalogReconciliationWorker,
  ],
  exports: [
    ZoneStorefrontsService,
    ZoneCatalogReconciliationService,
    OrderDispatchService,
  ],
})
export class ZoneStorefrontsModule {}
