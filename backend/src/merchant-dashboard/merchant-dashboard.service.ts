import { Injectable } from '@nestjs/common';
import { DbTenantContext } from 'src/common/contexts/db-tenant.context';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  OrderSource,
  OrderStatus,
  Prisma,
} from '../../generated/prisma/client';
import { DashboardPeriod } from './dto/get-dashboard-measurements.dto';
import {
  CancellationPolicySnapshot,
  TenantCancellationPolicyService,
} from 'src/tenant-cancellation-policy/tenant-cancellation-policy.service';

type SourceKey =
  | 'qr_code'
  | 'stores_directory'
  | 'whatsapp'
  | 'manual'
  | 'storefront';

type TopSellingProduct = {
  name: string;
  orders_count: number;
};

type OrdersBySourceItem = {
  source: SourceKey;
  label: string;
  orders_count: number;
  percentage: number;
};

type MetricWithDelta = {
  value: number;
  previous_value: number;
  change_percentage: number | null;
};

export type MerchantDashboardMeasurements = {
  period: DashboardPeriod;
  period_start: string;
  period_end: string;
  total_orders: MetricWithDelta;
  completed_orders_rate: {
    percentage: number;
    completed_orders: number;
    total_orders: number;
  };
  cancelled_orders_rate: {
    percentage: number;
    cancelled_orders: number;
    total_orders: number;
  };
  total_sales: MetricWithDelta;
  average_order_value: number;
  new_customers: number;
  returning_customers_rate: {
    percentage: number;
    returning_customers: number;
    active_customers: number;
  };
  top_selling_products: TopSellingProduct[];
  availability_requests: number;
  orders_by_source: OrdersBySourceItem[];
  cancellation_policy: CancellationPolicySnapshot;
};

type PeriodRange = {
  period: DashboardPeriod;
  days: number;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  startDateKey: string;
  endDateKey: string;
};

type OrderForMetrics = {
  id: number;
  status: OrderStatus;
  total: Prisma.Decimal | number | string | null;
  order_source: OrderSource;
  source_metadata: Prisma.JsonValue | null;
  customer_id: number;
  order_items: Array<{
    name_snapshot: string;
    quantity: string;
    selection_quantity: Prisma.Decimal | number | string | null;
  }>;
};

@Injectable()
export class MerchantDashboardService {
  private static readonly CAIRO_TIME_ZONE = 'Africa/Cairo';
  private static readonly SOURCE_LABELS: Record<SourceKey, string> = {
    qr_code: 'QR Code',
    stores_directory: 'Stores Directory',
    whatsapp: 'WhatsApp',
    manual: 'Manual',
    storefront: 'Storefront',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCancellationPolicyService: TenantCancellationPolicyService,
  ) {}

  async getMeasurements(
    tenantId: number,
    requestedPeriod: DashboardPeriod = 'today',
  ): Promise<MerchantDashboardMeasurements> {
    const range = this.buildPeriodRange(requestedPeriod);
    const orderWhere = this.buildOrderWhere(tenantId, range.start, range.end);
    const previousOrderWhere = this.buildOrderWhere(
      tenantId,
      range.previousStart,
      range.previousEnd,
    );
    const db = this.getDb();

    const [
      orders,
      previousSummary,
      newCustomers,
      activeCustomerIds,
      returningCustomers,
      availabilityRequests,
      tenant,
    ] = await Promise.all([
      db.order.findMany({
        where: orderWhere,
        select: {
          id: true,
          status: true,
          total: true,
          order_source: true,
          source_metadata: true,
          customer_id: true,
          order_items: {
            select: {
              name_snapshot: true,
              quantity: true,
              selection_quantity: true,
            },
          },
        },
      }),
      this.getPreviousOrderSummary(previousOrderWhere, db),
      db.customer.count({
        where: {
          tenant_id: tenantId,
          deleted_at: null,
          first_order_at: {
            gte: range.start,
            lte: range.end,
          },
        },
      }),
      db.order.findMany({
        where: {
          ...orderWhere,
          status: OrderStatus.completed,
        },
        distinct: ['customer_id'],
        select: { customer_id: true },
      }),
      db.customer.count({
        where: {
          tenant_id: tenantId,
          deleted_at: null,
          completed_order_count: { gt: 1 },
          orders: {
            some: {
              created_at: { gte: range.start, lte: range.end },
              status: OrderStatus.completed,
              deleted_at: null,
            },
          },
        },
      }),
      db.availabilityRequest.count({
        where: {
          tenant_id: tenantId,
          request_date: {
            gte: this.dateKeyToDate(range.startDateKey),
            lte: this.dateKeyToDate(range.endDateKey),
          },
        },
      }),
      db.tenant.findUnique({
        where: { id: tenantId },
        select: { status: true },
      }),
    ]);

    const currentSummary = this.summarizeOrders(orders);
    const activeCustomers = activeCustomerIds.length;
    const cancellationPolicy =
      await this.tenantCancellationPolicyService.getSnapshot(
        tenantId,
        tenant?.status,
        db,
      );

    return {
      period: range.period,
      period_start: range.start.toISOString(),
      period_end: range.end.toISOString(),
      total_orders: {
        value: currentSummary.totalOrders,
        previous_value: previousSummary.totalOrders,
        change_percentage: this.calculateChangePercentage(
          currentSummary.totalOrders,
          previousSummary.totalOrders,
        ),
      },
      completed_orders_rate: {
        percentage: this.calculateRate(
          currentSummary.completedOrders,
          currentSummary.totalOrders,
        ),
        completed_orders: currentSummary.completedOrders,
        total_orders: currentSummary.totalOrders,
      },
      cancelled_orders_rate: {
        percentage: this.calculateRate(
          currentSummary.cancelledOrders,
          currentSummary.totalOrders,
        ),
        cancelled_orders: currentSummary.cancelledOrders,
        total_orders: currentSummary.totalOrders,
      },
      total_sales: {
        value: currentSummary.totalSales,
        previous_value: previousSummary.totalSales,
        change_percentage: this.calculateChangePercentage(
          currentSummary.totalSales,
          previousSummary.totalSales,
        ),
      },
      average_order_value:
        currentSummary.completedOrders > 0
          ? this.roundMetric(
              currentSummary.totalSales / currentSummary.completedOrders,
            )
          : 0,
      new_customers: newCustomers,
      returning_customers_rate: {
        percentage: this.calculateRate(returningCustomers, activeCustomers),
        returning_customers: returningCustomers,
        active_customers: activeCustomers,
      },
      top_selling_products: this.buildTopSellingProducts(orders),
      availability_requests: availabilityRequests,
      orders_by_source: this.buildOrdersBySource(orders),
      cancellation_policy: cancellationPolicy,
    };
  }

  private async getPreviousOrderSummary(
    where: Prisma.OrderWhereInput,
    db: Prisma.TransactionClient | PrismaService,
  ) {
    const [totalOrders, completedOrders, cancelledOrders, salesAggregate] =
      await Promise.all([
        db.order.count({ where }),
        db.order.count({
          where: { ...where, status: OrderStatus.completed },
        }),
        db.order.count({
          where: {
            ...where,
            status: {
              in: [OrderStatus.cancelled, OrderStatus.rejected_by_customer],
            },
          },
        }),
        db.order.aggregate({
          where: { ...where, status: OrderStatus.completed },
          _sum: { total: true },
        }),
      ]);

    return {
      totalOrders,
      completedOrders,
      cancelledOrders,
      totalSales: this.toNumber(salesAggregate._sum.total),
    };
  }

  private getDb(): Prisma.TransactionClient | PrismaService {
    return DbTenantContext.getManager() ?? this.prisma;
  }

  private buildOrderWhere(
    tenantId: number,
    start: Date,
    end: Date,
  ): Prisma.OrderWhereInput {
    return {
      tenant_id: tenantId,
      deleted_at: null,
      created_at: {
        gte: start,
        lte: end,
      },
    };
  }

  private summarizeOrders(orders: OrderForMetrics[]) {
    return orders.reduce(
      (summary, order) => {
        summary.totalOrders += 1;

        if (order.status === OrderStatus.completed) {
          summary.completedOrders += 1;
          summary.totalSales += this.toNumber(order.total);
        }

        if (
          order.status === OrderStatus.cancelled ||
          order.status === OrderStatus.rejected_by_customer
        ) {
          summary.cancelledOrders += 1;
        }

        return summary;
      },
      {
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        totalSales: 0,
      },
    );
  }

  private buildTopSellingProducts(
    orders: OrderForMetrics[],
  ): TopSellingProduct[] {
    const productsMap = new Map<string, number>();

    for (const order of orders) {
      if (order.status !== OrderStatus.completed) continue;

      for (const item of order.order_items) {
        const name = item.name_snapshot.trim();
        if (!name) continue;

        const quantity = this.resolveOrderItemQuantity(item);
        productsMap.set(name, (productsMap.get(name) ?? 0) + quantity);
      }
    }

    return Array.from(productsMap.entries())
      .map(([name, orders_count]) => ({
        name,
        orders_count: this.roundMetric(orders_count),
      }))
      .sort((left, right) => {
        if (right.orders_count !== left.orders_count) {
          return right.orders_count - left.orders_count;
        }

        return left.name.localeCompare(right.name, 'ar-EG');
      })
      .slice(0, 5);
  }

  private buildOrdersBySource(orders: OrderForMetrics[]): OrdersBySourceItem[] {
    const counts: Record<SourceKey, number> = {
      qr_code: 0,
      stores_directory: 0,
      whatsapp: 0,
      manual: 0,
      storefront: 0,
    };

    for (const order of orders) {
      counts[this.resolveSourceKey(order)] += 1;
    }

    return (Object.keys(counts) as SourceKey[])
      .filter((source) => counts[source] > 0)
      .map((source) => ({
        source,
        label: MerchantDashboardService.SOURCE_LABELS[source],
        orders_count: counts[source],
        percentage: this.calculateRate(counts[source], orders.length),
      }));
  }

  private resolveSourceKey(order: OrderForMetrics): SourceKey {
    if (
      order.order_source === OrderSource.storefront &&
      this.readLandingSource(order.source_metadata) === 'qr'
    ) {
      return 'qr_code';
    }

    if (order.order_source === OrderSource.directory) {
      return 'stores_directory';
    }

    if (order.order_source === OrderSource.whatsapp) {
      return 'whatsapp';
    }

    if (order.order_source === OrderSource.manual) {
      return 'manual';
    }

    return 'storefront';
  }

  private readLandingSource(metadata: Prisma.JsonValue | null): string | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return null;
    }

    const value = metadata.landingSource;
    return typeof value === 'string' ? value : null;
  }

  private resolveOrderItemQuantity(
    item: OrderForMetrics['order_items'][number],
  ): number {
    const selectionQuantity = this.toNumber(item.selection_quantity);
    if (selectionQuantity > 0) {
      return selectionQuantity;
    }

    const quantity = Number(item.quantity);
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  }

  private buildPeriodRange(period: DashboardPeriod): PeriodRange {
    const days = this.resolvePeriodDays(period);
    const endDateKey = this.getCairoDateKey();
    const startDateKey = this.shiftDateKey(endDateKey, days - 1);
    const previousEndDateKey = this.shiftDateKey(startDateKey, 1);
    const previousStartDateKey = this.shiftDateKey(
      previousEndDateKey,
      days - 1,
    );

    return {
      period,
      days,
      start: this.cairoDayStart(startDateKey),
      end: this.cairoDayEnd(endDateKey),
      previousStart: this.cairoDayStart(previousStartDateKey),
      previousEnd: this.cairoDayEnd(previousEndDateKey),
      startDateKey,
      endDateKey,
    };
  }

  private resolvePeriodDays(period: DashboardPeriod): number {
    if (period === '30d') {
      return 30;
    }

    if (period === '7d') {
      return 7;
    }

    return 1;
  }

  private getCairoDateKey(date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: MerchantDashboardService.CAIRO_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) {
      throw new Error('Failed to resolve Cairo date key');
    }

    return `${year}-${month}-${day}`;
  }

  private shiftDateKey(dateKey: string, subtractDays: number): string {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() - subtractDays);
    return date.toISOString().slice(0, 10);
  }

  private cairoDayStart(dateKey: string): Date {
    return this.cairoDateTimeToUtc(dateKey, 0, 0, 0, 0);
  }

  private cairoDayEnd(dateKey: string): Date {
    return this.cairoDateTimeToUtc(dateKey, 23, 59, 59, 999);
  }

  private dateKeyToDate(dateKey: string): Date {
    return new Date(`${dateKey}T00:00:00.000Z`);
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
      timeZone: MerchantDashboardService.CAIRO_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);

    const readPart = (type: Intl.DateTimeFormatPartTypes) => {
      const value = Number(parts.find((part) => part.type === type)?.value);
      if (!Number.isFinite(value)) {
        throw new Error(`Failed to resolve Cairo ${type}`);
      }

      return value;
    };

    return {
      year: readPart('year'),
      month: readPart('month'),
      day: readPart('day'),
      hour: readPart('hour'),
      minute: readPart('minute'),
      second: readPart('second'),
    };
  }

  private calculateRate(numerator: number, denominator: number): number {
    if (denominator <= 0) {
      return 0;
    }

    return this.roundMetric((numerator / denominator) * 100);
  }

  private calculateChangePercentage(
    current: number,
    previous: number,
  ): number | null {
    if (previous <= 0) {
      return current > 0 ? null : 0;
    }

    return this.roundMetric(((current - previous) / previous) * 100);
  }

  private roundMetric(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value * 100) / 100;
  }

  private toNumber(value: Prisma.Decimal | number | string | null | undefined) {
    if (value === null || value === undefined) {
      return 0;
    }

    return Number(value);
  }
}
