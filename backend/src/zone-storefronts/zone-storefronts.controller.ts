import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AdminActorContext, ManagedAdminRequest } from 'src/admin-managed/admin-managed.types';
import { ADMIN_MANAGED_PERMISSIONS } from 'src/admin-managed/constants/admin-managed-permissions';
import { CurrentAdminActor } from 'src/admin-managed/decorators/current-admin-actor.decorator';
import { RequireManagedPermissions } from 'src/admin-managed/decorators/managed-policy.decorator';
import { ManagedTenantGuard } from 'src/admin-managed/guards/managed-tenant.guard';
import { RequirePlatformAdmin } from 'src/admin/decorators/admin-role.decorator';
import { AdminAuthGuard } from 'src/admin/guards/admin-auth.guard';
import CONSTANTS from 'src/common/constants';
import { UploadFile } from 'src/common/decorators/upload-file.decorator';
import { prescriptionFileFilter } from 'src/common/utils/file-filters';
import { CreateOrderDto } from 'src/orders/dto/create-order.dto';
import { GetPublicProductsDto } from 'src/products/dto/get-public-products.dto';
import {
  AcceptOrderDispatchDto,
  AssignOrderDispatchDto,
  CancelOrderDispatchDto,
  CreateZoneStorefrontDto,
  RejectOrderDispatchDto,
  UpdateAssignedOrderReplacementDto,
  UpdateAssignedOrderStatusDto,
  UpdateDispatchQuoteLineDto,
  UpdateZoneDeliveryFeesDto,
  UpdateZoneOperatingHoursDto,
  UpdateZoneStorefrontActivationDto,
  UpsertZoneStorefrontMerchantDto,
} from './dto/zone-storefront.dto';
import { OrderDispatchService } from './order-dispatch.service';
import { ZoneStorefrontsService } from './zone-storefronts.service';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { MetaConversionsService } from 'src/meta-conversions/meta-conversions.service';

/** Public customer-safe zone storefront endpoints. */
@ApiTags('Zone Storefronts')
@Controller('zone-storefronts')
export class ZoneStorefrontsController {
  constructor(
    private readonly zoneStorefrontsService: ZoneStorefrontsService,
    private readonly orderDispatchService: OrderDispatchService,
    private readonly metaConversionsService: MetaConversionsService,
  ) {}

  /** Lists sanitized active and ready zones for public discovery. */
  @Get('public')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'List public zone storefronts' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Public zones returned' })
  findPublicZones() {
    return this.zoneStorefrontsService.findPublic();
  }

  /** Returns sanitized public zone identity and delivery configuration. */
  @Get('public/:slug')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get a public zone storefront' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Public zone returned' })
  findPublic(@Param('slug') slug: string) {
    return this.zoneStorefrontsService.findPublicBySlug(slug);
  }

  /** Returns authoritative Cairo-time ordering mode and valid scheduled slots. */
  @Get('public/:slug/delivery-availability')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get zone delivery availability' })
  findDeliveryAvailability(@Param('slug') slug: string) {
    return this.zoneStorefrontsService.findDeliveryAvailability(slug);
  }

  /** Returns paginated catalog products from the operator tenant only. */
  @Get('public/:slug/products')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'List public zone products' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Zone products returned' })
  findProducts(
    @Param('slug') slug: string,
    @Query() query: GetPublicProductsDto,
  ) {
    return this.zoneStorefrontsService.findPublicProducts(slug, query);
  }

  /** Returns category summaries scoped to the zone catalog source. */
  @Get('public/:slug/categories')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'List public zone categories' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Zone categories returned' })
  findCategories(@Param('slug') slug: string) {
    return this.zoneStorefrontsService.findPublicCategories(slug);
  }

  /** Creates a zone order and pending dispatch in one transaction. */
  @Post('public/:slug/orders')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiOperation({ summary: 'Create a public zone order' })
  @ApiBody({ type: CreateOrderDto })
  @UploadFile('prescription_file', {
    dest: join(process.cwd(), 'uploads', 'prescriptions'),
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'prescriptions'),
      filename: (_request, file, callback) => {
        callback(
          null,
          `zone-prescription-${Date.now()}-${randomUUID()}${extname(file.originalname || '').toLowerCase()}`,
        );
      },
    }),
    fileFilter: prescriptionFileFilter,
    limits: { fileSize: CONSTANTS.UPLOAD.MAX_IMAGE_SIZE_BYTES },
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Zone order created' })
  createOrder(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Body() dto: CreateOrderDto,
    @UploadedFile() prescriptionFile?: Express.Multer.File,
  ) {
    return this.orderDispatchService.createPublicOrder(
      slug,
      dto,
      prescriptionFile,
      this.metaConversionsService.buildTrackingContext(
        request,
        'zone',
        `/market/${encodeURIComponent(slug)}`,
      ),
    );
  }
}

/** Platform administration endpoints for zones and merchant membership. */
@ApiTags('Admin Zones')
@ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
@Controller('admin/zones')
@UseGuards(AdminAuthGuard)
@RequirePlatformAdmin()
export class AdminZoneStorefrontsController {
  constructor(private readonly zones: ZoneStorefrontsService) {}

  /** Lists zones with catalog and merchant readiness. */
  @Get()
  @ApiOperation({ summary: 'List zone storefronts' })
  findAll() {
    return this.zones.findAllForAdmin();
  }

  /** Creates a zone and its userless internal operator tenant. */
  @Post()
  @ApiOperation({ summary: 'Create a zone storefront' })
  @ApiBody({ type: CreateZoneStorefrontDto })
  create(
    @Req() request: ManagedAdminRequest,
    @Body() dto: CreateZoneStorefrontDto,
  ) {
    return this.zones.create(dto, this.toAdminActor(request));
  }

  /** Returns zone configuration and membership details. */
  @Get(':zoneId')
  @ApiOperation({ summary: 'Get zone storefront details' })
  findOne(@Param('zoneId', ParseIntPipe) zoneId: number) {
    return this.zones.findOneForAdmin(zoneId);
  }

  /** Synchronizes the complete curated essential catalog into the zone. */
  @Post(':zoneId/catalog/sync-essentials')
  @ApiOperation({ summary: 'Synchronize curated essentials into a zone' })
  syncEssentials(
    @Req() request: ManagedAdminRequest,
    @Param('zoneId', ParseIntPipe) zoneId: number,
  ) {
    return this.zones.syncEssentialCatalog(
      zoneId,
      this.toAdminActor(request),
    );
  }

  /** Lists backend-verified merchant assignment candidates. */
  @Get(':zoneId/eligible-merchants')
  @ApiOperation({ summary: 'List eligible zone merchants' })
  findEligible(@Param('zoneId', ParseIntPipe) zoneId: number) {
    return this.zones.findEligibleMerchants(zoneId);
  }

  /** Activates or disables new public ordering without deleting history. */
  @Patch(':zoneId/activation')
  @ApiOperation({ summary: 'Update zone activation' })
  @ApiBody({ type: UpdateZoneStorefrontActivationDto })
  updateActivation(
    @Req() request: ManagedAdminRequest,
    @Param('zoneId', ParseIntPipe) zoneId: number,
    @Body() dto: UpdateZoneStorefrontActivationDto,
  ) {
    return this.zones.updateActivation(
      zoneId,
      dto,
      this.toAdminActor(request),
    );
  }

  /** Replaces every active direct child's delivery fee atomically. */
  @Patch(':zoneId/delivery-fees')
  @ApiOperation({ summary: 'Update all zone child delivery fees' })
  @ApiBody({ type: UpdateZoneDeliveryFeesDto })
  updateDeliveryFees(
    @Req() request: ManagedAdminRequest,
    @Param('zoneId', ParseIntPipe) zoneId: number,
    @Body() dto: UpdateZoneDeliveryFeesDto,
  ) {
    return this.zones.updateDeliveryFees(
      zoneId,
      dto,
      this.toAdminActor(request),
    );
  }

  /** Updates the required daily same-day operating window. */
  @Patch(':zoneId/operating-hours')
  @ApiOperation({ summary: 'Update zone operating hours' })
  @ApiBody({ type: UpdateZoneOperatingHoursDto })
  updateOperatingHours(
    @Req() request: ManagedAdminRequest,
    @Param('zoneId', ParseIntPipe) zoneId: number,
    @Body() dto: UpdateZoneOperatingHoursDto,
  ) {
    return this.zones.updateOperatingHours(
      zoneId,
      dto,
      this.toAdminActor(request),
    );
  }

  /** Creates, reprioritizes, enables, or disables one zone membership. */
  @Post(':zoneId/merchants')
  @ApiOperation({ summary: 'Upsert zone merchant membership' })
  @ApiBody({ type: UpsertZoneStorefrontMerchantDto })
  upsertMerchant(
    @Req() request: ManagedAdminRequest,
    @Param('zoneId', ParseIntPipe) zoneId: number,
    @Body() dto: UpsertZoneStorefrontMerchantDto,
  ) {
    return this.zones.upsertMerchant(
      zoneId,
      dto,
      this.toAdminActor(request),
    );
  }

  /** Maps authenticated platform state to trusted activity attribution. */
  private toAdminActor(request: ManagedAdminRequest) {
    if (!request.user) throw new UnauthorizedException();
    return {
      adminId: request.user.userId,
      adminName: request.user.name,
      adminRole: request.user.role,
      requestId: request.requestId,
      ipAddress: request.ip,
    };
  }
}

/** Managed-session dispatch queue and manual assignment endpoints. */
@ApiTags('Admin Managed Zone Dispatches')
@ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
@Controller('admin/managed-tenants/:tenantId/zone-dispatches')
@UseGuards(AdminAuthGuard, ManagedTenantGuard)
export class ManagedZoneDispatchesController {
  constructor(private readonly dispatches: OrderDispatchService) {}

  /** Returns session-scoped zone identity and verified assignment candidates. */
  @Get('context')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.DispatchesRead)
  @ApiOperation({ summary: 'Get managed zone dispatch context' })
  findContext(@CurrentAdminActor() actor: AdminActorContext) {
    return this.dispatches.findManagedContext(actor);
  }

  /** Lists the operator tenant dispatch queue. */
  @Get()
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.DispatchesRead)
  @ApiOperation({ summary: 'List managed zone dispatches' })
  findAll(
    @CurrentAdminActor() actor: AdminActorContext,
    @Query('status') status?: string,
  ) {
    return this.dispatches.findManagedQueue(actor, status);
  }

  /** Returns one dispatch with assignment history. */
  @Get(':dispatchId')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.DispatchesRead)
  @ApiOperation({ summary: 'Get managed zone dispatch' })
  findOne(
    @CurrentAdminActor() actor: AdminActorContext,
    @Param('dispatchId', ParseIntPipe) dispatchId: number,
  ) {
    return this.dispatches.findManagedDispatch(actor, dispatchId);
  }

  /** Assigns or reassigns a dispatch with optimistic concurrency. */
  @Post(':dispatchId/assign')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.DispatchesAssign)
  @ApiOperation({ summary: 'Assign a zone dispatch' })
  @ApiBody({ type: AssignOrderDispatchDto })
  assign(
    @CurrentAdminActor() actor: AdminActorContext,
    @Param('dispatchId', ParseIntPipe) dispatchId: number,
    @Body() dto: AssignOrderDispatchDto,
  ) {
    return this.dispatches.assign(actor, dispatchId, dto);
  }

  /** Cancels a dispatch and operator-owned order together. */
  @Post(':dispatchId/cancel')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.DispatchesCancel)
  @ApiOperation({ summary: 'Cancel a zone dispatch' })
  @ApiBody({ type: CancelOrderDispatchDto })
  cancel(
    @CurrentAdminActor() actor: AdminActorContext,
    @Param('dispatchId', ParseIntPipe) dispatchId: number,
    @Body() dto: CancelOrderDispatchDto,
  ) {
    return this.dispatches.cancel(actor, dispatchId, dto);
  }
}

/** Merchant-only fulfillment APIs kept separate from normal merchant orders. */
@ApiTags('Assigned Orders')
@ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
@Controller('assigned-orders')
@UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
export class AssignedOrdersController {
  constructor(private readonly dispatches: OrderDispatchService) {}

  /** Lists current assignments for the authenticated merchant tenant. */
  @Get()
  @ApiOperation({ summary: 'List assigned zone orders' })
  findAll(@Req() request: Request) {
    return this.dispatches.findAssignedOrders(this.toMerchantActor(request));
  }

  /** Returns one current assignment with fulfillment-only customer fields. */
  @Get(':dispatchId')
  @ApiOperation({ summary: 'Get assigned zone order' })
  findOne(
    @Req() request: Request,
    @Param('dispatchId', ParseIntPipe) dispatchId: number,
  ) {
    return this.dispatches.findAssignedOrder(
      this.toMerchantActor(request),
      dispatchId,
    );
  }

  /** Lists sanitized central-catalog products for accepted replacements. */
  @Get(':dispatchId/replacement-products')
  @ApiOperation({ summary: 'List replacement products for an assigned order' })
  findReplacementProducts(
    @Req() request: Request,
    @Param('dispatchId', ParseIntPipe) dispatchId: number,
    @Query('search') search?: string,
  ) {
    return this.dispatches.findReplacementProducts(
      this.toMerchantActor(request),
      dispatchId,
      search,
    );
  }

  /** Updates an assignment-scoped quote line before acceptance. */
  @Patch(':dispatchId/items/:itemId/quote')
  @ApiOperation({ summary: 'Update assigned order quote line' })
  @ApiBody({ type: UpdateDispatchQuoteLineDto })
  updateQuote(
    @Req() request: Request,
    @Param('dispatchId', ParseIntPipe) dispatchId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateDispatchQuoteLineDto,
  ) {
    return this.dispatches.updateQuoteLine(
      this.toMerchantActor(request),
      dispatchId,
      itemId,
      dto,
    );
  }

  /** Accepts and locks pricing for the current assignment. */
  @Post(':dispatchId/accept')
  @ApiOperation({ summary: 'Accept assigned zone order' })
  @ApiBody({ type: AcceptOrderDispatchDto })
  accept(
    @Req() request: Request,
    @Param('dispatchId', ParseIntPipe) dispatchId: number,
    @Body() dto: AcceptOrderDispatchDto,
  ) {
    return this.dispatches.acceptAssignment(
      this.toMerchantActor(request),
      dispatchId,
      dto,
    );
  }

  /** Rejects the assignment with a required operational reason. */
  @Post(':dispatchId/reject')
  @ApiOperation({ summary: 'Reject assigned zone order' })
  @ApiBody({ type: RejectOrderDispatchDto })
  reject(
    @Req() request: Request,
    @Param('dispatchId', ParseIntPipe) dispatchId: number,
    @Body() dto: RejectOrderDispatchDto,
  ) {
    return this.dispatches.rejectAssignment(
      this.toMerchantActor(request),
      dispatchId,
      dto,
    );
  }

  /** Progresses accepted fulfillment without allowing direct cancellation. */
  @Patch(':dispatchId/status')
  @ApiOperation({ summary: 'Update assigned order fulfillment status' })
  @ApiBody({ type: UpdateAssignedOrderStatusDto })
  updateStatus(
    @Req() request: Request,
    @Param('dispatchId', ParseIntPipe) dispatchId: number,
    @Body() dto: UpdateAssignedOrderStatusDto,
  ) {
    return this.dispatches.updateAssignedStatus(
      this.toMerchantActor(request),
      dispatchId,
      dto,
    );
  }

  /** Proposes or clears a customer-visible replacement. */
  @Patch(':dispatchId/items/:itemId/replacement')
  @ApiOperation({ summary: 'Update assigned order replacement' })
  @ApiBody({ type: UpdateAssignedOrderReplacementDto })
  updateReplacement(
    @Req() request: Request,
    @Param('dispatchId', ParseIntPipe) dispatchId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateAssignedOrderReplacementDto,
  ) {
    return this.dispatches.updateAssignedReplacement(
      this.toMerchantActor(request),
      dispatchId,
      itemId,
      dto,
    );
  }

  /** Resets a customer replacement decision for another proposal. */
  @Post(':dispatchId/items/:itemId/replacement/reset')
  @ApiOperation({ summary: 'Reset assigned order replacement' })
  resetReplacement(
    @Req() request: Request,
    @Param('dispatchId', ParseIntPipe) dispatchId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.dispatches.resetAssignedReplacement(
      this.toMerchantActor(request),
      dispatchId,
      itemId,
    );
  }

  /** Extracts trusted tenant and user identity from the JWT strategy. */
  private toMerchantActor(request: Request) {
    const tenantId = request.user?.tenant_id;
    const userId = request.user?.userId;
    if (!tenantId || !userId) throw new UnauthorizedException();
    return { tenantId, userId };
  }
}
