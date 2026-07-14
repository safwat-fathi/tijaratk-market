import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import {
  AdminAuditOutcome,
  AdminRole,
} from '../../../generated/prisma/client';
import { PLATFORM_ADMIN_REQUIRED_KEY } from '../decorators/admin-role.decorator';
import { AdminAuditService } from 'src/admin-audit/admin-audit.service';

@Injectable()
export class AdminAuthGuard extends AuthGuard('admin-jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly adminAuditService: AdminAuditService,
  ) {
    super();
  }

  /** Authenticates an administrator and enforces optional platform-role metadata. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = await super.canActivate(context);
    if (!authenticated) return false;

    const platformAdminRequired = this.reflector.getAllAndOverride<boolean>(
      PLATFORM_ADMIN_REQUIRED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!platformAdminRequired) return true;

    const request = context.switchToHttp().getRequest<
      Parameters<AdminAuditService['recordRequest']>[0]
    >();
    if (request.user?.role !== AdminRole.platform_admin) {
      await this.adminAuditService.recordRequest(
        request,
        AdminAuditOutcome.denied,
        403,
        {
          action: 'admin.platform_role.denied',
          title: 'تم رفض صلاحية مسؤول المنصة',
        },
      );
      throw new ForbiddenException({
        code: 'PLATFORM_ADMIN_REQUIRED',
        message: 'Platform administrator access is required',
      });
    }

    return true;
  }
}
