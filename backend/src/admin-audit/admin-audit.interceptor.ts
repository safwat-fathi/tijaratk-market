import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  catchError,
  concatMap,
  from,
  map,
  Observable,
  of,
  throwError,
} from 'rxjs';
import { AdminAuditOutcome } from '../../generated/prisma/client';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuditContext } from './admin-audit.context';

type RequestWithAdmin = Request & {
  requestId?: string;
  user?: { userId?: number; name?: string; role?: string };
};

/** Audits successful administrator writes and downstream authorization denials. */
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AdminAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const response = context.switchToHttp().getResponse<Response>();
    if (!this.shouldAudit(request)) return next.handle();

    return next.handle().pipe(
      concatMap((data) => {
        if (
          AdminAuditContext.hasTenantActivityRecord() ||
          AdminAuditContext.hasRequestAuditRecord()
        ) {
          return of(data);
        }
        return from(
          this.auditService.recordRequest(
            request as Parameters<AdminAuditService['recordRequest']>[0],
            AdminAuditOutcome.success,
            response.statusCode,
          ),
        ).pipe(map(() => data));
      }),
      catchError((error: unknown) => {
        const statusCode =
          error instanceof HttpException ? error.getStatus() : undefined;
        if (statusCode !== 401 && statusCode !== 403) {
          return throwError(() => error);
        }
        if (AdminAuditContext.hasRequestAuditRecord()) {
          return throwError(() => error);
        }
        const responseBody =
          error instanceof HttpException ? error.getResponse() : null;
        const denialCode =
          typeof responseBody === 'object' &&
          responseBody !== null &&
          'code' in responseBody &&
          typeof responseBody.code === 'string'
            ? responseBody.code
            : undefined;

        return from(
          this.auditService.recordRequest(
            request as Parameters<AdminAuditService['recordRequest']>[0],
            AdminAuditOutcome.denied,
            statusCode,
            {
              action: 'admin.authorization.denied',
              title: 'تم رفض إجراء إداري',
              metadata: { denial_code: denialCode },
            },
          ),
        ).pipe(concatMap(() => throwError(() => error)));
      }),
    );
  }

  /** Determines whether a request is an authenticated administrator mutation. */
  private shouldAudit(request: RequestWithAdmin): boolean {
    const path = (request.originalUrl || request.url).split('?')[0];
    const isAdminRoute = path === '/admin' || path.startsWith('/admin/');
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
      request.method.toUpperCase(),
    );

    return (
      isAdminRoute &&
      isMutation &&
      path !== '/admin/login' &&
      Boolean(request.user?.userId)
    );
  }
}
