import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminLoginDto } from './dto/admin-login.dto';
import { Prisma, TenantStatus } from '../../generated/prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: AdminLoginDto) {
    const adminUser = await this.prisma.adminUser.findUnique({
      where: { phone: loginDto.phone },
    });

    if (!adminUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(loginDto.password, adminUser.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: adminUser.id,
      phone: adminUser.phone,
      role: 'admin',
    };

    return {
      admin_access_token: this.jwtService.sign(payload),
      user: {
        id: adminUser.id,
        phone: adminUser.phone,
        name: adminUser.name,
        role: 'admin',
      },
    };
  }

  private async runWithTenantRls<T>(
    tenantId: number,
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenantId)}, true)`;
      return callback(tx);
    });
  }

  private getPagination(page = 1, limit = 20) {
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit =
      Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20;

    return {
      page: safePage,
      limit: safeLimit,
      offset: (safePage - 1) * safeLimit,
      prefetch: safePage * safeLimit,
    };
  }

  private paginateItems<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
    offset: number,
  ) {
    return {
      data: items.slice(offset, offset + limit),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  // Dashboard Stats
  async getDashboardStats() {
    const [tenants, activeMerchants, totalPlans] = await Promise.all([
      this.prisma.tenant.findMany({
        select: { id: true },
      }),
      this.prisma.tenant.count({
        where: { status: TenantStatus.active },
      }),
      this.prisma.subscriptionPlan.count(),
    ]);

    const orderCounts = await Promise.all(
      tenants.map((tenant) =>
        this.runWithTenantRls(tenant.id, (tx) =>
          tx.order.count({
            where: { tenant_id: tenant.id },
          }),
        ),
      ),
    );

    return {
      totalMerchants: tenants.length,
      activeMerchants,
      totalOrders: orderCounts.reduce((total, count) => total + count, 0),
      totalPlans,
    };
  }

  // Tenants Management
  async getTenants() {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        directory_profile: {
          include: { area: true },
        },
        tenant_delivery_areas: {
          where: { is_active: true, deleted_at: null },
          include: { area: true },
          orderBy: [{ area: { sort_order: 'asc' } }, { area: { name_ar: 'asc' } }],
        },
        tenant_subscriptions: {
          where: { is_active: true },
          include: { plan: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return Promise.all(
      tenants.map(async (tenant) => {
        const [orders, customers, products] = await this.runWithTenantRls(
          tenant.id,
          (tx) =>
            Promise.all([
              tx.order.count({ where: { tenant_id: tenant.id } }),
              tx.customer.count({ where: { tenant_id: tenant.id } }),
              tx.product.count({ where: { tenant_id: tenant.id } }),
            ]),
        );

        return {
          ...tenant,
          _count: {
            orders,
            customers,
            products,
          },
        };
      }),
    );
  }

  async updateTenantStatus(id: number, status: TenantStatus) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return this.prisma.tenant.update({
      where: { id },
      data: { status },
    });
  }

  async updateTenantPlan(tenantId: number, planId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    // Deactivate current active subscription
    await this.prisma.tenantSubscription.updateMany({
      where: { tenant_id: tenantId, is_active: true },
      data: { is_active: false, end_date: new Date() },
    });

    // Create new subscription
    return this.prisma.tenantSubscription.create({
      data: {
        tenant_id: tenantId,
        plan_id: planId,
        start_date: new Date(),
        is_active: true,
      },
    });
  }

  // Plans Management
  async getPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
    });
  }

  async togglePlanStatus(id: number, is_active: boolean) {
    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: { is_active },
    });
  }

  // Products Management
  async getProducts(
    tenantName?: string,
    productName?: string,
    page = 1,
    limit = 20,
  ) {
    const pagination = this.getPagination(page, limit);
    const tenants = await this.prisma.tenant.findMany({
      where: tenantName
        ? { name: { contains: tenantName, mode: 'insensitive' } }
        : undefined,
      orderBy: { created_at: 'desc' },
    });

    const where: Prisma.ProductWhereInput = {};
    if (productName) {
      where.name = { contains: productName, mode: 'insensitive' };
    }

    const tenantResults = await Promise.all(
      tenants.map((tenant) =>
        this.runWithTenantRls(tenant.id, async (tx) => {
          const tenantWhere = {
            ...where,
            tenant_id: tenant.id,
          };
          const [data, total] = await Promise.all([
            tx.product.findMany({
              where: tenantWhere,
              include: {
                tenant: true,
              },
              orderBy: { created_at: 'desc' },
              take: pagination.prefetch,
            }),
            tx.product.count({ where: tenantWhere }),
          ]);

          return { data, total };
        }),
      ),
    );

    const total = tenantResults.reduce((sum, result) => sum + result.total, 0);
    const items = tenantResults
      .flatMap((result) => result.data)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    return this.paginateItems(
      items,
      total,
      pagination.page,
      pagination.limit,
      pagination.offset,
    );
  }

  // Orders Management
  async getOrders(
    clientName?: string,
    totalCost?: number,
    page = 1,
    limit = 20,
  ) {
    const pagination = this.getPagination(page, limit);
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { created_at: 'desc' },
    });

    const where: Prisma.OrderWhereInput = {};
    if (clientName) {
      where.customer_name = { contains: clientName, mode: 'insensitive' };
    }
    if (totalCost !== undefined) {
      where.total = totalCost;
    }

    const tenantResults = await Promise.all(
      tenants.map((tenant) =>
        this.runWithTenantRls(tenant.id, async (tx) => {
          const tenantWhere = {
            ...where,
            tenant_id: tenant.id,
          };
          const [data, total] = await Promise.all([
            tx.order.findMany({
              where: tenantWhere,
              include: {
                tenant: true,
              },
              orderBy: { created_at: 'desc' },
              take: pagination.prefetch,
            }),
            tx.order.count({ where: tenantWhere }),
          ]);

          return { data, total };
        }),
      ),
    );

    const total = tenantResults.reduce((sum, result) => sum + result.total, 0);
    const items = tenantResults
      .flatMap((result) => result.data)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    return this.paginateItems(
      items,
      total,
      pagination.page,
      pagination.limit,
      pagination.offset,
    );
  }
}
