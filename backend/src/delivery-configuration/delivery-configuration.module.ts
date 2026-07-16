import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DeliveryConfigurationService } from './delivery-configuration.service';

@Module({
  imports: [PrismaModule],
  providers: [DeliveryConfigurationService],
  exports: [DeliveryConfigurationService],
})
export class DeliveryConfigurationModule {}
