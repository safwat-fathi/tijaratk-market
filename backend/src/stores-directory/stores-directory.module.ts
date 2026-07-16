import { Module } from '@nestjs/common';
import { StoresDirectoryController } from './stores-directory.controller';
import { StoresDirectoryService } from './stores-directory.service';
import { DeliveryConfigurationModule } from 'src/delivery-configuration/delivery-configuration.module';

@Module({
  imports: [DeliveryConfigurationModule],
  controllers: [StoresDirectoryController],
  providers: [StoresDirectoryService],
  exports: [StoresDirectoryService],
})
export class StoresDirectoryModule {}
