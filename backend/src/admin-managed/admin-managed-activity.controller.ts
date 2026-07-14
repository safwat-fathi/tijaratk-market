import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from 'src/admin/guards/admin-auth.guard';
import CONSTANTS from 'src/common/constants';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { QueryActivityLogDto } from 'src/activity-log/dto/query-activity-log.dto';
import { ADMIN_MANAGED_PERMISSIONS } from './constants/admin-managed-permissions';
import { RequireManagedPermissions } from './decorators/managed-policy.decorator';
import { ManagedTenantGuard } from './guards/managed-tenant.guard';

/** Tenant-scoped activity timeline for managed-store administrators. */
@ApiTags('Admin Managed Activity')
@ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
@Controller('admin/managed-tenants/:tenantId/activity-logs')
@UseGuards(AdminAuthGuard, ManagedTenantGuard)
export class AdminManagedActivityController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  /** Lists sanitized tenant activity with stable cursor pagination. */
  @Get()
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.ActivityLogsRead)
  @ApiOperation({ summary: 'List managed tenant activity logs' })
  listActivity(
    @Param('tenantId', ParseIntPipe) tenantId: number,
    @Query() query: QueryActivityLogDto,
  ) {
    return this.activityLogService.findTenantLogsForAdmin({
      tenantId,
      entityType: query.entity_type,
      entityId: query.entity_id,
      action: query.action,
      cursor: query.cursor,
      limit: query.limit,
    });
  }
}
