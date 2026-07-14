import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Request } from 'express';
import {
  AdminAuditEntityType,
  AdminAuditOutcome,
  AdminRole,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { sanitizeActivityPayload } from 'src/activity-log/utils/activity-sanitize.util';
import {
  AdminAuditTransactionClient,
  CreateAdminAuditLogInput,
  QueryAdminAuditLogsInput,
} from './admin-audit.types';
import { AdminAuditContext } from './admin-audit.context';

type AuditedAdminRequest = Request & {
  requestId?: string;
  user?: {
    userId?: number;
    name?: string;
    role?: AdminRole;
  };
  actorContext?: {
    managementSessionId?: number;
    tenantId?: number;
  };
};

/** Persists and reads immutable control-plane administrator audit events. */
@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Stores one audit event using a caller transaction when supplied. */
  async record(
    input: CreateAdminAuditLogInput,
    tx?: AdminAuditTransactionClient,
  ) {
    const db = tx ?? this.prisma;
    const actor = await this.resolveActor(input, db);
    const sanitizedMetadata = sanitizeActivityPayload(input.metadata);

    return db.adminAuditLog.create({
      data: {
        actor_admin_id: actor.id,
        actor_admin_name_snapshot: actor.name,
        actor_admin_role_snapshot: actor.role,
        tenant_id: input.tenantId ?? null,
        management_session_id: input.managementSessionId ?? null,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        action: input.action.slice(0, 96),
        title: input.title.slice(0, 160),
        outcome: input.outcome,
        request_id: input.requestId?.slice(0, 64) ?? null,
        ip_address: input.ipAddress?.slice(0, 64) ?? null,
        metadata:
          sanitizedMetadata === null
            ? undefined
            : (sanitizedMetadata as Prisma.InputJsonValue),
      },
    });
  }

  /** Executes a mutation and its success audit atomically. */
  async runWithSuccessAudit<T>(
    input: Omit<CreateAdminAuditLogInput, 'outcome'>,
    operation: (tx: AdminAuditTransactionClient) => Promise<T>,
  ): Promise<T> {
    const transactionResult = await this.prisma.$transaction(async (tx) => {
      const operationResult = await operation(tx);
      await this.record(
        { ...input, outcome: AdminAuditOutcome.success },
        tx,
      );
      return operationResult;
    });
    AdminAuditContext.markRequestAuditRecorded();
    return transactionResult;
  }

  /** Records a safe request-level audit without persisting request bodies. */
  recordRequest(
    request: AuditedAdminRequest,
    outcome: AdminAuditOutcome,
    statusCode: number,
    override?: Partial<CreateAdminAuditLogInput>,
  ) {
    return this.createRequestAudit(request, outcome, statusCode, override);
  }

  /** Converts safe request metadata into one persisted audit event. */
  private async createRequestAudit(
    request: AuditedAdminRequest,
    outcome: AdminAuditOutcome,
    statusCode: number,
    override?: Partial<CreateAdminAuditLogInput>,
  ) {
    const descriptor = this.describeRequest(request);
    const audit = await this.record({
      actor: override?.actor ?? {
        id: request.user?.userId,
        name: request.user?.name,
        role: request.user?.role,
      },
      tenantId:
        override?.tenantId ??
        request.actorContext?.tenantId ??
        this.resolveTenantId(request),
      managementSessionId:
        override?.managementSessionId ??
        request.actorContext?.managementSessionId,
      entityType: override?.entityType ?? descriptor.entityType,
      entityId: override?.entityId ?? descriptor.entityId,
      action: override?.action ?? descriptor.action,
      title: override?.title ?? descriptor.title,
      outcome,
      requestId: override?.requestId ?? request.requestId,
      ipAddress: override?.ipAddress ?? this.getRequestIp(request),
      metadata: {
        method: request.method,
        route: this.getSafeRoute(request),
        status_code: statusCode,
        params: this.sanitizeParams(request.params),
        ...(override?.metadata ?? {}),
      },
    });
    AdminAuditContext.markRequestAuditRecorded();
    return audit;
  }

  /** Returns a stable cursor-paginated platform audit timeline. */
  async findAll(input: QueryAdminAuditLogsInput) {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const rows = await this.prisma.adminAuditLog.findMany({
      where: {
        actor_admin_id: input.adminId,
        actor_admin_role_snapshot: input.role,
        tenant_id: input.tenantId,
        action: input.action,
        outcome: input.outcome,
        created_at:
          input.from || input.to
            ? { gte: input.from, lte: input.to }
            : undefined,
        ...(input.cursor ? { id: { lt: input.cursor } } : {}),
      },
      select: {
        id: true,
        actor_admin_id: true,
        actor_admin_name_snapshot: true,
        actor_admin_role_snapshot: true,
        tenant_id: true,
        management_session_id: true,
        entity_type: true,
        entity_id: true,
        action: true,
        title: true,
        outcome: true,
        request_id: true,
        ip_address: true,
        metadata: true,
        created_at: true,
        tenant: { select: { id: true, name: true } },
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: items.map((item) => ({
        id: item.id,
        actor: {
          id: item.actor_admin_id,
          name: item.actor_admin_name_snapshot ?? 'غير معروف',
          role: item.actor_admin_role_snapshot,
        },
        tenant: item.tenant,
        management_session_id: item.management_session_id,
        entity_type: item.entity_type,
        entity_id: item.entity_id,
        action: item.action,
        title: item.title,
        outcome: item.outcome,
        request_id: item.request_id,
        ip_address: item.ip_address,
        metadata: item.metadata,
        created_at: item.created_at.toISOString(),
      })),
      next_cursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    };
  }

  /** Returns a non-reversible identifier for unknown login attempts. */
  hashLoginIdentifier(identifier: string): string {
    return createHash('sha256')
      .update(identifier.trim().toLowerCase())
      .digest('hex');
  }

  /** Resolves a complete trusted actor snapshot for persistence. */
  private async resolveActor(
    input: CreateAdminAuditLogInput,
    db: AdminAuditTransactionClient | PrismaService,
  ) {
    const id = input.actor?.id ?? null;
    if (!id) return { id: null, name: null, role: null };

    if (input.actor?.name && input.actor.role) {
      return {
        id,
        name: input.actor.name.slice(0, 160),
        role: input.actor.role,
      };
    }

    const admin = await db.adminUser.findUnique({
      where: { id },
      select: { name: true, role: true },
    });
    return {
      id,
      name: admin?.name ?? null,
      role: admin?.role ?? null,
    };
  }

  /** Derives a safe generic audit descriptor from route metadata. */
  private describeRequest(request: AuditedAdminRequest): {
    action: string;
    title: string;
    entityType: AdminAuditEntityType | null;
    entityId: number | null;
  } {
    const route = this.getSafeRoute(request);
    const method = request.method.toLowerCase();
    const entityType = this.resolveEntityType(route);
    const entityId = this.resolveEntityId(request.params);

    if (route.includes('/management-sessions')) {
      return {
        action:
          method === 'delete'
            ? 'management_session.ended'
            : 'management_session.started',
        title:
          method === 'delete'
            ? 'تم إنهاء جلسة إدارة المتجر'
            : 'تم بدء جلسة إدارة المتجر',
        entityType: AdminAuditEntityType.management_session,
        entityId,
      };
    }

    return {
      action: `admin.${entityType ?? 'operation'}.${method}`,
      title: 'تم تنفيذ إجراء إداري',
      entityType,
      entityId,
    };
  }

  /** Maps known administrator route families to stable entity types. */
  private resolveEntityType(route: string): AdminAuditEntityType | null {
    if (route.includes('/admin-users')) return AdminAuditEntityType.admin;
    if (route.includes('/management-sessions'))
      return AdminAuditEntityType.management_session;
    if (route.includes('/orders')) return AdminAuditEntityType.order;
    if (route.includes('/products')) return AdminAuditEntityType.product;
    if (route.includes('/catalog-items/categories'))
      return AdminAuditEntityType.catalog_category;
    if (
      route.includes('/catalog-items') ||
      route.includes('/supermarket-essentials')
    )
      return AdminAuditEntityType.catalog_item;
    if (route.includes('/imports')) return AdminAuditEntityType.import;
    if (route.includes('/areas')) return AdminAuditEntityType.area;
    if (route.includes('/plans')) return AdminAuditEntityType.subscription;
    if (route.includes('/tenants')) return AdminAuditEntityType.tenant;
    return null;
  }

  /** Extracts the first known positive entity identifier from route params. */
  private resolveEntityId(params: Request['params'] | undefined) {
    if (!params) return null;
    for (const key of [
      'productId',
      'orderId',
      'itemId',
      'adminUserId',
      'categoryId',
      'tenantId',
      'id',
    ]) {
      const value = this.parsePositiveInteger(params[key]);
      if (value) return value;
    }
    return null;
  }

  /** Retains numeric route identifiers while excluding arbitrary input. */
  private sanitizeParams(
    params: Request['params'] | undefined,
  ): Record<string, number> {
    if (!params) return {};
    const sanitizedParams: Record<string, number> = {};

    for (const [key, value] of Object.entries(params)) {
      const parsedValue = this.parsePositiveInteger(value);
      if (parsedValue !== null) sanitizedParams[key] = parsedValue;
    }

    return sanitizedParams;
  }

  /** Returns a query-free, bounded route string for audit metadata. */
  private getSafeRoute(request: Request): string {
    return (request.originalUrl || request.url || request.route?.path)
      .split('?')[0]
      .slice(0, 255);
  }

  /** Resolves tenant context only from trusted route identifiers. */
  private resolveTenantId(request: AuditedAdminRequest): number | null {
    const explicitTenantId = this.parsePositiveInteger(request.params?.tenantId);
    if (explicitTenantId) return explicitTenantId;
    if (this.getSafeRoute(request).includes('/admin/tenants/')) {
      return this.parsePositiveInteger(request.params?.id);
    }
    return null;
  }

  /** Resolves the first proxy-forwarded address or direct request address. */
  private getRequestIp(request: Request): string | undefined {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
    return request.ip;
  }

  /** Parses one positive integer without accepting partial numeric strings. */
  private parsePositiveInteger(value: unknown): number | null {
    if (typeof value === 'string') {
      if (!/^\d+$/.test(value)) return null;
    } else if (typeof value !== 'number') {
      return null;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
}
