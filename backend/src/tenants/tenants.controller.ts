import {
  Controller,
  Body,
  Get,
  Param,
  Patch,
  NotFoundException,
  ForbiddenException,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import CONSTANTS from 'src/common/constants';
import { TenantsService } from './tenants.service';
import { UpdateTenantDeliverySettingsDto } from './dto/update-tenant-delivery-settings.dto';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { UpdateTenantOnboardingDto } from './dto/update-tenant-onboarding.dto';
import { TenantStatus } from '../../generated/prisma/client';
import { StorefrontOrderAvailabilityDto } from './dto/storefront-order-availability.dto';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Get authenticated tenant details' })
  @ApiResponse({
    status: 200,
    description: 'Return authenticated tenant details',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async findMe(@Req() req: Request) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    const tenant = await this.tenantsService.findOneById(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant with id ${tenantId} not found`);
    }

    return tenant;
  }

  @Patch('me/delivery')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Update authenticated tenant delivery settings' })
  @ApiBody({ type: UpdateTenantDeliverySettingsDto })
  @ApiResponse({
    status: 200,
    description: 'Delivery settings updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateMyDeliverySettings(
    @Req() req: Request,
    @Body() dto: UpdateTenantDeliverySettingsDto,
  ) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.tenantsService.updateDeliverySettings(tenantId, dto);
  }

  @Patch('me/general')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Update authenticated tenant general settings' })
  @ApiBody({ type: UpdateTenantSettingsDto })
  @ApiResponse({
    status: 200,
    description: 'General settings updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateMyGeneralSettings(
    @Req() req: Request,
    @Body() dto: UpdateTenantSettingsDto,
  ) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.tenantsService.updateGeneralSettings(tenantId, dto);
  }

  @Patch('me/onboarding')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Update authenticated tenant onboarding progress' })
  @ApiBody({ type: UpdateTenantOnboardingDto })
  @ApiResponse({
    status: 200,
    description: 'Onboarding progress updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateMyOnboardingProgress(
    @Req() req: Request,
    @Body() dto: UpdateTenantOnboardingDto,
  ) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.tenantsService.updateOnboardingProgress(tenantId, dto);
  }

  @Get('public/:slug')
  @ApiOperation({ summary: 'Get tenant details by slug (Public)' })
  @ApiResponse({ status: 200, description: 'Return tenant details' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async findOneBySlug(@Param('slug') slug: string) {
    const tenant = await this.tenantsService.findOneBySlug(slug);
    if (!tenant) {
      throw new NotFoundException(`Tenant with slug ${slug} not found`);
    }

    if (tenant.operated_zone_storefront) {
      throw new NotFoundException(`Tenant with slug ${slug} not found`);
    }

    if (tenant.status !== TenantStatus.active) {
      throw new ForbiddenException('هذا المتجر غير متاح حاليا');
    }

    return tenant;
  }

  @Get('public/:slug/order-availability')
  @ApiOperation({ summary: 'Get public merchant order availability' })
  @ApiResponse({
    status: 200,
    description: 'Current storefront order availability returned successfully',
    type: StorefrontOrderAvailabilityDto,
  })
  @ApiResponse({ status: 403, description: 'Tenant is not publicly available' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async findOrderAvailability(
    @Param('slug') slug: string,
  ): Promise<StorefrontOrderAvailabilityDto> {
    const tenant = await this.tenantsService.findOneBySlug(slug);
    if (!tenant || tenant.operated_zone_storefront) {
      throw new NotFoundException(`Tenant with slug ${slug} not found`);
    }
    if (tenant.status !== TenantStatus.active) {
      throw new ForbiddenException('هذا المتجر غير متاح حاليا');
    }

    return this.tenantsService.getStorefrontOrderAvailability(tenant);
  }

  @Get('public/:slug/delivery-availability')
  @ApiOperation({ summary: 'Get public merchant delivery availability' })
  async findDeliveryAvailability(@Param('slug') slug: string) {
    const tenant = await this.tenantsService.findOneBySlug(slug);
    if (!tenant || tenant.operated_zone_storefront) {
      throw new NotFoundException(`Tenant with slug ${slug} not found`);
    }
    if (tenant.status !== TenantStatus.active) {
      throw new ForbiddenException('هذا المتجر غير متاح حاليا');
    }
    return this.tenantsService.getDeliveryAvailability(tenant);
  }
}
