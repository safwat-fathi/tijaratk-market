import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DeliveryConfigurationService } from './delivery-configuration.service';
import { DeliverySchedulingService } from './delivery-scheduling.service';

@Module({
  imports: [PrismaModule],
  providers: [DeliveryConfigurationService, DeliverySchedulingService],
  exports: [DeliveryConfigurationService, DeliverySchedulingService],
})
export class DeliveryConfigurationModule {}
