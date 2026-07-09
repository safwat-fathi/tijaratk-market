import {
  Controller,
  Get,
  HttpStatus,
  Query,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import CONSTANTS from 'src/common/constants';
import { ActivityLogService } from './activity-log.service';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';

type AuthenticatedUser = {
  userId?: number;
  tenant_id?: number;
  role?: string;
};

/**
 * Merchant activity log read endpoints.
 */
@ApiTags('Activity Logs')
@Controller('activity-logs')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  /**
   * Lists activity logs for the authenticated merchant tenant.
   */
  @Get()
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Get merchant activity logs',
    description:
      'Returns tenant-scoped activity logs with cursor pagination and optional entity/action filters.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Activity logs returned successfully',
  })
  findTenantLogs(
    @Request() req: { user?: AuthenticatedUser },
    @Query() query: QueryActivityLogDto,
  ) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.activityLogService.findTenantLogs({
      tenantId,
      userRole: req.user?.role,
      entityType: query.entity_type,
      entityId: query.entity_id,
      action: query.action,
      cursor: query.cursor,
      limit: query.limit,
    });
  }
}

