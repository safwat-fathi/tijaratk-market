import { Injectable } from '@nestjs/common';
import {
  Prisma,
  TenantCancellationPolicyActorType,
  TenantCancellationPolicyEventType,
  TenantCancellationPolicyState,
  TenantStatus,
} from '../../generated/prisma/client';
import { DbTenantContext } from 'src/common/contexts/db-tenant.context';
import { PrismaService } from 'src/prisma/prisma.service';

type DbClient = Prisma.TransactionClient | PrismaService;

export type CancellationPolicyDashboardStatus = 'ok' | 'warning' | 'suspended';

export type CancellationPolicySnapshot = {
  status: CancellationPolicyDashboardStatus;
  count: number;
  warning_threshold: number;
  suspension_threshold: number;
  remaining_before_suspension: number;
  window_start: string;
  window_end: string;
  is_probation: boolean;
  last_warning_at: string | null;
  last_suspension_at: string | null;
};

export type CancellationPolicyAdminSummary = CancellationPolicySnapshot & {
  last_event_type: TenantCancellationPolicyEventType | null;
  last_event_at: string | null;
  last_suspension_policy: boolean;
};

@Injectable()
export class TenantCancellationPolicyService {
  private static readonly CAIRO_TIME_ZONE = 'Africa/Cairo';
  private static readonly WARNING_THRESHOLD = 10;
  private static readonly NORMAL_SUSPENSION_THRESHOLD = 16;
  private static readonly PROBATION_SUSPENSION_THRESHOLD = 5;

  constructor(private readonly prisma: PrismaService) {}

  async recordMerchantCancellation(
    tenantId: number,
    orderId: number,
    manager?: Prisma.TransactionClient,
  ): Promise<TenantCancellationPolicyState> {
    const db = manager ?? this.getDb();
    const now = new Date();
    const window = this.getCurrentCalendarMonthWindow(now);
    const currentState = await db.tenantCancellationPolicyState.findUnique({
      where: { tenant_id: tenantId },
    });
    const baseState = await this.ensureActiveWindowState(
      db,
      tenantId,
      currentState,
      window,
      now,
    );

    const nextCount = baseState.cancellation_count + 1;
    const suspensionThreshold = baseState.is_probation
      ? TenantCancellationPolicyService.PROBATION_SUSPENSION_THRESHOLD
      : TenantCancellationPolicyService.NORMAL_SUSPENSION_THRESHOLD;

    const updatedState = await db.tenantCancellationPolicyState.update({
      where: { tenant_id: tenantId },
      data: {
        cancellation_count: nextCount,
        warning_threshold: TenantCancellationPolicyService.WARNING_THRESHOLD,
        suspension_threshold: suspensionThreshold,
        updated_at: now,
      },
    });

    await db.tenantCancellationPolicyEvent.create({
      data: {
        tenant_id: tenantId,
        order_id: orderId,
        event_type:
          TenantCancellationPolicyEventType.merchant_order_cancelled,
        actor_type: TenantCancellationPolicyActorType.merchant,
        cancellation_count: nextCount,
        threshold: suspensionThreshold,
        window_start: updatedState.window_start,
        window_end: updatedState.window_end,
      },
    });

    if (
      nextCount === TenantCancellationPolicyService.WARNING_THRESHOLD &&
      !updatedState.last_warning_at
    ) {
      await db.tenantCancellationPolicyEvent.create({
        data: {
          tenant_id: tenantId,
          event_type: TenantCancellationPolicyEventType.warning_issued,
          actor_type: TenantCancellationPolicyActorType.system,
          cancellation_count: nextCount,
          threshold: TenantCancellationPolicyService.WARNING_THRESHOLD,
          window_start: updatedState.window_start,
          window_end: updatedState.window_end,
        },
      });

      await db.tenantCancellationPolicyState.update({
        where: { tenant_id: tenantId },
        data: { last_warning_at: now, updated_at: now },
      });
    }

    if (nextCount >= suspensionThreshold) {
      await db.tenant.update({
        where: { id: tenantId },
        data: { status: TenantStatus.suspended },
      });

      const suspensionEvent = await db.tenantCancellationPolicyEvent.create({
        data: {
          tenant_id: tenantId,
          order_id: orderId,
          event_type: TenantCancellationPolicyEventType.auto_suspended,
          actor_type: TenantCancellationPolicyActorType.system,
          cancellation_count: nextCount,
          threshold: suspensionThreshold,
          window_start: updatedState.window_start,
          window_end: updatedState.window_end,
          metadata: {
            is_probation: updatedState.is_probation,
          },
        },
      });

      return db.tenantCancellationPolicyState.update({
        where: { tenant_id: tenantId },
        data: {
          last_suspension_at: now,
          last_suspension_event_id: suspensionEvent.id,
          last_suspension_policy: true,
          updated_at: now,
        },
      });
    }

    return db.tenantCancellationPolicyState.findUniqueOrThrow({
      where: { tenant_id: tenantId },
    });
  }

  async recordAdminStatusChange(
    tenantId: number,
    previousStatus: TenantStatus,
    nextStatus: TenantStatus,
    manager?: Prisma.TransactionClient,
  ): Promise<void> {
    if (previousStatus === nextStatus) {
      return;
    }

    if (previousStatus === TenantStatus.suspended && nextStatus === TenantStatus.active) {
      const db = manager ?? this.getDb();
      const now = new Date();
      const state = await db.tenantCancellationPolicyState.findUnique({
        where: { tenant_id: tenantId },
      });

      await db.tenantCancellationPolicyEvent.create({
        data: {
          tenant_id: tenantId,
          event_type: TenantCancellationPolicyEventType.admin_reactivated,
          actor_type: TenantCancellationPolicyActorType.admin,
          cancellation_count: state?.cancellation_count,
          threshold: state?.suspension_threshold,
          window_start: state?.window_start,
          window_end: state?.window_end,
          metadata: {
            previous_status: previousStatus,
            next_status: nextStatus,
            starts_probation: state?.last_suspension_policy === true,
          },
        },
      });

      if (state?.last_suspension_policy === true) {
        const window = this.getProbationWindow(now);
        await db.tenantCancellationPolicyState.upsert({
          where: { tenant_id: tenantId },
          create: {
            tenant_id: tenantId,
            window_start: window.start,
            window_end: window.end,
            cancellation_count: 0,
            warning_threshold: TenantCancellationPolicyService.WARNING_THRESHOLD,
            suspension_threshold:
              TenantCancellationPolicyService.PROBATION_SUSPENSION_THRESHOLD,
            is_probation: true,
            last_suspension_policy: false,
          },
          update: {
            window_start: window.start,
            window_end: window.end,
            cancellation_count: 0,
            warning_threshold: TenantCancellationPolicyService.WARNING_THRESHOLD,
            suspension_threshold:
              TenantCancellationPolicyService.PROBATION_SUSPENSION_THRESHOLD,
            is_probation: true,
            last_warning_at: null,
            last_suspension_policy: false,
            updated_at: now,
          },
        });
      }
    }

    if (nextStatus === TenantStatus.suspended) {
      const db = manager ?? this.getDb();
      await db.tenantCancellationPolicyState.updateMany({
        where: { tenant_id: tenantId },
        data: {
          last_suspension_policy: false,
          updated_at: new Date(),
        },
      });
    }
  }

  async getSnapshot(
    tenantId: number,
    tenantStatus?: TenantStatus,
    manager?: Prisma.TransactionClient,
  ): Promise<CancellationPolicySnapshot> {
    const db = manager ?? this.getDb();
    const now = new Date();
    const window = this.getCurrentCalendarMonthWindow(now);
    const state = await this.ensureActiveWindowState(
      db,
      tenantId,
      await db.tenantCancellationPolicyState.findUnique({
        where: { tenant_id: tenantId },
      }),
      window,
      now,
    );

    return this.mapSnapshot(state, tenantStatus);
  }

  async getAdminSummary(
    tenantId: number,
    tenantStatus?: TenantStatus,
    manager?: Prisma.TransactionClient,
  ): Promise<CancellationPolicyAdminSummary> {
    const db = manager ?? this.getDb();
    const snapshot = await this.getSnapshot(tenantId, tenantStatus, manager);
    const state = await db.tenantCancellationPolicyState.findUnique({
      where: { tenant_id: tenantId },
    });
    const lastEvent = await db.tenantCancellationPolicyEvent.findFirst({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
      select: { event_type: true, created_at: true },
    });

    return {
      ...snapshot,
      last_event_type: lastEvent?.event_type ?? null,
      last_event_at: lastEvent?.created_at.toISOString() ?? null,
      last_suspension_policy: state?.last_suspension_policy ?? false,
    };
  }

  private async ensureActiveWindowState(
    db: DbClient,
    tenantId: number,
    state: TenantCancellationPolicyState | null,
    window: { start: Date; end: Date },
    now: Date,
  ): Promise<TenantCancellationPolicyState> {
    if (state && state.window_start <= now && state.window_end >= now) {
      return state;
    }

    const isProbation = state?.is_probation === true;
    const suspensionThreshold = isProbation
      ? TenantCancellationPolicyService.PROBATION_SUSPENSION_THRESHOLD
      : TenantCancellationPolicyService.NORMAL_SUSPENSION_THRESHOLD;

    return db.tenantCancellationPolicyState.upsert({
      where: { tenant_id: tenantId },
      create: {
        tenant_id: tenantId,
        window_start: window.start,
        window_end: window.end,
        cancellation_count: 0,
        warning_threshold: TenantCancellationPolicyService.WARNING_THRESHOLD,
        suspension_threshold: suspensionThreshold,
        is_probation: isProbation,
      },
      update: {
        window_start: window.start,
        window_end: window.end,
        cancellation_count: 0,
        warning_threshold: TenantCancellationPolicyService.WARNING_THRESHOLD,
        suspension_threshold: suspensionThreshold,
        is_probation: isProbation,
        last_warning_at: null,
        updated_at: now,
      },
    });
  }

  private mapSnapshot(
    state: TenantCancellationPolicyState,
    tenantStatus?: TenantStatus,
  ): CancellationPolicySnapshot {
    const count = state.cancellation_count;
    const suspensionThreshold = state.suspension_threshold;
    let status: 'suspended' | 'warning' | 'ok';
    if (tenantStatus === TenantStatus.suspended && state.last_suspension_policy) {
      status = 'suspended';
    } else if (count >= state.warning_threshold) {
      status = 'warning';
    } else {
      status = 'ok';
    }

    return {
      status,
      count,
      warning_threshold: state.warning_threshold,
      suspension_threshold: suspensionThreshold,
      remaining_before_suspension: Math.max(0, suspensionThreshold - count),
      window_start: state.window_start.toISOString(),
      window_end: state.window_end.toISOString(),
      is_probation: state.is_probation,
      last_warning_at: state.last_warning_at?.toISOString() ?? null,
      last_suspension_at: state.last_suspension_at?.toISOString() ?? null,
    };
  }

  private getCurrentCalendarMonthWindow(date: Date) {
    const { year, month } = this.getCairoDateParts(date);
    const startKey = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthYear = month === 12 ? year + 1 : year;
    const nextStartKey = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`;
    const start = this.cairoDateTimeToUtc(startKey, 0, 0, 0, 0);
    const nextStart = this.cairoDateTimeToUtc(nextStartKey, 0, 0, 0, 0);
    return { start, end: new Date(nextStart.getTime() - 1) };
  }

  private getProbationWindow(date: Date) {
    const startKey = this.getCairoDateKey(date);
    const start = this.cairoDateTimeToUtc(startKey, 0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCFullYear(end.getUTCFullYear() + 100);
    return { start, end };
  }

  private getCairoDateKey(date: Date): string {
    const { year, month, day } = this.getCairoDateParts(date);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private getCairoDateParts(date: Date) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TenantCancellationPolicyService.CAIRO_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    return {
      year: this.readIntlPart(parts, 'year'),
      month: this.readIntlPart(parts, 'month'),
      day: this.readIntlPart(parts, 'day'),
    };
  }

  private cairoDateTimeToUtc(
    dateKey: string,
    hour: number,
    minute: number,
    second: number,
    millisecond: number,
  ): Date {
    const [year, month, day] = dateKey.split('-').map(Number);
    let timestamp = Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second,
      millisecond,
    );

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const cairoParts = this.getCairoDateTimeParts(new Date(timestamp));
      const targetWallTime = Date.UTC(
        year,
        month - 1,
        day,
        hour,
        minute,
        second,
      );
      const actualWallTime = Date.UTC(
        cairoParts.year,
        cairoParts.month - 1,
        cairoParts.day,
        cairoParts.hour,
        cairoParts.minute,
        cairoParts.second,
      );
      const diff = targetWallTime - actualWallTime;

      if (diff === 0) {
        break;
      }

      timestamp += diff;
    }

    return new Date(timestamp);
  }

  private getCairoDateTimeParts(date: Date) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TenantCancellationPolicyService.CAIRO_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);

    return {
      year: this.readIntlPart(parts, 'year'),
      month: this.readIntlPart(parts, 'month'),
      day: this.readIntlPart(parts, 'day'),
      hour: this.readIntlPart(parts, 'hour'),
      minute: this.readIntlPart(parts, 'minute'),
      second: this.readIntlPart(parts, 'second'),
    };
  }

  private readIntlPart(
    parts: Intl.DateTimeFormatPart[],
    type: Intl.DateTimeFormatPartTypes,
  ): number {
    const value = Number(parts.find((part) => part.type === type)?.value);
    if (!Number.isFinite(value)) {
      throw new Error(`Failed to resolve Cairo ${type}`);
    }

    return value;
  }

  private getDb(): DbClient {
    return DbTenantContext.getManager() ?? this.prisma;
  }
}
