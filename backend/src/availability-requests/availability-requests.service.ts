import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DbTenantContext } from 'src/common/contexts/db-tenant.context';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { Prisma } from '../../generated/prisma/client';
import { CreateAvailabilityRequestDto } from './dto/create-availability-request.dto';

type CreateAvailabilityRequestResult = {
  status: 'created' | 'already_requested_today';
  requested_at: Date;
  product_id: number;
};

type AvailabilityTopProduct = {
  product_id: number;
  product_name: string;
  requests_count: number;
  last_requested_at: Date;
};

type MerchantAvailabilitySummary = {
  today_total_requests: number;
  top_products: AvailabilityTopProduct[];
};

@Injectable()
export class AvailabilityRequestsService {
  private static readonly CAIRO_TIME_ZONE = 'Africa/Cairo';

  constructor(private readonly prisma: PrismaService) {}

  async createPublicBySlug(
    slug: string,
    dto: CreateAvailabilityRequestDto,
  ): Promise<CreateAvailabilityRequestResult> {
    const normalizedSlug = slug.trim();
    if (!normalizedSlug) {
      throw new BadRequestException('Tenant slug is required');
    }

    const visitorKey = this.normalizeVisitorKey(dto.visitor_key);
    const productId = dto.product_id;

    const product = await this.getPrismaClient().product.findFirst({
      where: {
        id: productId,
        status: ProductStatus.ACTIVE,
        tenant: {
          slug: normalizedSlug,
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.is_available) {
      throw new BadRequestException('Product is currently available');
    }

    const requestDate = this.getCairoDateKey();

    try {
      const saved = await this.getPrismaClient().availabilityRequest.create({
        data: {
          tenant_id: product.tenant_id,
          product_id: product.id,
          visitor_key: visitorKey,
          request_date: requestDate,
        },
      });

      return {
        status: 'created',
        requested_at: saved.created_at,
        product_id: saved.product_id,
      };
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      const existing =
        await this.getPrismaClient().availabilityRequest.findFirst({
          where: {
            tenant_id: product.tenant_id,
            product_id: product.id,
            visitor_key: visitorKey,
            request_date: requestDate,
          },
          orderBy: {
            created_at: 'desc',
          },
        });

      return {
        status: 'already_requested_today',
        requested_at: existing?.created_at ?? new Date(),
        product_id: product.id,
      };
    }
  }

  async getMerchantSummary(
    tenantId: number,
    days = 1,
    limit = 5,
  ): Promise<MerchantAvailabilitySummary> {
    const normalizedDays = this.normalizeDays(days);
    const normalizedLimit = this.normalizeLimit(limit);

    const todayDate = this.getCairoDateKey();
    const fromDate = this.shiftDateKey(todayDate, normalizedDays - 1);

    const totalRequests =
      await this.getPrismaClient().availabilityRequest.count({
        where: {
          tenant_id: tenantId,
          request_date: todayDate,
        },
      });

    const topGroups = await this.getPrismaClient().availabilityRequest.groupBy({
      by: ['product_id'],
      _count: {
        id: true,
      },
      _max: {
        created_at: true,
      },
      where: {
        tenant_id: tenantId,
        request_date: {
          gte: fromDate,
          lte: todayDate,
        },
      },
      orderBy: [
        {
          _count: {
            id: 'desc',
          },
        },
        {
          _max: {
            created_at: 'desc',
          },
        },
      ],
      take: normalizedLimit,
    });

    const productIds = topGroups.map((g) => g.product_id);
    const products = await this.getPrismaClient().product.findMany({
      where: {
        id: { in: productIds },
      },
      select: { id: true, name: true },
    });

    const productsMap = new Map(products.map((p) => [p.id, p.name]));

    const top_products = topGroups.map((group) => ({
      product_id: group.product_id,
      product_name: productsMap.get(group.product_id) || 'Unknown Product',
      requests_count: group._count.id,
      last_requested_at: group._max.created_at ?? new Date(),
    }));

    return {
      today_total_requests: totalRequests,
      top_products,
    };
  }

  private normalizeVisitorKey(visitorKey: string): string {
    const normalized = visitorKey.trim();
    if (!normalized) {
      throw new BadRequestException('visitor_key is required');
    }

    return normalized;
  }

  private normalizeDays(days: number): number {
    if (!Number.isFinite(days)) {
      return 1;
    }

    return Math.min(30, Math.max(1, Math.trunc(days)));
  }

  private normalizeLimit(limit: number): number {
    if (!Number.isFinite(limit)) {
      return 5;
    }

    return Math.min(20, Math.max(1, Math.trunc(limit)));
  }

  private shiftDateKey(dateKey: string, subtractDays: number): string {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() - Math.max(0, subtractDays));

    const nextYear = String(date.getUTCFullYear());
    const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
    const nextDay = String(date.getUTCDate()).padStart(2, '0');

    return `${nextYear}-${nextMonth}-${nextDay}`;
  }

  private getCairoDateKey(date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: AvailabilityRequestsService.CAIRO_TIME_ZONE,
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

  private isUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    return 'code' in error && error.code === 'P2002';
  }

  private getPrismaClient() {
    const manager = DbTenantContext.getManager() as Prisma.TransactionClient;
    return manager || this.prisma;
  }
}
