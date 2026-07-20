import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { AdminAuditContext } from 'src/admin-audit/admin-audit.context';
import {
  getDatabaseTargetFingerprint,
  getRuntimeIdentity,
} from '../utils/runtime-identity.util';

const REQUEST_ID_HEADER = 'x-request-id';

const logger = new Logger('HttpRequest');
const runtimeIdentity = getRuntimeIdentity();
const databaseTargetFingerprint = getDatabaseTargetFingerprint();

/**
 * Adds a request correlation id and logs completion metadata.
 */
export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startedAt = Date.now();
  const incomingRequestId = req.header(REQUEST_ID_HEADER);
  const normalizedRequestId = incomingRequestId?.trim().slice(0, 64);
  const requestId =
    normalizedRequestId && /^[A-Za-z0-9._:-]+$/.test(normalizedRequestId)
      ? normalizedRequestId
      : randomUUID();
  const requestWithId = req as Request & { requestId?: string };
  requestWithId.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  res.on('finish', () => {
    const user = (req as Request & { user?: { tenant_id?: unknown } }).user;
    const tenantId = user?.tenant_id ?? req.header('x-tenant-id') ?? 'none';
    logger.log(
      JSON.stringify({
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        tenantId,
        ...runtimeIdentity,
        databaseTargetFingerprint,
      }),
    );
  });

  AdminAuditContext.run(next);
}
