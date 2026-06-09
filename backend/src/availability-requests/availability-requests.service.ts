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
import { GetAvailabilityRequests } from './dto/get-availability-requests/get-availability-requests';

type CreateAvailabilityRequestResult = {
  status: 'created' | 'already_requested_today';
  requested_at: Date;
  product_id: number | null;
  requested_product_name: string | null;
};

type AvailabilityTopProduct = {
  item_key: string;
  product_id: number | null;
  product_name: string;
  requests_count: number;
  last_requested_at: Date;
};

type AvailabilityRequestListItem = {
  id: number;
  item_name: string;
  product_id: number | null;
  requested_product_name: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_notes: string | null;
  requested_at: Date;
  request_date: Date;
  visitor_key: string;
};

type MerchantAvailabilityRequestsPage = {
  data: AvailabilityRequestListItem[];
  meta: {
    total: number;
    page: number;
    last_page: number;
    limit: number;
  };
};

type AvailabilityRequestCustomerSnapshot = Pick<
  Prisma.AvailabilityRequestUncheckedCreateInput,
  'customer_name' | 'customer_phone' | 'customer_address' | 'customer_notes'
>;

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
    const customerSnapshot = this.buildCustomerSnapshot(dto);
    const productId = dto.product_id;
    const requestedProductName = this.normalizeRequestedProductName(
      dto.requested_product_name,
    );

    if (productId && requestedProductName) {
      throw new BadRequestException(
        'Provide product_id or requested_product_name, not both',
      );
    }

    if (!productId && !requestedProductName) {
      throw new BadRequestException(
        'product_id or requested_product_name is required',
      );
    }

    if (requestedProductName) {
      return this.createCustomRequestBySlug(
        normalizedSlug,
        visitorKey,
        requestedProductName,
        customerSnapshot,
      );
    }

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
    const requestDateValue = this.dateKeyToDate(requestDate);

    try {
      const saved = await this.getPrismaClient().availabilityRequest.create({
        data: {
          tenant_id: product.tenant_id,
          product_id: product.id,
          visitor_key: visitorKey,
          request_date: requestDateValue,
          ...customerSnapshot,
        },
      });

      return {
        status: 'created',
        requested_at: saved.created_at,
        product_id: saved.product_id,
        requested_product_name: saved.requested_product_name,
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
            request_date: requestDateValue,
          },
          orderBy: {
            created_at: 'desc',
          },
        });

      return {
        status: 'already_requested_today',
        requested_at: existing?.created_at ?? new Date(),
        product_id: product.id,
        requested_product_name: null,
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

    const todayDateKey = this.getCairoDateKey();
    const fromDateKey = this.shiftDateKey(todayDateKey, normalizedDays - 1);
    const todayDate = this.dateKeyToDate(todayDateKey);
    const fromDate = this.dateKeyToDate(fromDateKey);

    const totalRequests =
      await this.getPrismaClient().availabilityRequest.count({
        where: {
          tenant_id: tenantId,
          request_date: todayDate,
        },
      });

    const topProductGroups =
      await this.getPrismaClient().availabilityRequest.groupBy({
        by: ['product_id'],
        _count: {
          id: true,
        },
        _max: {
          created_at: true,
        },
        where: {
          tenant_id: tenantId,
          product_id: {
            not: null,
          },
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

    const topCustomGroups =
      await this.getPrismaClient().availabilityRequest.groupBy({
        by: ['requested_product_key', 'requested_product_name'],
        _count: {
          id: true,
        },
        _max: {
          created_at: true,
        },
        where: {
          tenant_id: tenantId,
          product_id: null,
          requested_product_key: {
            not: null,
          },
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

    const productIds = topProductGroups
      .map((g) => g.product_id)
      .filter((id): id is number => id !== null);
    const products = await this.getPrismaClient().product.findMany({
      where: {
        id: { in: productIds },
      },
      select: { id: true, name: true },
    });

    const productsMap = new Map(products.map((p) => [p.id, p.name]));

    const top_products = [
      ...topProductGroups.map((group) => ({
        item_key: `product:${group.product_id}`,
        product_id: group.product_id,
        product_name:
          (group.product_id && productsMap.get(group.product_id)) ||
          'Unknown Product',
        requests_count: group._count.id,
        last_requested_at: group._max.created_at ?? new Date(),
      })),
      ...topCustomGroups.map((group) => ({
        item_key: `custom:${group.requested_product_key}`,
        product_id: null,
        product_name: group.requested_product_name || 'طلب منتج غير مسمى',
        requests_count: group._count.id,
        last_requested_at: group._max.created_at ?? new Date(),
      })),
    ]
      .sort((left, right) => {
        if (right.requests_count !== left.requests_count) {
          return right.requests_count - left.requests_count;
        }

        return (
          right.last_requested_at.getTime() - left.last_requested_at.getTime()
        );
      })
      .slice(0, normalizedLimit);

    return {
      today_total_requests: totalRequests,
      top_products,
    };
  }

  /** Lists availability requests for the merchant with filters and sorting. */
  async getMerchantRequests(
    tenantId: number,
    query: GetAvailabilityRequests,
  ): Promise<MerchantAvailabilityRequestsPage> {
    const page = this.normalizePage(query.page);
    const limit = this.normalizePageLimit(query.limit);
    const sortBy = query.sort_by || 'date';
    const sortOrder = query.sort_order || 'desc';
    const itemName = query.item_name?.trim();

    const where: Prisma.AvailabilityRequestWhereInput = {
      tenant_id: tenantId,
    };

    if (query.date) {
      where.request_date = this.dateKeyToDate(query.date);
    }

    if (itemName) {
      where.OR = [
        {
          requested_product_name: {
            contains: itemName,
            mode: 'insensitive',
          },
        },
        {
          product: {
            name: {
              contains: itemName,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    const requests = await this.getPrismaClient().availabilityRequest.findMany({
      where,
      include: {
        product: {
          select: {
            name: true,
          },
        },
      },
      orderBy:
        sortBy === 'date' ? { created_at: sortOrder } : { created_at: 'desc' },
    });

    const mapped = requests.map((request) => {
      const itemNameValue =
        request.requested_product_name ||
        request.product?.name ||
        'منتج غير معروف';

      return {
        id: request.id,
        item_name: itemNameValue,
        product_id: request.product_id,
        requested_product_name: request.requested_product_name,
        customer_name: request.customer_name,
        customer_phone: request.customer_phone,
        customer_address: request.customer_address,
        customer_notes: request.customer_notes,
        requested_at: request.created_at,
        request_date: request.request_date,
        visitor_key: request.visitor_key,
      };
    });

    if (sortBy === 'name') {
      mapped.sort((left, right) => {
        const comparison = left.item_name.localeCompare(
          right.item_name,
          'ar-EG',
        );
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    const total = mapped.length;
    const lastPage = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;

    return {
      data: mapped.slice(start, start + limit),
      meta: {
        total,
        page,
        last_page: lastPage,
        limit,
      },
    };
  }

  /** Creates an availability request for an item that is not in the product list. */
  private async createCustomRequestBySlug(
    slug: string,
    visitorKey: string,
    requestedProductName: string,
    customerSnapshot: AvailabilityRequestCustomerSnapshot,
  ): Promise<CreateAvailabilityRequestResult> {
    const tenant = await this.getPrismaClient().tenant.findFirst({
      where: {
        slug,
        deleted_at: null,
      },
      select: {
        id: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const requestDate = this.getCairoDateKey();
    const requestDateValue = this.dateKeyToDate(requestDate);
    const requestedProductKey =
      this.buildRequestedProductKey(requestedProductName);

    try {
      const saved = await this.getPrismaClient().availabilityRequest.create({
        data: {
          tenant_id: tenant.id,
          product_id: null,
          visitor_key: visitorKey,
          request_date: requestDateValue,
          requested_product_name: requestedProductName,
          requested_product_key: requestedProductKey,
          ...customerSnapshot,
        },
      });

      return {
        status: 'created',
        requested_at: saved.created_at,
        product_id: null,
        requested_product_name: saved.requested_product_name,
      };
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      const existing =
        await this.getPrismaClient().availabilityRequest.findFirst({
          where: {
            tenant_id: tenant.id,
            product_id: null,
            visitor_key: visitorKey,
            request_date: requestDateValue,
            requested_product_key: requestedProductKey,
          },
          orderBy: {
            created_at: 'desc',
          },
        });

      return {
        status: 'already_requested_today',
        requested_at: existing?.created_at ?? new Date(),
        product_id: null,
        requested_product_name: requestedProductName,
      };
    }
  }

  private normalizeVisitorKey(visitorKey: string): string {
    const normalized = visitorKey.trim();
    if (!normalized) {
      throw new BadRequestException('visitor_key is required');
    }

    return normalized;
  }

  private buildCustomerSnapshot(
    dto: CreateAvailabilityRequestDto,
  ): AvailabilityRequestCustomerSnapshot {
    return {
      customer_name: this.normalizeOptionalText(dto.customer_name, 120),
      customer_phone: this.normalizeOptionalText(dto.customer_phone, 32),
      customer_address: this.normalizeOptionalText(dto.customer_address, 500),
      customer_notes: this.normalizeOptionalText(dto.customer_notes, 500),
    };
  }

  private normalizeOptionalText(value: string | undefined, maxLength: number) {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().replace(/\s+/g, ' ');
    return normalized ? normalized.slice(0, maxLength) : undefined;
  }

  /** Normalizes client-entered product names while preserving display text. */
  private normalizeRequestedProductName(value?: string): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim().replace(/\s+/g, ' ');
  }

  /** Builds the stable dedupe key for custom availability requests. */
  private buildRequestedProductKey(value: string): string {
    const normalized =
      this.normalizeRequestedProductName(value).toLocaleLowerCase('ar-EG');

    if (!normalized) {
      throw new BadRequestException('requested_product_name is required');
    }

    if (normalized.length > 120) {
      throw new BadRequestException('requested_product_name is too long');
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

  private normalizePage(page?: number): number {
    if (!page || !Number.isFinite(page)) {
      return 1;
    }

    return Math.max(1, Math.trunc(page));
  }

  private normalizePageLimit(limit?: number): number {
    if (!limit || !Number.isFinite(limit)) {
      return 20;
    }

    return Math.min(100, Math.max(1, Math.trunc(limit)));
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

  private dateKeyToDate(dateKey: string): Date {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
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
