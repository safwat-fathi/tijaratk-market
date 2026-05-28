import {
  BadRequestException,
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { firstValueFrom, from, Observable } from 'rxjs';
import { DbTenantContext } from '../contexts/db-tenant.context';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '../../../generated/prisma/client';

/**
 * Starts a request transaction, sets app.tenant_id, and binds a manager so RLS
 * policies are enforced consistently across all repository calls in the request.
 */
@Injectable()
export class TenantRlsInterceptor implements NestInterceptor {
  private static readonly NO_TENANT_CONTEXT = 0;
  private static readonly RESERVED_PUBLIC_ORDER_PATHS = new Set([
    'day-close',
    'tracking',
  ]);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Wraps tenant-scoped routes in a request transaction with tenant session config.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    if (!this.requiresTenantRls(req.path)) {
      return next.handle();
    }

    return from(this.runWithTenantContext(req, next));
  }

  /**
   * Runs request with a tenant-scoped Prisma transaction.
   */
  private async runWithTenantContext(
    req: Request,
    next: CallHandler,
  ): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      const tenantId = await this.resolveTenantId(req, tx);

      if (tenantId === TenantRlsInterceptor.NO_TENANT_CONTEXT) {
        return firstValueFrom<unknown>(next.handle());
      }

      if (!tenantId) {
        throw new UnauthorizedException('Tenant context is required');
      }

      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenantId)}, true)`;

      return DbTenantContext.run({ tenantId, manager: tx }, async () =>
        firstValueFrom<unknown>(next.handle()),
      );
    });
  }

  /**
   * Resolves tenant from auth/header/public slug/token routes.
   */
  private async resolveTenantId(
    req: Request,
    tx: Prisma.TransactionClient,
  ): Promise<number | null> {
    const userTenant = this.extractUserTenantId(req);
    if (userTenant) {
      return userTenant;
    }

    const headerTenant = this.parseTenantId(req.headers['x-tenant-id']);
    if (headerTenant) {
      return headerTenant;
    }

    const parts = this.getPathParts(req.path);

    if (this.isProductsPublicSlugRoute(parts)) {
      const slug = parts[2];
      return this.resolveTenantIdBySlug(slug, tx);
    }

    if (this.isAvailabilityRequestsPublicSlugRoute(parts)) {
      const slug = parts[2];
      return this.resolveTenantIdBySlug(slug, tx);
    }

    if (this.isCustomersPublicSlugRoute(parts)) {
      const slug = parts[2];
      return this.resolveTenantIdBySlug(slug, tx);
    }

    if (this.isOrdersPublicCreateRoute(req.method, parts)) {
      return this.resolveTenantIdBySlug(parts[1], tx);
    }

    if (this.isOrdersTrackingRoute(parts)) {
      const token = parts[2];
      if (!token) {
        throw new BadRequestException('Tracking token is required');
      }

      return this.resolveTenantIdByOrderToken(token, tx);
    }

    if (this.isOrdersTrackingBatchRoute(parts)) {
      const tokens = this.extractTrackingTokens(req);
      if (tokens.length === 0) {
        return TenantRlsInterceptor.NO_TENANT_CONTEXT;
      }

      return this.resolveTenantIdByTrackingTokens(req, tokens, tx);
    }

    return null;
  }

  /**
   * Returns true for route prefixes where tenant RLS context is required.
   */
  private requiresTenantRls(path: string): boolean {
    return (
      path.startsWith('/products') ||
      path.startsWith('/orders') ||
      path.startsWith('/customers') ||
      path.startsWith('/availability-requests')
    );
  }

  /**
   * Extracts tenant id from authenticated request user payload.
   */
  private extractUserTenantId(req: Request): number | null {
    const tenantId = this.parseTenantId(
      (req as Request & { user?: { tenant_id?: unknown } }).user?.tenant_id,
    );
    return tenantId ?? null;
  }

  /**
   * Parses tenant id and validates positive integer format.
   */
  private parseTenantId(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }

    return null;
  }

  /**
   * Splits request path into non-empty parts for route matching.
   */
  private getPathParts(path: string): string[] {
    return path
      .split('/')
      .filter(Boolean)
      .map((segment) => this.safeDecodePathSegment(segment));
  }

  /**
   * Safely decodes URL-encoded path segments without throwing on malformed input.
   */
  private safeDecodePathSegment(segment: string): string {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  }

  /**
   * Returns true for /products/public/:slug routes.
   */
  private isProductsPublicSlugRoute(parts: string[]): boolean {
    return (
      parts.length >= 3 && parts[0] === 'products' && parts[1] === 'public'
    );
  }

  /**
   * Returns true for /availability-requests/public/:slug routes.
   */
  private isAvailabilityRequestsPublicSlugRoute(parts: string[]): boolean {
    return (
      parts.length >= 3 &&
      parts[0] === 'availability-requests' &&
      parts[1] === 'public'
    );
  }

  /**
   * Returns true for /customers/public/:slug routes.
   */
  private isCustomersPublicSlugRoute(parts: string[]): boolean {
    return (
      parts.length >= 3 && parts[0] === 'customers' && parts[1] === 'public'
    );
  }

  /**
   * Returns true for public order create route: POST /orders/:tenant_slug.
   */
  private isOrdersPublicCreateRoute(method: string, parts: string[]): boolean {
    if (method.toUpperCase() !== 'POST') {
      return false;
    }

    if (parts.length !== 2 || parts[0] !== 'orders') {
      return false;
    }

    return !TenantRlsInterceptor.RESERVED_PUBLIC_ORDER_PATHS.has(parts[1]);
  }

  /**
   * Returns true for single-token tracking routes under /orders/tracking/:token.
   */
  private isOrdersTrackingRoute(parts: string[]): boolean {
    return (
      parts.length >= 3 && parts[0] === 'orders' && parts[1] === 'tracking'
    );
  }

  /**
   * Returns true for batch tracking route /orders/tracking.
   */
  private isOrdersTrackingBatchRoute(parts: string[]): boolean {
    return (
      parts.length === 2 && parts[0] === 'orders' && parts[1] === 'tracking'
    );
  }

  /**
   * Resolves tenant from public tenant slug.
   */
  private async resolveTenantIdBySlug(
    slug: string,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const normalizedSlug = this.safeDecodePathSegment(slug);
    const rows = await tx.$queryRaw<
      { tenant_id: number }[]
    >`SELECT app.resolve_tenant_id_by_slug(${normalizedSlug})::int AS tenant_id`;

    const tenantId = this.parseTenantId(rows?.[0]?.tenant_id);
    if (!tenantId) {
      throw new NotFoundException(
        `Tenant with slug ${normalizedSlug} not found`,
      );
    }

    return tenantId;
  }

  /**
   * Resolves tenant from a public tracking token.
   */
  private async resolveTenantIdByOrderToken(
    token: string,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const rows = await tx.$queryRaw<
      { tenant_id: number }[]
    >`SELECT app.resolve_tenant_id_by_order_token(${token})::int AS tenant_id`;

    const tenantId = this.parseTenantId(rows?.[0]?.tenant_id);
    if (!tenantId) {
      throw new NotFoundException(`Order with token ${token} not found`);
    }

    return tenantId;
  }

  /**
   * Resolves and validates one tenant for all requested tracking tokens.
   */
  private async resolveTenantIdByTrackingTokens(
    req: Request,
    tokens: string[],
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    let resolvedTenant: number | null = null;
    const validTokens: string[] = [];

    for (const token of tokens) {
      const tenantId = await this.tryResolveTenantIdByOrderToken(token, tx);
      if (!tenantId) {
        continue;
      }

      validTokens.push(token);
      if (!resolvedTenant) {
        resolvedTenant = tenantId;
        continue;
      }

      if (tenantId !== resolvedTenant) {
        throw new BadRequestException(
          'Tracking tokens must belong to the same tenant',
        );
      }
    }

    if (!resolvedTenant) {
      this.setTrackingTokens(req, []);
      return TenantRlsInterceptor.NO_TENANT_CONTEXT;
    }

    if (validTokens.length !== tokens.length) {
      this.setTrackingTokens(req, validTokens);
    }

    return resolvedTenant;
  }

  /**
   * Extracts tracking tokens from token/token[] query params.
   */
  private extractTrackingTokens(req: Request): string[] {
    const values = [req.query.token, req.query['token[]']];
    const flattened = values.flatMap((value) => {
      if (Array.isArray(value)) {
        return value;
      }

      return typeof value === 'string' ? [value] : [];
    });

    const normalized = flattened
      .filter((token): token is string => typeof token === 'string')
      .map((token) => this.safeDecodePathSegment(token.trim()))
      .filter((token) => token.length > 0);

    return Array.from(new Set(normalized));
  }

  /**
   * Tries resolving tenant id from tracking token without throwing for misses.
   */
  private async tryResolveTenantIdByOrderToken(
    token: string,
    tx: Prisma.TransactionClient,
  ): Promise<number | null> {
    const rows = await tx.$queryRaw<
      { tenant_id: number }[]
    >`SELECT app.resolve_tenant_id_by_order_token(${token})::int AS tenant_id`;

    const tenantId = this.parseTenantId(rows?.[0]?.tenant_id);
    return tenantId ?? null;
  }

  /**
   * Rewrites tracking query params to the normalized token list.
   */
  private setTrackingTokens(req: Request, tokens: string[]): void {
    const query = req.query as Record<string, unknown>;
    query.token = tokens;
    delete query['token[]'];
  }
}
