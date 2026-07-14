import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminManagedAccessService } from '../admin-managed-access.service';
import { ManagedAdminRequest } from '../admin-managed.types';
import {
  MANAGED_FEATURE_KEY,
  MANAGED_PERMISSIONS_KEY,
} from '../decorators/managed-policy.decorator';
import { AdminManagedPermission } from '../constants/admin-managed-permissions';
import { ManagedFeature } from '../admin-managed.types';
import { AdminAuditService } from 'src/admin-audit/admin-audit.service';
import { AdminAuditOutcome } from '../../../generated/prisma/client';

/** Validates route tenant, session, assignment, feature flag, and permissions. */
@Injectable()
export class ManagedTenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessService: AdminManagedAccessService,
    private readonly adminAuditService: AdminAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ManagedAdminRequest>();
    const tenantId = Number(request.params?.tenantId);
    const permissions =
      this.reflector.getAllAndOverride<AdminManagedPermission[]>(
        MANAGED_PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];
    const feature = this.reflector.getAllAndOverride<ManagedFeature>(
      MANAGED_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    try {
      request.actorContext = await this.accessService.resolveActor(
        request,
        tenantId,
        permissions,
        feature,
      );
      return true;
    } catch (error) {
      const statusCode =
        error instanceof HttpException ? error.getStatus() : undefined;
      if (statusCode === 401 || statusCode === 403) {
        const response = error.getResponse();
        const details =
          typeof response === 'object' && response !== null ? response : {};
        await this.adminAuditService.recordRequest(
          request,
          AdminAuditOutcome.denied,
          statusCode,
          {
            tenantId,
            action: 'admin.managed_access.denied',
            title: 'تم رفض إجراء إدارة متجر',
            metadata: {
              denial_code:
                'code' in details && typeof details.code === 'string'
                  ? details.code
                  : undefined,
              required_permissions: permissions,
              missing_permissions:
                'missing_permissions' in details &&
                Array.isArray(details.missing_permissions)
                  ? details.missing_permissions
                  : undefined,
            },
          },
        );
      }
      throw error;
    }
  }
}
