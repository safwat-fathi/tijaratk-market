import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MerchantDashboardController } from './merchant-dashboard.controller';
import { MerchantDashboardService } from './merchant-dashboard.service';
import { TenantCancellationPolicyModule } from 'src/tenant-cancellation-policy/tenant-cancellation-policy.module';

@Module({
  imports: [PrismaModule, TenantCancellationPolicyModule],
  controllers: [MerchantDashboardController],
  providers: [MerchantDashboardService],
})
export class MerchantDashboardModule {}
