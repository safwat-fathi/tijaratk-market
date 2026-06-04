import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminLoginDto } from './dto/admin-login.dto';
import { TenantStatus } from '../../generated/prisma/client';

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

  // Dashboard Stats
  async getDashboardStats() {
    const totalMerchants = await this.prisma.tenant.count();
    const activeMerchants = await this.prisma.tenant.count({
      where: { status: TenantStatus.active },
    });
    const totalOrders = await this.prisma.order.count();
    const totalPlans = await this.prisma.subscriptionPlan.count();

    return {
      totalMerchants,
      activeMerchants,
      totalOrders,
      totalPlans,
    };
  }

  // Tenants Management
  async getTenants() {
    return this.prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            orders: true,
            customers: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async updateTenantStatus(id: number, status: TenantStatus) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return this.prisma.tenant.update({
      where: { id },
      data: { status },
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
}
