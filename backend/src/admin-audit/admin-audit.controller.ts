import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAuthGuard } from 'src/admin/guards/admin-auth.guard';
import { RequirePlatformAdmin } from 'src/admin/decorators/admin-role.decorator';
import CONSTANTS from 'src/common/constants';
import { AdminAuditService } from './admin-audit.service';
import { QueryAdminAuditLogDto } from './dto/query-admin-audit-log.dto';
import { AdminAuditLogListResponseDto } from './dto/admin-audit-response.dto';

/** Platform-only administrator audit timeline endpoints. */
@ApiTags('Admin Activity Audit')
@ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
@Controller('admin/activity-logs')
@UseGuards(AdminAuthGuard)
@RequirePlatformAdmin()
export class AdminAuditController {
  constructor(private readonly adminAuditService: AdminAuditService) {}

  /** Lists immutable administrator audit events with cursor pagination. */
  @Get()
  @ApiOperation({ summary: 'List platform administrator audit events' })
  @ApiResponse({
    status: 200,
    description: 'Audit events returned successfully',
    type: AdminAuditLogListResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Platform administrator required' })
  findAll(@Query() query: QueryAdminAuditLogDto) {
    return this.adminAuditService.findAll({
      adminId: query.admin_id,
      role: query.role,
      tenantId: query.tenant_id,
      action: query.action,
      outcome: query.outcome,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      cursor: query.cursor,
      limit: query.limit,
    });
  }
}
