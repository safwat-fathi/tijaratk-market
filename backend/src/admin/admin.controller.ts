import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Param,
  Patch,
  ParseIntPipe,
  Res,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { TogglePlanStatusDto } from './dto/toggle-plan-status.dto';
import { UpdateTenantPlanDto } from './dto/update-tenant-plan.dto';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { ProductsService } from '../products/products.service';
import { AddBulkEssentialItemsDto } from '../products/dto/add-bulk-essential.dto';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { UpdateProductDto } from '../products/dto/update-product.dto';
import { Response } from 'express';
import {
  AdminLoginResponseDto,
  AdminLogoutResponseDto,
  AdminDashboardStatsResponseDto,
  AdminTenantResponseDto,
  AdminPlanResponseDto,
} from './dto/admin-responses.dto';
import CONSTANTS from 'src/common/constants';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly productsService: ProductsService,
  ) {}

  @Post('login')
  @ApiOperation({
    summary: 'Admin login',
    description:
      'Authenticate an admin user and set a secure cookie with the access token.',
  })
  @ApiBody({ type: AdminLoginDto })
  @ApiResponse({
    status: 200,
    type: AdminLoginResponseDto,
    description: 'Login successful, access token cookie set',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: AdminLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
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
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Admin logout',
    description: 'Clear the admin access token cookie to log out the user.',
  })
  @ApiResponse({
    status: 200,
    type: AdminLogoutResponseDto,
    description: 'Logout successful',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('admin_access_token');
    return { success: true };
  }

  @UseGuards(AdminAuthGuard)
  @Get('dashboard-stats')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Get dashboard stats',
    description:
      'Retrieve general stats for the admin dashboard including merchant, order, and plan counts.',
  })
  @ApiResponse({
    status: 200,
    type: AdminDashboardStatsResponseDto,
    description: 'Stats retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @UseGuards(AdminAuthGuard)
  @Get('tenants')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Get all tenants',
    description:
      'Retrieve a list of all registered tenants, including order and customer counts.',
  })
  @ApiResponse({
    status: 200,
    type: [AdminTenantResponseDto],
    description: 'List of tenants retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getTenants() {
    return this.adminService.getTenants();
  }

  @UseGuards(AdminAuthGuard)
  @Patch('tenants/:id/status')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Update tenant status',
    description: 'Update the activation status of a specific tenant.',
  })
  @ApiParam({
    name: 'id',
    description: 'The unique ID of the tenant',
    type: Number,
  })
  @ApiBody({ type: UpdateTenantStatusDto })
  @ApiResponse({
    status: 200,
    type: AdminTenantResponseDto,
    description: 'Tenant status updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  updateTenantStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTenantStatusDto: UpdateTenantStatusDto,
  ) {
    return this.adminService.updateTenantStatus(
      id,
      updateTenantStatusDto.status,
    );
  }

  @UseGuards(AdminAuthGuard)
  @Patch('tenants/:id/plan')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Update tenant plan',
    description: 'Update the subscription plan of a specific tenant.',
  })
  @ApiParam({
    name: 'id',
    description: 'The unique ID of the tenant',
    type: Number,
  })
  @ApiBody({ type: UpdateTenantPlanDto })
  @ApiResponse({ status: 200, description: 'Tenant plan updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Tenant or plan not found' })
  updateTenantPlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTenantPlanDto: UpdateTenantPlanDto,
  ) {
    return this.adminService.updateTenantPlan(id, updateTenantPlanDto.plan_id);
  }

  @UseGuards(AdminAuthGuard)
  @Post('tenants/:id/bulk-essentials')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Bulk add essential products for a merchant',
    description: 'Populate a supermarket tenant with essential catalog items.',
  })
  @ApiParam({
    name: 'id',
    description: 'The unique ID of the tenant',
    type: Number,
  })
  @ApiBody({ type: AddBulkEssentialItemsDto })
  @ApiResponse({ status: 201, description: 'Products added successfully' })
  @ApiResponse({ status: 400, description: 'Tenant is not a supermarket' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  bulkAddEssentials(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddBulkEssentialItemsDto,
  ) {
    return this.productsService.bulkAddEssentials(id, dto);
  }

  @UseGuards(AdminAuthGuard)
  @Post('tenants/:id/products')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Create a product for a merchant',
    description: 'Create a manual product for a selected merchant as admin.',
  })
  @ApiParam({
    name: 'id',
    description: 'The unique ID of the tenant',
    type: Number,
  })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  createTenantProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.createForTenantAsAdmin(id, dto);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('products/:id')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Update a merchant product',
    description: 'Update a product for any merchant as admin.',
  })
  @ApiParam({
    name: 'id',
    description: 'The unique ID of the product',
    type: Number,
  })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updateTenantProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.updateForTenantAsAdmin(id, dto);
  }

  @UseGuards(AdminAuthGuard)
  @Get('plans')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Get subscription plans',
    description: 'Retrieve all available subscription plans, ordered by price.',
  })
  @ApiResponse({
    status: 200,
    type: [AdminPlanResponseDto],
    description: 'Subscription plans retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getPlans() {
    return this.adminService.getPlans();
  }

  @UseGuards(AdminAuthGuard)
  @Patch('plans/:id/status')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Toggle subscription plan status',
    description: 'Enable or disable a subscription plan.',
  })
  @ApiParam({
    name: 'id',
    description: 'The unique ID of the subscription plan',
    type: Number,
  })
  @ApiBody({ type: TogglePlanStatusDto })
  @ApiResponse({
    status: 200,
    type: AdminPlanResponseDto,
    description: 'Plan status updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  togglePlanStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() togglePlanStatusDto: TogglePlanStatusDto,
  ) {
    return this.adminService.togglePlanStatus(
      id,
      togglePlanStatusDto.is_active,
    );
  }

  @UseGuards(AdminAuthGuard)
  @Get('products')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Get products',
    description: 'Retrieve a list of products with optional filters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Products retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProducts(
    @Query('tenantName') tenantName?: string,
    @Query('productName') productName?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getProducts(
      tenantName,
      productName,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  @UseGuards(AdminAuthGuard)
  @Get('orders')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Get completed orders',
    description: 'Retrieve a list of orders with optional filters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getOrders(
    @Query('clientName') clientName?: string,
    @Query('totalCost') totalCost?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getOrders(
      clientName,
      totalCost ? Number(totalCost) : undefined,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }
}
