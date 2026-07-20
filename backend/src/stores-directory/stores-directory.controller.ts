import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import CONSTANTS from 'src/common/constants';
import { AdminAuthGuard } from 'src/admin/guards/admin-auth.guard';
import { RequirePlatformAdmin } from 'src/admin/decorators/admin-role.decorator';
import { StoresDirectoryService } from './stores-directory.service';
import {
  DirectoryAreasQueryDto,
  DirectoryCategoryStoresQueryDto,
} from './dto/stores-directory-query.dto';
import { CreateDirectoryEventDto } from './dto/create-directory-event.dto';
import { UpdateDirectoryProfileDto } from './dto/update-directory-profile.dto';
import {
  AdminDirectoryAreasQueryDto,
  CreateDirectoryAreaDto,
  UpdateDirectoryAreaDto,
} from './dto/directory-area.dto';
import { DeliveryConfigurationService } from 'src/delivery-configuration/delivery-configuration.service';
import { UpdateDeliveryConfigurationDto } from 'src/delivery-configuration/dto/update-delivery-configuration.dto';

/**
 * Stores directory controller exposes public SEO directory and management APIs.
 */
@ApiTags('Stores Directory')
@Controller()
export class StoresDirectoryController {
  constructor(
    private readonly storesDirectoryService: StoresDirectoryService,
    private readonly deliveryConfigurationService: DeliveryConfigurationService,
  ) {}

  @Get('stores')
  @ApiOperation({ summary: 'Get stores directory landing payload' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Directory landing payload returned successfully',
  })
  getStoresLanding() {
    return this.storesDirectoryService.getStoresLanding();
  }

  @Get('stores/areas')
  @ApiOperation({ summary: 'Search active public main directory areas' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Public main directory areas returned successfully',
  })
  findAreas(@Query() query: DirectoryAreasQueryDto) {
    return this.storesDirectoryService.findAreas(query.search);
  }

  @Get('stores/areas/:areaSlug')
  @ApiOperation({
    summary: 'Get public stores directory main-area page payload',
  })
  @ApiParam({ name: 'areaSlug', example: 'sheikh-zayed' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Main-area page payload returned successfully',
  })
  getAreaPage(@Param('areaSlug') areaSlug: string) {
    return this.storesDirectoryService.getAreaPage(areaSlug);
  }

  @Get('stores/areas/:areaSlug/categories/:categorySlug')
  @ApiOperation({
    summary: 'Get public stores directory main-area category page payload',
  })
  @ApiParam({ name: 'areaSlug', example: 'sheikh-zayed' })
  @ApiParam({ name: 'categorySlug', example: 'supermarkets' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Main-area category page payload returned successfully',
  })
  getCategoryPage(
    @Param('areaSlug') areaSlug: string,
    @Param('categorySlug') categorySlug: string,
    @Query() query: DirectoryCategoryStoresQueryDto,
  ) {
    return this.storesDirectoryService.getCategoryPage(areaSlug, categorySlug, {
      search: query.search,
      openNow: query.open_now,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post('stores/events')
  @ApiOperation({ summary: 'Record a public stores directory event' })
  @ApiBody({ type: CreateDirectoryEventDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Directory event recorded successfully',
  })
  createEvent(@Body() dto: CreateDirectoryEventDto) {
    return this.storesDirectoryService.createEvent(dto);
  }

  @Get('merchant/directory-profile')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Get authenticated merchant directory profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Merchant directory profile returned successfully',
  })
  getMerchantProfile(@Req() req: Request) {
    return this.storesDirectoryService.getMerchantProfile(
      this.getTenantIdFromRequest(req),
    );
  }

  @Patch('merchant/directory-profile')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Update authenticated merchant directory profile' })
  @ApiBody({ type: UpdateDirectoryProfileDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Merchant directory profile updated successfully',
  })
  updateMerchantProfile(
    @Req() req: Request,
    @Body() dto: UpdateDirectoryProfileDto,
  ) {
    return this.storesDirectoryService.updateMerchantProfile(
      this.getTenantIdFromRequest(req),
      dto,
    );
  }

  @Get('merchant/areas')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Get active directory areas for merchant selection' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Directory areas returned successfully',
  })
  merchantFindAreas() {
    return this.storesDirectoryService.merchantFindAreas();
  }

  @Get('admin/directory/areas')
  @UseGuards(AdminAuthGuard)
  @RequirePlatformAdmin()
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Get directory areas for admin management' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Directory areas returned successfully',
  })
  adminFindAreas(@Query() query: AdminDirectoryAreasQueryDto) {
    return this.storesDirectoryService.adminFindAreas(query);
  }

  @Post('admin/directory/areas')
  @UseGuards(AdminAuthGuard)
  @RequirePlatformAdmin()
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Create a directory area' })
  @ApiBody({ type: CreateDirectoryAreaDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Directory area created successfully',
  })
  adminCreateArea(@Body() dto: CreateDirectoryAreaDto) {
    return this.storesDirectoryService.adminCreateArea(dto);
  }

  @Patch('admin/directory/areas/:id')
  @UseGuards(AdminAuthGuard)
  @RequirePlatformAdmin()
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Update a directory area' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateDirectoryAreaDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Directory area updated successfully',
  })
  adminUpdateArea(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDirectoryAreaDto,
  ) {
    return this.storesDirectoryService.adminUpdateArea(id, dto);
  }

  @Delete('admin/directory/areas/:id')
  @UseGuards(AdminAuthGuard)
  @RequirePlatformAdmin()
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Delete a directory area' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Directory area deleted successfully',
  })
  adminDeleteArea(@Param('id', ParseIntPipe) id: number) {
    return this.storesDirectoryService.adminDeleteArea(id);
  }

  @Patch('admin/tenants/:tenantId/directory-profile')
  @UseGuards(AdminAuthGuard)
  @RequirePlatformAdmin()
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Update tenant directory profile as admin' })
  @ApiParam({ name: 'tenantId', type: Number })
  @ApiBody({ type: UpdateDirectoryProfileDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tenant directory profile updated successfully',
  })
  adminUpdateTenantProfile(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: UpdateDirectoryProfileDto,
  ) {
    return this.storesDirectoryService.adminUpdateTenantProfile(tenantId, dto);
  }

  @Patch('admin/tenants/:tenantId/delivery-configuration')
  @UseGuards(AdminAuthGuard)
  @RequirePlatformAdmin()
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Update tenant delivery zones and fees as admin' })
  @ApiParam({ name: 'tenantId', type: Number })
  @ApiBody({ type: UpdateDeliveryConfigurationDto })
  adminUpdateTenantDeliveryConfiguration(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Body() dto: UpdateDeliveryConfigurationDto,
  ) {
    return this.deliveryConfigurationService.updateConfiguration(
      tenantId,
      dto,
    );
  }

  private getTenantIdFromRequest(req: Request): number {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return tenantId;
  }
}
