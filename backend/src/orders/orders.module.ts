import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CustomersModule } from 'src/customers/customers.module';
import { TenantsModule } from 'src/tenants/tenants.module';
import { OrderWhatsappService } from './order-whatsapp.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TenantCancellationPolicyModule } from 'src/tenant-cancellation-policy/tenant-cancellation-policy.module';
import { ActivityLogModule } from 'src/activity-log/activity-log.module';

@Module({
  imports: [
    PrismaModule,
    CustomersModule,
    TenantsModule,
    TenantCancellationPolicyModule,
    ActivityLogModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderWhatsappService],
  exports: [OrdersService],
})
export class OrdersModule {}
