import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  ParseIntPipe,
  Query,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { AuthGuard } from '@nestjs/passport';
import CONSTANTS from 'src/common/constants';
import { UploadFile } from 'src/common/decorators/upload-file.decorator';
import { prescriptionFileFilter } from 'src/common/utils/file-filters';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ReplaceOrderItemDto } from './dto/replace-order-item.dto';
import { UpdateOrderItemPriceDto } from './dto/update-order-item-price.dto';
import { DecideReplacementDto } from './dto/decide-replacement.dto';
import { RejectOrderByCustomerDto } from './dto/reject-order-by-customer.dto';
import { ResetOrderItemReplacementDto } from './dto/reset-order-item-replacement.dto';
import { Request } from 'express';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  private static readonly RESERVED_PUBLIC_ORDER_PATHS = new Set([
    'day-close',
    'tracking',
  ]);

  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiOperation({ summary: 'Create a new order' })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Order created successfully',
  })
  create(@Req() req: Request, @Body() createOrderDto: CreateOrderDto) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }
    return this.ordersService.createForTenantId(tenantId, createOrderDto);
  }

  @Get()
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiOperation({
    summary: 'Get all orders',
    description: 'Get all orders for the authenticated tenant',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Return all orders' })
  findAll(@Req() req: Request, @Query('date') date?: string) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.ordersService.findAll(tenantId, date);
  }

  @Get('day-close/today')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiOperation({
    summary: 'Get today close-day status',
    description:
      'Returns whether current Cairo day is closed and preview summary for authenticated tenant',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Day-close status and summary preview',
  })
  getTodayDayCloseStatus(@Req() req: Request) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.ordersService.getTodayDayCloseStatus(tenantId);
  }

  @Post('day-close')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiOperation({
    summary: 'Close current day',
    description:
      'Creates a day closure snapshot for current Cairo date with idempotent behavior',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Day closed successfully',
  })
  closeDay(@Req() req: Request) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.ordersService.closeDay(tenantId);
  }

  @Post(':tenant_slug')
  @ApiOperation({ summary: 'Create a new order (Public)' })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['customer'],
      properties: {
        customer: { type: 'object' },
        order_type: { type: 'string' },
        items: { type: 'array', items: { type: 'object' } },
        free_text_payload: { type: 'object' },
        total: { type: 'number', format: 'float' },
        notes: { type: 'string' },
        order_source: { type: 'string' },
        source_metadata: { type: 'object' },
        delivery_area_id: { type: 'number' },
        delivery_area_slug: { type: 'string' },
        prescription_unavailability_action: { type: 'string' },
        prescription_file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UploadFile('prescription_file', {
    dest: join(process.cwd(), 'uploads', 'prescriptions'),
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'prescriptions'),
      filename: (_req, file, callback) => {
        const extension = extname(file.originalname || '').toLowerCase();
        callback(
          null,
          `prescription-${Date.now()}-${randomUUID()}${extension}`,
        );
      },
    }),
    fileFilter: prescriptionFileFilter,
    limits: { fileSize: CONSTANTS.UPLOAD.MAX_IMAGE_SIZE_BYTES },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Order created successfully',
  })
  createPublic(
    @Param('tenant_slug') tenantSlug: string,
    @Body() createOrderDto: CreateOrderDto,
    @UploadedFile() prescriptionFile?: Express.Multer.File,
  ) {
    if (OrdersController.RESERVED_PUBLIC_ORDER_PATHS.has(tenantSlug.trim())) {
      throw new BadRequestException('Invalid tenant slug');
    }

    return this.ordersService.createForTenantSlug(
      tenantSlug,
      createOrderDto,
      prescriptionFile,
    );
  }

  @Get('tracking/:token')
  @ApiOperation({
    summary: 'Get an order by public token (Tracking)',
    description: 'Get an order by public token (Tracking)',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Return the order' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Order not found' })
  findByPublicToken(@Param('token') token: string) {
    return this.ordersService.findByPublicToken(token);
  }

  @Get('tracking')
  @ApiOperation({
    summary: 'Get orders by public tokens (Tracking)',
    description: 'Get multiple orders by public tracking tokens',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Return orders list' })
  findByPublicTokens(
    @Query('token') tokenQuery?: string | string[],
    @Query('token[]') tokenArrayQuery?: string | string[],
  ) {
    const tokens = [
      ...this.toStringArray(tokenQuery),
      ...this.toStringArray(tokenArrayQuery),
    ];

    return this.ordersService.findByPublicTokens(tokens);
  }

  @Get(':id')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiOperation({
    summary: 'Get an order by ID',
    description: 'Get an order by ID for the authenticated tenant',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Return the order' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Order not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiOperation({
    summary: 'Update an order',
    description: 'Update an order for the authenticated tenant',
  })
  @ApiBody({ type: UpdateOrderDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order updated successfully',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Patch('items/:id/replace')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiOperation({
    summary: 'Propose order item replacement',
    description:
      'Set or clear merchant-proposed alternative for an order item pending customer decision',
  })
  @ApiBody({ type: ReplaceOrderItemDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order item replacement proposal updated successfully',
  })
  replaceOrderItem(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplaceOrderItemDto,
  ) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.ordersService.replaceOrderItem(
      tenantId,
      id,
      dto.replaced_by_product_id ?? null,
    );
  }

  @Patch('items/:id/replacement-reset')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiOperation({
    summary: 'Reset order item replacement decision',
    description:
      'Clears replacement decision and unlocks order item for a new customer replacement proposal',
  })
  @ApiBody({ type: ResetOrderItemReplacementDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order item replacement decision reset successfully',
  })
  resetOrderItemReplacement(
    @Req() req: { user?: { tenant_id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.ordersService.resetOrderItemReplacement(tenantId, id);
  }

  @Patch('tracking/:token/items/:itemId/replacement-decision')
  @ApiOperation({
    summary: 'Decide replacement item by tracking token',
    description:
      'Customer can approve or reject a pending replacement proposal for a specific order item',
  })
  @ApiBody({ type: DecideReplacementDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer replacement decision saved successfully',
  })
  decideReplacementByToken(
    @Param('token') token: string,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: DecideReplacementDto,
  ) {
    return this.ordersService.decideReplacementByPublicToken(
      token,
      itemId,
      dto.decision,
      dto.reason,
    );
  }

  @Patch('tracking/:token/reject')
  @ApiOperation({
    summary: 'Reject order by tracking token',
    description:
      'Customer can reject the entire order while status is draft or confirmed',
  })
  @ApiBody({ type: RejectOrderByCustomerDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order rejected by customer successfully',
  })
  rejectOrderByToken(
    @Param('token') token: string,
    @Body() dto: RejectOrderByCustomerDto,
  ) {
    return this.ordersService.rejectOrderByPublicToken(token, dto.reason);
  }

  @Patch('items/:id/price')
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiOperation({
    summary: 'Update order item price',
    description: 'Set merchant line price for a specific order item',
  })
  @ApiBody({ type: UpdateOrderItemPriceDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order item price updated successfully',
  })
  updateOrderItemPrice(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderItemPriceDto,
  ) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.ordersService.updateOrderItemPrice(
      tenantId,
      id,
      dto.total_price,
    );
  }

  private toStringArray(value?: string | string[]): string[] {
    if (Array.isArray(value)) {
      return value;
    }

    return typeof value === 'string' ? [value] : [];
  }
}
