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
  Delete,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { TogglePlanStatusDto } from './dto/toggle-plan-status.dto';
import { UpdateTenantPlanDto } from './dto/update-tenant-plan.dto';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { ProductsService } from '../products/products.service';
import { AddBulkEssentialItemsDto } from '../products/dto/add-bulk-essential.dto';
import { AddProductFromCatalogDto } from '../products/dto/add-product-from-catalog.dto';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { GetCatalogItemsDto } from '../products/dto/get-catalog-items.dto';
import { GetTenantProductsDto } from '../products/dto/get-tenant-products.dto';
import { UpdateProductDto } from '../products/dto/update-product.dto';
import {
  BulkUpdateAdminCatalogItemsDto,
  BulkUpdateAdminProductsDto,
  CreateAdminCatalogCategoryDto,
  CreateAdminCatalogItemDto,
  CreateTenantProductCategoryDto,
  GetAdminCatalogCategoriesDto,
  GetAdminCatalogItemsDto,
  UpdateAdminCatalogCategoryDto,
  UpdateAdminCatalogItemDto,
  UpdateTenantProductCategoryDto,
} from './dto/catalog-item.dto';
import {
  CreateSupermarketEssentialDto,
  UpdateSupermarketEssentialDto,
} from './dto/supermarket-essential.dto';
import { Response } from 'express';
import { TenantCategory } from '../../generated/prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import {
  AdminLoginResponseDto,
  AdminLogoutResponseDto,
  AdminDashboardStatsResponseDto,
  AdminTenantResponseDto,
  AdminPlanResponseDto,
} from './dto/admin-responses.dto';
import CONSTANTS from 'src/common/constants';
import { UploadFile } from 'src/common/decorators/upload-file.decorator';
import { imageFileFilter } from 'src/common/utils/file-filters';

const ADMIN_PRODUCT_SHEET_UPLOAD_DIR = join(
  process.cwd(),
  'uploads',
  'admin-product-sheets',
);
const MAX_ADMIN_PRODUCT_SHEET_SIZE_BYTES = 10 * 1024 * 1024;

mkdirSync(ADMIN_PRODUCT_SHEET_UPLOAD_DIR, { recursive: true });

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
  getTenants(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('tenantId') tenantId?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('areaId') areaId?: string,
  ) {
    return this.adminService.getTenants(
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      search,
      tenantId ? Number(tenantId) : undefined,
      category,
      status,
      areaId ? Number(areaId) : undefined,
    );
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

  /**
   * Returns staged essential catalog candidates for a selected tenant.
   */
  @UseGuards(AdminAuthGuard)
  @Get('tenants/:id/bulk-essentials/stages')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Get staged essential bulk import candidates for a merchant',
    description:
      'Return staged essential catalog categories and selected candidates for a supermarket tenant.',
  })
  @ApiParam({
    name: 'id',
    description: 'The unique ID of the tenant',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Essential product stages returned successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findTenantBulkEssentialStages(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findBulkEssentialStages(id);
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
  @UploadFile('file', {
    fileFilter: imageFileFilter,
    limits: { fileSize: CONSTANTS.UPLOAD.MAX_IMAGE_SIZE_BYTES },
  })
  createTenantProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateProductDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.productsService.createForTenantAsAdmin(id, dto, file);
  }

  @UseGuards(AdminAuthGuard)
  @Get('tenants/:id/products')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Get merchant products as admin',
    description: 'Retrieve or search products for a selected merchant.',
  })
  getTenantProducts(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: GetTenantProductsDto,
  ) {
    if (query.search?.trim()) {
      return this.productsService.searchTenantProductsForAdmin(
        id,
        query.search,
        query.category,
        query.page,
        query.limit,
        {
          rankAll: query.rank_all ?? false,
          excludeProductIds: query.exclude_product_ids ?? [],
        },
      );
    }

    return this.productsService.findAllForTenantAsAdmin(id);
  }

  @UseGuards(AdminAuthGuard)
  @Get('tenants/:id/products/categories')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Get merchant product categories as admin' })
  getTenantProductCategories(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findTenantProductCategoriesForAdmin(id);
  }

  @UseGuards(AdminAuthGuard)
  @Get('tenants/:id/catalog/categories')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Get merchant catalog categories as admin' })
  getTenantCatalogCategories(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findCatalogCategoriesForAdmin(id);
  }

  @UseGuards(AdminAuthGuard)
  @Get('tenants/:id/catalog')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Get merchant catalog items as admin' })
  getTenantCatalogItems(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: GetCatalogItemsDto,
  ) {
    return this.productsService.findCatalogItemsForAdmin(
      id,
      query.search,
      query.category,
      query.page,
      query.limit,
    );
  }

  @UseGuards(AdminAuthGuard)
  @Post('tenants/:id/products/from-catalog')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Create merchant product from catalog as admin' })
  @ApiBody({ type: AddProductFromCatalogDto })
  createTenantProductFromCatalog(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddProductFromCatalogDto,
  ) {
    return this.productsService.createFromCatalogForTenantAsAdmin(id, dto);
  }

  @UseGuards(AdminAuthGuard)
  @Post('tenants/:id/products/catalog-sheet')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Upload merchant products from catalog CSV',
    description:
      'Create or update products for a selected merchant from an admin catalog export CSV.',
  })
  @ApiResponse({ status: 201, description: 'Product sheet processed' })
  @ApiResponse({ status: 400, description: 'Invalid CSV or tenant category' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: ADMIN_PRODUCT_SHEET_UPLOAD_DIR,
        filename: (_req, file, callback) => {
          const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
          callback(null, `${Date.now()}-${safeName}`);
        },
      }),
      limits: { fileSize: MAX_ADMIN_PRODUCT_SHEET_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        const extension = extname(file.originalname).toLowerCase();
        if (extension !== '.csv') {
          callback(
            new BadRequestException('Only CSV files are supported'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadTenantProductCatalogSheet(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Product sheet file is required');
    }

    return this.adminService.uploadTenantProductCatalogSheet(id, file);
  }

  @UseGuards(AdminAuthGuard)
  @Post('tenants/:id/products/import')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Import products from CSV for a tenant',
    description: 'Upload a CSV template file to bulk create or update products for a merchant.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'CSV file to upload' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: ADMIN_PRODUCT_SHEET_UPLOAD_DIR,
        filename: (_req, file, callback) => {
          const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
          callback(null, `import-${Date.now()}-${safeName}`);
        },
      }),
      limits: { fileSize: MAX_ADMIN_PRODUCT_SHEET_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        const extension = extname(file.originalname).toLowerCase();
        if (extension !== '.csv') {
          callback(
            new BadRequestException('Only CSV files are supported'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  importProducts(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Product sheet file is required');
    }

    return this.productsService.importProductsFromCsv(id, file);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('products/bulk')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Bulk update merchant products as admin' })
  @ApiBody({ type: BulkUpdateAdminProductsDto })
  @ApiResponse({ status: 200, description: 'Products updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid bulk update payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  bulkUpdateProducts(@Body() dto: BulkUpdateAdminProductsDto) {
    return this.productsService.bulkUpdateForTenantAsAdmin(dto);
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
  @UploadFile('file', {
    fileFilter: imageFileFilter,
    limits: { fileSize: CONSTANTS.UPLOAD.MAX_IMAGE_SIZE_BYTES },
  })
  updateTenantProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.productsService.updateForTenantAsAdmin(id, dto, file);
  }

  @UseGuards(AdminAuthGuard)
  @Delete('products/:id')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Archive a merchant product as admin' })
  archiveTenantProduct(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.removeForTenantAsAdmin(id);
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
  @Get('catalog-items')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Get catalog items',
    description: 'Retrieve global catalog items for one supported source.',
  })
  @ApiResponse({
    status: 200,
    description: 'Catalog items retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getAdminCatalogItems(@Query() query: GetAdminCatalogItemsDto) {
    return this.adminService.getAdminCatalogItems(
      query.source,
      query.search,
      query.category,
      query.status,
      query.page,
      query.limit,
    );
  }

  @UseGuards(AdminAuthGuard)
  @Get('catalog-items/export')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Export catalog items as CSV',
    description:
      'Download active catalog items for one supported source as an Excel-compatible CSV.',
  })
  @ApiResponse({ status: 200, description: 'CSV file returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async exportAdminCatalogItems(
    @Query() query: GetAdminCatalogItemsDto,
    @Res() res: Response,
  ) {
    const exportFile = await this.adminService.exportAdminCatalogItems(
      query.source,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportFile.filename}"`,
    );
    res.send(exportFile.content);
  }

  @UseGuards(AdminAuthGuard)
  @Get('products/import-template')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Download product import template',
    description: 'Download an empty CSV template for product imports.',
  })
  @ApiResponse({ status: 200, description: 'CSV file returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  downloadProductImportTemplate(@Res() res: Response) {
    const template = this.adminService.generateProductImportTemplate();

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${template.filename}"`,
    );
    res.send(template.content);
  }

  @UseGuards(AdminAuthGuard)
  @Get('catalog-items/categories')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Get catalog item categories',
    description: 'Retrieve category counts for one supported catalog source.',
  })
  @ApiResponse({
    status: 200,
    description: 'Catalog categories retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getAdminCatalogCategories(@Query() query: GetAdminCatalogCategoriesDto) {
    return this.adminService.getAdminCatalogCategories(query.source);
  }

  @UseGuards(AdminAuthGuard)
  @Post('catalog-items/categories')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Create catalog category' })
  @ApiBody({ type: CreateAdminCatalogCategoryDto })
  createAdminCatalogCategory(@Body() dto: CreateAdminCatalogCategoryDto) {
    return this.adminService.createAdminCatalogCategory(dto);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('catalog-items/categories/:id')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Rename catalog category' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateAdminCatalogCategoryDto })
  updateAdminCatalogCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminCatalogCategoryDto,
  ) {
    return this.adminService.updateAdminCatalogCategory(id, dto);
  }

  @UseGuards(AdminAuthGuard)
  @Delete('catalog-items/categories/:id')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Delete empty catalog category' })
  @ApiParam({ name: 'id', type: Number })
  deleteAdminCatalogCategory(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteAdminCatalogCategory(id);
  }

  @UseGuards(AdminAuthGuard)
  @Post('catalog-items')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Create catalog item',
    description: 'Create a global catalog item for a supported source.',
  })
  @ApiBody({ type: CreateAdminCatalogItemDto })
  @ApiResponse({ status: 201, description: 'Catalog item created' })
  @ApiResponse({ status: 400, description: 'Invalid source or category' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UploadFile('file', {
    fileFilter: imageFileFilter,
    limits: { fileSize: CONSTANTS.UPLOAD.MAX_IMAGE_SIZE_BYTES },
  })
  createAdminCatalogItem(
    @Body() dto: CreateAdminCatalogItemDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.adminService.createAdminCatalogItem(dto, file);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('catalog-items/bulk')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Bulk update catalog items',
    description: 'Update selected global catalog items without changing source.',
  })
  @ApiBody({ type: BulkUpdateAdminCatalogItemsDto })
  @ApiResponse({ status: 200, description: 'Catalog items updated' })
  @ApiResponse({ status: 400, description: 'Invalid bulk update payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  bulkUpdateAdminCatalogItems(@Body() dto: BulkUpdateAdminCatalogItemsDto) {
    return this.adminService.bulkUpdateAdminCatalogItems(dto);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('catalog-items/:id')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Update catalog item',
    description: 'Update a global catalog item without changing its source.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateAdminCatalogItemDto })
  @ApiResponse({ status: 200, description: 'Catalog item updated' })
  @ApiResponse({ status: 400, description: 'Invalid category' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Catalog item not found' })
  @UploadFile('file', {
    fileFilter: imageFileFilter,
    limits: { fileSize: CONSTANTS.UPLOAD.MAX_IMAGE_SIZE_BYTES },
  })
  updateAdminCatalogItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminCatalogItemDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.adminService.updateAdminCatalogItem(id, dto, file);
  }

  @UseGuards(AdminAuthGuard)
  @Delete('catalog-items/:id')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Deactivate catalog item',
    description:
      'Deactivate a global catalog item instead of hard deleting it.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Catalog item deactivated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Catalog item not found' })
  deleteAdminCatalogItem(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteAdminCatalogItem(id);
  }

  @UseGuards(AdminAuthGuard)
  @Get('tenants/:id/product-categories')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Get tenant product categories with counts' })
  getAdminTenantProductCategories(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getTenantProductCategories(id);
  }

  @UseGuards(AdminAuthGuard)
  @Post('tenants/:id/product-categories')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Create tenant product category' })
  @ApiBody({ type: CreateTenantProductCategoryDto })
  createAdminTenantProductCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTenantProductCategoryDto,
  ) {
    return this.adminService.createTenantProductCategory(id, dto);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('tenants/:tenantId/product-categories/:categoryId')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Rename tenant product category' })
  @ApiBody({ type: UpdateTenantProductCategoryDto })
  updateAdminTenantProductCategory(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Body() dto: UpdateTenantProductCategoryDto,
  ) {
    return this.adminService.updateTenantProductCategory(
      tenantId,
      categoryId,
      dto,
    );
  }

  @UseGuards(AdminAuthGuard)
  @Delete('tenants/:tenantId/product-categories/:categoryId')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Delete empty tenant product category' })
  deleteAdminTenantProductCategory(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ) {
    return this.adminService.deleteTenantProductCategory(
      tenantId,
      categoryId,
    );
  }

  @UseGuards(AdminAuthGuard)
  @Get('supermarket-essentials')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Get supermarket essentials',
    description: 'Retrieve curated essential supermarket catalog items.',
  })
  getSupermarketEssentials(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getSupermarketEssentials(
      search,
      category,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  @UseGuards(AdminAuthGuard)
  @Get('supermarket-catalog-categories')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Get supermarket catalog categories',
    description: 'Retrieve active supermarket catalog categories and counts.',
  })
  getSupermarketCatalogCategories() {
    return this.adminService.getSupermarketCatalogCategories();
  }

  @UseGuards(AdminAuthGuard)
  @Get('supermarket-catalog-candidates')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Get supermarket catalog candidates',
    description:
      'Retrieve active supermarket catalog rows that can be marked essential.',
  })
  getSupermarketCatalogCandidates(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getSupermarketCatalogCandidates(
      search,
      category,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  @UseGuards(AdminAuthGuard)
  @Post('supermarket-essentials')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Create or mark supermarket essential',
    description:
      'Create a new supermarket catalog item as essential or mark an existing row.',
  })
  @ApiBody({ type: CreateSupermarketEssentialDto })
  @UploadFile('file', {
    fileFilter: imageFileFilter,
    limits: { fileSize: CONSTANTS.UPLOAD.MAX_IMAGE_SIZE_BYTES },
  })
  createSupermarketEssential(
    @Body() dto: CreateSupermarketEssentialDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.adminService.createSupermarketEssential(dto, file);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('supermarket-essentials/:id')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Update supermarket essential',
    description: 'Update a curated supermarket catalog item.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateSupermarketEssentialDto })
  @UploadFile('file', {
    fileFilter: imageFileFilter,
    limits: { fileSize: CONSTANTS.UPLOAD.MAX_IMAGE_SIZE_BYTES },
  })
  updateSupermarketEssential(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupermarketEssentialDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.adminService.updateSupermarketEssential(id, dto, file);
  }

  @UseGuards(AdminAuthGuard)
  @Delete('supermarket-essentials/:id')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Remove supermarket essential',
    description:
      'Unmark a supermarket catalog item as essential without deleting it.',
  })
  @ApiParam({ name: 'id', type: Number })
  deleteSupermarketEssential(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteSupermarketEssential(id);
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
    @Query('tenantCategory') tenantCategory?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const supportedTenantCategory =
      tenantCategory === TenantCategory.grocery ||
      tenantCategory === TenantCategory.pharmacy
        ? tenantCategory
        : undefined;

    return this.adminService.getProducts(
      tenantName,
      productName,
      supportedTenantCategory,
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
