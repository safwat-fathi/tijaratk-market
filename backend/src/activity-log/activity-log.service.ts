import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { DbTenantContext } from 'src/common/contexts/db-tenant.context';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ActivityLogTransactionClient,
  CreateActivityLogInput,
  QueryActivityLogsInput,
} from './activity-log.types';
import { ActivityEntityTypes } from './constants/activity-types';
import { sanitizeActivityPayload } from './utils/activity-sanitize.util';

const STAFF_VISIBLE_ENTITY_TYPES = [
  ActivityEntityTypes.Order,
  ActivityEntityTypes.Product,
  ActivityEntityTypes.Customer,
] as const;

/**
 * Persists and queries append-only tenant activity records.
 */
@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates one activity log using the supplied transaction or current tenant context.
   */
  async create(
    input: CreateActivityLogInput,
    tx?: ActivityLogTransactionClient,
  ) {
    const db = tx ?? DbTenantContext.getManager() ?? this.prisma;

    return db.activityLog.create({
      data: {
        tenant_id: input.tenantId ?? null,
        actor_user_id: input.actorUserId ?? null,
        actor_admin_id: input.actorAdminId ?? null,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        action: input.action,
        title: input.title,
        description: input.description ?? null,
        old_values: this.toJsonInput(
          sanitizeActivityPayload(input.oldValues),
        ),
        new_values: this.toJsonInput(
          sanitizeActivityPayload(input.newValues),
        ),
        metadata: this.toJsonInput(sanitizeActivityPayload(input.metadata)),
        source: input.source,
      },
    });
  }

  /**
   * Returns tenant activity logs with stable cursor pagination.
   */
  async findTenantLogs(input: QueryActivityLogsInput) {
    const limit = Math.min(input.limit ?? 20, 50);
    const isStaff = input.userRole === 'staff';

    if (
      isStaff &&
      input.entityType &&
      !STAFF_VISIBLE_ENTITY_TYPES.includes(
        input.entityType as (typeof STAFF_VISIBLE_ENTITY_TYPES)[number],
      )
    ) {
      return {
        items: [],
        next_cursor: null,
      };
    }

    const entityTypeFilter = input.entityType
      ? input.entityType
      : isStaff
        ? { in: [...STAFF_VISIBLE_ENTITY_TYPES] }
        : undefined;

    const items = await this.activityClient().findMany({
      where: {
        tenant_id: input.tenantId,
        entity_type: entityTypeFilter,
        entity_id: input.entityId,
        action: input.action,
        ...(input.cursor ? { id: { lt: input.cursor } } : {}),
      },
      include: {
        actor_user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        actor_admin: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { id: 'desc' },
      take: limit,
    });

    const mappedItems = items.map((item) => this.mapActivityLog(item));
    const nextCursor =
      mappedItems.length === limit
        ? mappedItems[mappedItems.length - 1]?.id ?? null
        : null;

    return {
      items: mappedItems,
      next_cursor: nextCursor,
    };
  }

  private activityClient() {
    const manager = DbTenantContext.getManager();
    return manager ? manager.activityLog : this.prisma.activityLog;
  }

  private toJsonInput(value: Record<string, unknown> | null) {
    return value === null ? undefined : (value as Prisma.InputJsonValue);
  }

  private mapActivityLog(item: {
    id: number;
    entity_type: string;
    entity_id: number | null;
    action: string;
    title: string;
    description: string | null;
    old_values: unknown;
    new_values: unknown;
    metadata: unknown;
    source: string;
    created_at: Date;
    actor_user?: { id: number; name: string; role: string } | null;
    actor_admin?: { id: number; name: string } | null;
  }) {
    return {
      id: item.id,
      entity_type: item.entity_type,
      entity_id: item.entity_id,
      action: item.action,
      title: item.title,
      description: item.description,
      old_values: item.old_values,
      new_values: item.new_values,
      metadata: item.metadata,
      source: item.source,
      actor: this.resolveActor(item),
      created_at: item.created_at.toISOString(),
    };
  }

  private resolveActor(item: {
    source: string;
    actor_user?: { id: number; name: string; role: string } | null;
    actor_admin?: { id: number; name: string } | null;
  }) {
    if (item.actor_user) {
      return {
        type: 'user',
        id: item.actor_user.id,
        name: item.actor_user.name,
        role: item.actor_user.role,
      };
    }

    if (item.actor_admin) {
      return {
        type: 'admin',
        id: item.actor_admin.id,
        name: item.actor_admin.name,
      };
    }

    return {
      type: item.source === 'storefront' ? 'customer' : 'system',
      id: null,
      name: item.source === 'storefront' ? 'العميل' : 'النظام',
    };
  }
}
