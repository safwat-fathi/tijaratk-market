import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  Res,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import CONSTANTS from 'src/common/constants';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AddProductFromCatalogDto } from './dto/add-product-from-catalog.dto';
import { AddBulkEssentialItemsDto } from './dto/add-bulk-essential.dto';
import { BulkUpdateProductsDto } from './dto/bulk-update-products.dto';
import { UploadFile } from 'src/common/decorators/upload-file.decorator';
import { imageFileFilter, csvFileFilter } from 'src/common/utils/file-filters';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { GetPublicProductsDto } from './dto/get-public-products.dto';
import { GetTenantProductsDto } from './dto/get-tenant-products.dto';
import { GetCatalogItemsDto } from './dto/get-catalog-items.dto';
import { ProductOrderMode } from 'src/common/enums/product-order-mode.enum';
import { parseBooleanLike } from './utils/parse-boolean-like';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Create product (quick manual add)' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        image_url: { type: 'string' },
        current_price: { type: 'number', format: 'float' },
        category: { type: 'string' },
        order_mode: { type: 'string', enum: Object.values(ProductOrderMode) },
        order_config: { type: 'object' },
        is_available: { type: 'boolean' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UploadFile('file', {
    fileFilter: imageFileFilter,
    limits: { fileSize: CONSTANTS.UPLOAD.MAX_IMAGE_SIZE_BYTES },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Product created successfully',
  })
  create(
    @Req() req: Request,
    @Body() createProductDto: CreateProductDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const parsedAvailability = this.parseAvailabilityFromRequestBody(req);
    if (parsedAvailability !== undefined) {
      createProductDto.is_available = parsedAvailability;
    }

    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.productsService.create(tenantId, createProductDto, file);
  }

  @Post('from-catalog')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Create product from catalog item' })
  @ApiBody({ type: AddProductFromCatalogDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Product created from catalog successfully',
  })
  createFromCatalog(
    @Req() req: Request,
    @Body() body: AddProductFromCatalogDto,
  ) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.productsService.createFromCatalog(tenantId, body);
  }

  @Post('import')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Import products from CSV template' })
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
  @UploadFile('file', {
    fileFilter: csvFileFilter,
    limits: { fileSize: CONSTANTS.UPLOAD.MAX_CSV_SIZE_BYTES },
  })
  async importProducts(
    @Req() req: Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }
    if (!file) {
      throw new BadRequestException('Product sheet file is required');
    }
    return this.productsService.importProductsFromCsv(tenantId, file);
  }

  @Post('bulk-essentials')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Bulk add essential catalog items' })
  @ApiBody({ type: AddBulkEssentialItemsDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Bulk products created successfully',
  })
  bulkAddEssentials(
    @Req() req: Request,
    @Body() body: AddBulkEssentialItemsDto,
  ) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.productsService.bulkAddEssentials(tenantId, body);
  }

  @Get('bulk-essentials/stages')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Get staged essential bulk import candidates' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Return staged essential catalog categories and candidates',
  })
  findBulkEssentialStages(@Req() req: Request) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.productsService.findBulkEssentialStages(tenantId);
  }

  @Get('catalog/categories')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Get catalog categories' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Return active catalog categories',
  })
  findCatalogCategories(@Req() req: Request) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.productsService.findCatalogCategories(tenantId);
  }

  @Get('categories')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Get product categories for tenant onboarding' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Return merged catalog and tenant categories',
  })
  findTenantProductCategories(@Req() req: Request) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.productsService.findTenantProductCategories(tenantId);
  }

  @Get('catalog')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Get catalog items' })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter items by category',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Return catalog items' })
  findCatalogItems(@Req() req: Request, @Query() query: GetCatalogItemsDto) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.productsService.findCatalogItems(
      tenantId,
      query.search,
      query.category,
      query.page,
      query.limit,
    );
  }

  @Get('catalog/hidden')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Get hidden catalog items' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Return hidden catalog items' })
  findHiddenCatalogItems(@Req() req: Request, @Query() query: GetCatalogItemsDto) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.productsService.findHiddenCatalogItems(
      tenantId,
      query.page,
      query.limit,
    );
  }

  @Post('catalog/:id/hide')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Hide a catalog item' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Catalog item hidden successfully' })
  async hideCatalogItem(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    await this.productsService.hideCatalogItem(tenantId, +id);
    return { success: true };
  }

  @Post('catalog/:id/unhide')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Unhide a catalog item' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Catalog item unhidden successfully' })
  async unhideCatalogItem(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    await this.productsService.unhideCatalogItem(tenantId, +id);
    return { success: true };
  }

  @Get()
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Get all tenant products' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Return tenant products' })
  findAll(@Req() req: Request, @Query() query: GetTenantProductsDto) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    if (query.search?.trim()) {
      return this.productsService.searchTenantProducts(
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

    return this.productsService.findAll(tenantId, query.status);
  }

  @Patch('bulk')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Bulk update tenant products' })
  @ApiBody({ type: BulkUpdateProductsDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Products updated successfully',
  })
  bulkUpdate(@Req() req: Request, @Body() body: BulkUpdateProductsDto) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.productsService.bulkUpdate(tenantId, body);
  }

  @Get('import-template')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Download product import template' })
  @ApiResponse({ status: HttpStatus.OK, description: 'CSV file returned' })
  downloadProductImportTemplate(@Res() res: Response) {
    const filename = `product-import-template.csv`;
    const content = '\ufeffname,price,category,description,stock,imageUrl\n';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(content);
  }

  @Get('public/:slug')
  @ApiOperation({ summary: 'Get all active products by tenant slug (Public)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Return active products for tenant',
  })
  findAllByTenantSlug(
    @Param('slug') slug: string,
    @Query() query: GetPublicProductsDto,
  ) {
    if (query.search?.trim()) {
      return this.productsService.searchPublicProducts(
        slug,
        query.search,
        query.category,
        query.page,
        query.limit,
      );
    }

    return this.productsService.findAllByTenantSlug(
      slug,
      query.page,
      query.limit,
      query.category,
    );
  }

  @Get('public/:slug/categories')
  @ApiOperation({
    summary: 'Get public product categories by tenant slug (Public)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Return public storefront category summaries',
  })
  findPublicCategoriesByTenantSlug(@Param('slug') slug: string) {
    return this.productsService.findPublicCategoriesByTenantSlug(slug);
  }

  @Get(':id')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Return the product' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found',
  })
  findOne(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.productsService.findOne(+id, tenantId);
  }

  @Patch(':id')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Update a product' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        image_url: { type: 'string' },
        current_price: { type: 'number', format: 'float' },
        order_mode: { type: 'string', enum: Object.values(ProductOrderMode) },
        order_config: { type: 'object' },
        status: { type: 'string', enum: Object.values(ProductStatus) },
        is_available: { type: 'boolean' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UploadFile('file', {
    fileFilter: imageFileFilter,
    limits: { fileSize: CONSTANTS.UPLOAD.MAX_IMAGE_SIZE_BYTES },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product updated successfully',
  })
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const parsedAvailability = this.parseAvailabilityFromRequestBody(req);
    if (parsedAvailability !== undefined) {
      updateProductDto.is_available = parsedAvailability;
    }

    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.productsService.update(+id, tenantId, updateProductDto, file);
  }

  @Delete(':id')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Archive a product' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product archived successfully',
  })
  remove(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.productsService.remove(+id, tenantId);
  }

  private parseAvailabilityFromRequestBody(req: Request): boolean | undefined {
    const body = req.body as Record<string, unknown> | undefined;
    return parseBooleanLike(body?.is_available);
  }
}
