import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CustomersModule } from 'src/customers/customers.module';
import { TenantsModule } from 'src/tenants/tenants.module';
import { OrderWhatsappService } from './order-whatsapp.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TenantCancellationPolicyModule } from 'src/tenant-cancellation-policy/tenant-cancellation-policy.module';
import { ActivityLogModule } from 'src/activity-log/activity-log.module';
import { MetaConversionsModule } from 'src/meta-conversions/meta-conversions.module';
import { DeliveryConfigurationModule } from 'src/delivery-configuration/delivery-configuration.module';

@Module({
  imports: [
    PrismaModule,
    CustomersModule,
    TenantsModule,
    TenantCancellationPolicyModule,
    ActivityLogModule,
    MetaConversionsModule,
    DeliveryConfigurationModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderWhatsappService],
  exports: [OrdersService],
})
export class OrdersModule {}
