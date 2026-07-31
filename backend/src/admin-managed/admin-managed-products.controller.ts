import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminAuthGuard } from 'src/admin/guards/admin-auth.guard';
import CONSTANTS from 'src/common/constants';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { AddProductFromCatalogDto } from 'src/products/dto/add-product-from-catalog.dto';
import { CreateProductDto } from 'src/products/dto/create-product.dto';
import { GetCatalogItemsDto } from 'src/products/dto/get-catalog-items.dto';
import { GetTenantProductsDto } from 'src/products/dto/get-tenant-products.dto';
import { BulkUpdateProductsDto } from 'src/products/dto/bulk-update-products.dto';
import { AddBulkEssentialItemsDto } from 'src/products/dto/add-bulk-essential.dto';
import { ProductsService } from 'src/products/products.service';
import { ProductImportService } from 'src/products/product-import.service';
import {
  ImportProductSpreadsheetDto,
  PreviewProductImportDto,
} from 'src/products/dto/product-import.dto';
import {
  imageFileFilter,
  productSpreadsheetFileFilter,
} from 'src/common/utils/file-filters';
import { UploadFile } from 'src/common/decorators/upload-file.decorator';
import { AdminActorContext } from './admin-managed.types';
import { CurrentAdminActor } from './decorators/current-admin-actor.decorator';
import {
  RequireManagedFeature,
  RequireManagedPermissions,
} from './decorators/managed-policy.decorator';
import { ManagedTenantGuard } from './guards/managed-tenant.guard';
import { ADMIN_MANAGED_PERMISSIONS } from './constants/admin-managed-permissions';
import {
  UpdateManagedProductAvailabilityDto,
  UpdateManagedProductDetailsDto,
  UpdateManagedProductPriceDto,
  UpdateManagedProductStatusDto,
} from './dto/admin-managed-product.dto';

/** Tenant-scoped product operations performed by a managed administrator. */
@ApiTags('Admin Managed Products')
@ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
@Controller('admin/managed-tenants/:tenantId')
@UseGuards(AdminAuthGuard, ManagedTenantGuard)
export class AdminManagedProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productImportService: ProductImportService,
  ) {}

  /** Lists or searches products belonging to the active managed tenant. */
  @Get('products')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.ProductsRead)
  @ApiOperation({ summary: 'List managed tenant products' })
  listProducts(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Query() query: GetTenantProductsDto,
  ) {
    if (query.search?.trim()) {
      return this.productsService.searchTenantProductsForAdmin(
        tenantId,
        query.search,
        query.category,
        query.page,
        query.limit,
        {
          rankAll: query.rank_all ?? false,
          excludeProductIds: query.exclude_product_ids ?? [],
          status: query.status ?? ProductStatus.ACTIVE,
        },
      );
    }

    if (query.page || query.limit || query.category) {
      return this.productsService.findPaginatedTenantProductsAsAdmin(
        tenantId,
        query.page || 1,
        query.limit || 20,
        query.category,
        query.status ?? ProductStatus.ACTIVE,
      );
    }

    return this.productsService.findAllForTenantAsAdmin(tenantId, query.status);
  }

  /** Returns one product only when it belongs to the active tenant. */
  @Get('products/:productId')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.ProductsRead)
  @ApiOperation({ summary: 'Get managed tenant product' })
  getProduct(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.productsService.findOneForTenantAsAdmin(tenantId, productId);
  }

  /** Lists merchant-defined categories. */
  @Get('product-categories')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.ProductsRead)
  @ApiOperation({ summary: 'List managed tenant product categories' })
  listProductCategories(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.productsService.findTenantProductCategoriesForAdmin(tenantId);
  }

  /** Lists allowed ready-made catalog categories for this tenant type. */
  @Get('catalog/categories')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.ProductsRead)
  @ApiOperation({ summary: 'List allowed managed tenant catalog categories' })
  listCatalogCategories(@Param('tenantId', ParseIntPipe) tenantId: number) {
    return this.productsService.findCatalogCategoriesForAdmin(tenantId);
  }

  /** Lists catalog items from the centrally allowed source only. */
  @Get('catalog')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.ProductsRead)
  @ApiOperation({ summary: 'List allowed managed tenant catalog items' })
  listCatalog(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Query() query: GetCatalogItemsDto,
  ) {
    return this.productsService.findCatalogItemsForAdmin(
      tenantId,
      query.search,
      query.category,
      query.page,
      query.limit,
    );
  }

  /** Creates a manual product with managed admin attribution. */
  @Post('products')
  @RequireManagedFeature('product_write')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.ProductsCreate)
  @ApiOperation({ summary: 'Create managed tenant product' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({ type: CreateProductDto })
  @UploadFile('file', {
    fileFilter: imageFileFilter,
    limits: { fileSize: CONSTANTS.UPLOAD.MAX_IMAGE_SIZE_BYTES },
  })
  createProduct(
    @CurrentAdminActor() actor: AdminActorContext,
    @Body() dto: CreateProductDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.productsService.createForTenantAsAdmin(
      actor.tenantId,
      dto,
      file,
      actor,
    );
  }

  /** Parses an uploaded product spreadsheet for the mapping wizard. */
  @Post('products/import/preview')
  @RequireManagedFeature('product_write')
  @RequireManagedPermissions(
    ADMIN_MANAGED_PERMISSIONS.ProductsCreate,
    ADMIN_MANAGED_PERMISSIONS.ProductsUpdate,
    ADMIN_MANAGED_PERMISSIONS.ProductsUpdatePrice,
  )
  @ApiOperation({ summary: 'Preview a managed product spreadsheet import' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: PreviewProductImportDto })
  @ApiResponse({
    status: 201,
    description: 'Spreadsheet columns and sample rows returned',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: CONSTANTS.UPLOAD.MAX_CSV_SIZE_BYTES },
      fileFilter: productSpreadsheetFileFilter,
    }),
  )
  previewProductImport(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('ملف المنتجات مطلوب');
    }
    return this.productImportService.preview(file);
  }

  /** Imports mapped spreadsheet rows into the managed tenant. */
  @Post('products/import')
  @RequireManagedFeature('product_write')
  @RequireManagedPermissions(
    ADMIN_MANAGED_PERMISSIONS.ProductsCreate,
    ADMIN_MANAGED_PERMISSIONS.ProductsUpdate,
    ADMIN_MANAGED_PERMISSIONS.ProductsUpdatePrice,
  )
  @ApiOperation({ summary: 'Import a mapped managed product spreadsheet' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ImportProductSpreadsheetDto })
  @ApiResponse({
    status: 201,
    description: 'Valid product rows created or updated',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: CONSTANTS.UPLOAD.MAX_CSV_SIZE_BYTES },
      fileFilter: productSpreadsheetFileFilter,
    }),
  )
  importProductSpreadsheet(
    @CurrentAdminActor() actor: AdminActorContext,
    @Body() dto: ImportProductSpreadsheetDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('ملف المنتجات مطلوب');
    }
    if (
      dto.mapping.is_available !== undefined &&
      !actor.permissions.includes(
        ADMIN_MANAGED_PERMISSIONS.ProductsUpdateAvailability,
      )
    ) {
      throw new ForbiddenException(
        'ليس لديك صلاحية تحديث إتاحة المنتجات',
      );
    }

    return this.productImportService.import(
      actor.tenantId,
      file,
      dto.mapping,
      actor,
    );
  }

  /** Creates one product from the tenant's allowed platform catalog. */
  @Post('products/from-catalog')
  @RequireManagedFeature('product_write')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.ProductsCreate)
  @ApiOperation({ summary: 'Add allowed catalog item to managed tenant' })
  @ApiBody({ type: AddProductFromCatalogDto })
  createFromCatalog(
    @CurrentAdminActor() actor: AdminActorContext,
    @Body() dto: AddProductFromCatalogDto,
  ) {
    return this.productsService.createFromCatalogForTenantAsAdmin(
      actor.tenantId,
      dto,
      actor,
    );
  }

  @Get('bulk-essentials/stages')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.ProductsRead)
  @ApiOperation({ summary: 'Get managed tenant essential bulk import stages' })
  findTenantBulkEssentialStages(
    @CurrentAdminActor() actor: AdminActorContext,
  ) {
    return this.productsService.findBulkEssentialStages(actor.tenantId);
  }

  @Post('bulk-essentials')
  @RequireManagedFeature('product_write')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.ProductsCreate)
  @ApiOperation({ summary: 'Bulk add essential products for a managed tenant' })
  @ApiBody({ type: AddBulkEssentialItemsDto })
  bulkAddEssentials(
    @CurrentAdminActor() actor: AdminActorContext,
    @Body() dto: AddBulkEssentialItemsDto,
  ) {
    return this.productsService.bulkAddEssentials(actor.tenantId, dto, actor);
  }

  /** Bulk updates multiple products in a single operation. */
  @Patch('products/bulk')
  @RequireManagedFeature('product_write')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.ProductsUpdate)
  @ApiOperation({ summary: 'Bulk update managed products' })
  @ApiBody({ type: BulkUpdateProductsDto })
  bulkUpdate(
    @CurrentAdminActor() actor: AdminActorContext,
    @Body() payload: BulkUpdateProductsDto,
  ) {
    return this.productsService.bulkUpdateForManagedAdmin(actor, payload);
  }

  /** Updates non-sensitive product details only. */
  @Patch('products/:productId/details')
  @RequireManagedFeature('product_write')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.ProductsUpdate)
  @ApiOperation({ summary: 'Update managed product details' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({ type: UpdateManagedProductDetailsDto })
  @UploadFile('file', {
    fileFilter: imageFileFilter,
    limits: { fileSize: CONSTANTS.UPLOAD.MAX_IMAGE_SIZE_BYTES },
  })
  updateDetails(
    @CurrentAdminActor() actor: AdminActorContext,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpdateManagedProductDetailsDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.productsService.updateForManagedAdmin(
      actor,
      productId,
      dto,
      file,
    );
  }

  /** Updates only the current product price. */
  @Patch('products/:productId/price')
  @RequireManagedFeature('product_write')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.ProductsUpdatePrice)
  @ApiOperation({ summary: 'Update managed product price' })
  @ApiBody({ type: UpdateManagedProductPriceDto })
  updatePrice(
    @CurrentAdminActor() actor: AdminActorContext,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpdateManagedProductPriceDto,
  ) {
    return this.productsService.updateForManagedAdmin(actor, productId, dto);
  }

  /** Updates only storefront availability. */
  @Patch('products/:productId/availability')
  @RequireManagedFeature('product_write')
  @RequireManagedPermissions(
    ADMIN_MANAGED_PERMISSIONS.ProductsUpdateAvailability,
  )
  @ApiOperation({ summary: 'Update managed product availability' })
  @ApiBody({ type: UpdateManagedProductAvailabilityDto })
  updateAvailability(
    @CurrentAdminActor() actor: AdminActorContext,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpdateManagedProductAvailabilityDto,
  ) {
    return this.productsService.updateForManagedAdmin(actor, productId, dto);
  }

  /** Archives or restores a product without hard deletion. */
  @Patch('products/:productId/status')
  @RequireManagedFeature('product_write')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.ProductsArchive)
  @ApiOperation({ summary: 'Archive or restore managed product' })
  @ApiBody({ type: UpdateManagedProductStatusDto })
  updateStatus(
    @CurrentAdminActor() actor: AdminActorContext,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpdateManagedProductStatusDto,
  ) {
    return this.productsService.updateForManagedAdmin(actor, productId, dto);
  }
}
