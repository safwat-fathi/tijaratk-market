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
import { TenantStatus } from '../../generated/prisma/client';

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

  @Get('public/:slug')
  @ApiOperation({ summary: 'Get tenant details by slug (Public)' })
  @ApiResponse({ status: 200, description: 'Return tenant details' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async findOneBySlug(@Param('slug') slug: string) {
    const tenant = await this.tenantsService.findOneBySlug(slug);
    if (!tenant) {
      throw new NotFoundException(`Tenant with slug ${slug} not found`);
    }

    if (tenant.status === TenantStatus.suspended) {
      throw new ForbiddenException('هذا المتجر غير متاح حاليا');
    }

    return tenant;
  }
}
