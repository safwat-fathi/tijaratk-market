import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MerchantDashboardController } from './merchant-dashboard.controller';
import { MerchantDashboardService } from './merchant-dashboard.service';

@Module({
  imports: [PrismaModule],
  controllers: [MerchantDashboardController],
  providers: [MerchantDashboardService],
})
export class MerchantDashboardModule {}
