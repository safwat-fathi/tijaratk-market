import { AdminRole, Prisma } from '../../generated/prisma/client';
import { ActivityEntityType, ActivitySource } from './constants/activity-types';

export type ActivityActor = {
  tenantId?: number | null;
  userId?: number | null;
  adminId?: number | null;
  adminName?: string | null;
  adminRole?: AdminRole | null;
  managementSessionId?: number | null;
  requestId?: string | null;
  ipAddress?: string | null;
  source: ActivitySource;
};

export type CreateActivityLogInput = {
  tenantId?: number | null;
  actorUserId?: number | null;
  actorAdminId?: number | null;
  actorAdminName?: string | null;
  actorAdminRole?: AdminRole | null;
  managementSessionId?: number | null;
  entityType: ActivityEntityType;
  entityId?: number | null;
  action: string;
  title: string;
  description?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  source: ActivitySource;
  requestId?: string | null;
  ipAddress?: string | null;
};

export type ActivityLogTransactionClient = Prisma.TransactionClient;

export type QueryActivityLogsInput = {
  tenantId: number;
  userRole?: string;
  entityType?: ActivityEntityType;
  entityId?: number;
  action?: string;
  cursor?: number;
  limit?: number;
};
