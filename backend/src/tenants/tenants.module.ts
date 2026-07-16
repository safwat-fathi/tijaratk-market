import { Module } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { StoresDirectoryModule } from 'src/stores-directory/stores-directory.module';
import { DeliveryConfigurationModule } from 'src/delivery-configuration/delivery-configuration.module';

@Module({
  imports: [StoresDirectoryModule, DeliveryConfigurationModule],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
