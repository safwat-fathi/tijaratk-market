import { ActivityActor } from 'src/activity-log/activity-log.types';
import { AdminManagedPermission } from './constants/admin-managed-permissions';
import { Request } from 'express';

export type AdminActorContext = ActivityActor & {
  actorType: 'admin_user';
  actorId: number;
  tenantId: number;
  managementSessionId: number;
  permissions: AdminManagedPermission[];
};

export type AuthenticatedAdmin = {
  userId: number;
  phone: string;
  name: string;
  role: 'platform_admin' | 'operations_admin';
};

export type ManagedAdminRequest = Request & {
  user?: AuthenticatedAdmin;
  actorContext?: AdminActorContext;
  requestId?: string;
};

export type ManagedFeature = 'product_write' | 'order_write' | 'bulk_write';
