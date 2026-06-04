import { Controller, Post, Body, Get, UseGuards, Param, Patch, ParseIntPipe, Res } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { TenantStatus } from '../../generated/prisma/client';
import { Response } from 'express';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('login')
  async login(@Body() loginDto: AdminLoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.adminService.login(loginDto);
    
    res.cookie('admin_access_token', result.admin_access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return result;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('admin_access_token');
    return { success: true };
  }

  @UseGuards(AdminAuthGuard)
  @Get('dashboard-stats')
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @UseGuards(AdminAuthGuard)
  @Get('tenants')
  getTenants() {
    return this.adminService.getTenants();
  }

  @UseGuards(AdminAuthGuard)
  @Patch('tenants/:id/status')
  updateTenantStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: TenantStatus,
  ) {
    return this.adminService.updateTenantStatus(id, status);
  }

  @UseGuards(AdminAuthGuard)
  @Get('plans')
  getPlans() {
    return this.adminService.getPlans();
  }

  @UseGuards(AdminAuthGuard)
  @Patch('plans/:id/status')
  togglePlanStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('is_active') is_active: boolean,
  ) {
    return this.adminService.togglePlanStatus(id, is_active);
  }
}
