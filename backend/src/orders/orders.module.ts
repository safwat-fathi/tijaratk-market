import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CustomersModule } from 'src/customers/customers.module';
import { TenantsModule } from 'src/tenants/tenants.module';
import { OrderWhatsappService } from './order-whatsapp.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule, CustomersModule, TenantsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderWhatsappService],
  exports: [OrdersService],
})
export class OrdersModule {}
