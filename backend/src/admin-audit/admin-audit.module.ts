import { Global, Module } from '@nestjs/common';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuthGuard } from 'src/admin/guards/admin-auth.guard';

/** Provides the platform control-plane administrator audit trail. */
@Global()
@Module({
  controllers: [AdminAuditController],
  providers: [AdminAuditService, AdminAuditInterceptor, AdminAuthGuard],
  exports: [AdminAuditService, AdminAuditInterceptor, AdminAuthGuard],
})
export class AdminAuditModule {}
