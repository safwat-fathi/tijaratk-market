import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import CONSTANTS from 'src/common/constants';
import { AdminAuthGuard } from 'src/admin/guards/admin-auth.guard';
import { RequirePlatformAdmin } from 'src/admin/decorators/admin-role.decorator';
import { AdminManagedAccessService } from './admin-managed-access.service';
import { ManagedAdminRequest } from './admin-managed.types';
import {
  UpdateAdminActiveStatusDto,
  UpsertAdminTenantAccessDto,
} from './dto/admin-managed-access.dto';
import { AdminRole } from '../../generated/prisma/client';

/** Platform access administration and assigned-merchant discovery endpoints. */
@ApiTags('Admin Managed Access')
@ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminManagedAccessController {
  constructor(private readonly accessService: AdminManagedAccessService) {}

  /** Lists merchants assigned to the current operations administrator. */
  @Get('managed-tenants')
  @ApiOperation({ summary: 'List assigned managed tenants' })
  listAssignedTenants(@Req() request: ManagedAdminRequest) {
    return this.accessService.listAssignedTenants(request.user!.userId);
  }

  /** Returns merchant and current-assignment context before session start. */
  @Get('managed-tenants/:tenantId/context')
  @ApiOperation({ summary: 'Get manageable merchant context' })
  getMerchantContext(
    @Req() request: ManagedAdminRequest,
    @Param('tenantId', ParseIntPipe) tenantId: number,
  ) {
    return this.accessService.getMerchantContext(
      request.user!.userId,
      request.user!.role as AdminRole,
      tenantId,
    );
  }

  /** Lists existing administrators without credential fields. */
  @Get('admin-users')
  @RequirePlatformAdmin()
  @ApiOperation({ summary: 'List administrators for access assignment' })
  listAdministrators() {
    return this.accessService.listAdministrators();
  }

  /** Enables or disables an administrator account. */
  @Patch('admin-users/:adminUserId/status')
  @RequirePlatformAdmin()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Update administrator active status' })
  @ApiBody({ type: UpdateAdminActiveStatusDto })
  updateAdministratorStatus(
    @Req() request: ManagedAdminRequest,
    @Param('adminUserId', ParseIntPipe) adminUserId: number,
    @Body() dto: UpdateAdminActiveStatusDto,
  ) {
    return this.accessService.updateAdministratorActiveStatus(
      adminUserId,
      dto.is_active,
      request.user!.userId,
      this.accessService.getRequestMetadata(request),
    );
  }

  /** Lists tenant access assignments. */
  @Get('tenants/:tenantId/accesses')
  @RequirePlatformAdmin()
  @ApiOperation({ summary: 'List tenant administrator assignments' })
  listTenantAccesses(
    @Param('tenantId', ParseIntPipe) tenantId: number,
  ) {
    return this.accessService.listTenantAccesses(tenantId);
  }

  /** Creates, updates, or reactivates a tenant assignment. */
  @Put('tenants/:tenantId/accesses/:adminUserId')
  @RequirePlatformAdmin()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Upsert tenant administrator access' })
  @ApiBody({ type: UpsertAdminTenantAccessDto })
  upsertTenantAccess(
    @Req() request: ManagedAdminRequest,
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('adminUserId', ParseIntPipe) adminUserId: number,
    @Body() dto: UpsertAdminTenantAccessDto,
  ) {
    return this.accessService.upsertTenantAccess(
      tenantId,
      adminUserId,
      request.user!.userId,
      dto,
      this.accessService.getRequestMetadata(request),
    );
  }

  /** Revokes a tenant assignment and ends its active session. */
  @Delete('tenants/:tenantId/accesses/:adminUserId')
  @RequirePlatformAdmin()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Revoke tenant administrator access' })
  revokeTenantAccess(
    @Req() request: ManagedAdminRequest,
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Param('adminUserId', ParseIntPipe) adminUserId: number,
  ) {
    return this.accessService.revokeTenantAccess(
      tenantId,
      adminUserId,
      request.user!.userId,
      this.accessService.getRequestMetadata(request),
    );
  }

  /** Lists recent managed-store sessions for platform review. */
  @Get('tenants/:tenantId/management-sessions')
  @RequirePlatformAdmin()
  @ApiOperation({ summary: 'List tenant management sessions' })
  listTenantSessions(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Query('limit') limit?: string,
  ) {
    return this.accessService.listTenantSessions(
      tenantId,
      limit ? Number(limit) : 20,
    );
  }
}
