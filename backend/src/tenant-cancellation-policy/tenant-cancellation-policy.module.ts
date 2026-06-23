import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TenantCancellationPolicyService } from './tenant-cancellation-policy.service';

@Module({
  imports: [PrismaModule],
  providers: [TenantCancellationPolicyService],
  exports: [TenantCancellationPolicyService],
})
export class TenantCancellationPolicyModule {}
