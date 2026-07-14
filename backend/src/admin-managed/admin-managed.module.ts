import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ProductsModule } from 'src/products/products.module';
import { OrdersModule } from 'src/orders/orders.module';
import { ActivityLogModule } from 'src/activity-log/activity-log.module';
import { AdminManagedAccessController } from './admin-managed-access.controller';
import { AdminManagementSessionController } from './admin-management-session.controller';
import { AdminManagedProductsController } from './admin-managed-products.controller';
import { AdminManagedOrdersController } from './admin-managed-orders.controller';
import { AdminManagedActivityController } from './admin-managed-activity.controller';
import { AdminManagedAccessService } from './admin-managed-access.service';
import { AdminManagedFeatureService } from './admin-managed-feature.service';
import { ManagedTenantGuard } from './guards/managed-tenant.guard';

/** Encapsulates revocable administrator access to merchant-scoped operations. */
@Module({
  imports: [PrismaModule, ProductsModule, OrdersModule, ActivityLogModule],
  controllers: [
    AdminManagedAccessController,
    AdminManagementSessionController,
    AdminManagedProductsController,
    AdminManagedOrdersController,
    AdminManagedActivityController,
  ],
  providers: [
    AdminManagedAccessService,
    AdminManagedFeatureService,
    ManagedTenantGuard,
  ],
  exports: [AdminManagedAccessService, ManagedTenantGuard],
})
export class AdminManagedModule {}
