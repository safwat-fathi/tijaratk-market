import {
  AdminAuditEntityType,
  AdminAuditOutcome,
  AdminRole,
  Prisma,
} from '../../generated/prisma/client';

export type AdminAuditActor = {
  id?: number | null;
  name?: string | null;
  role?: AdminRole | null;
};

export type AdminAuditRequestMetadata = {
  requestId?: string | null;
  ipAddress?: string | null;
  managementSessionId?: number | null;
};

export type CreateAdminAuditLogInput = AdminAuditRequestMetadata & {
  actor?: AdminAuditActor | null;
  tenantId?: number | null;
  entityType?: AdminAuditEntityType | null;
  entityId?: number | null;
  action: string;
  title: string;
  outcome: AdminAuditOutcome;
  metadata?: Record<string, unknown> | null;
};

export type AdminAuditTransactionClient = Prisma.TransactionClient;

export type QueryAdminAuditLogsInput = {
  adminId?: number;
  role?: AdminRole;
  tenantId?: number;
  action?: string;
  outcome?: AdminAuditOutcome;
  from?: Date;
  to?: Date;
  cursor?: number;
  limit?: number;
};
