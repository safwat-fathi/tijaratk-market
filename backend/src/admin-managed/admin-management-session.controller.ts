import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AdminManagementSessionEndReason } from '../../generated/prisma/client';
import { AdminAuthGuard } from 'src/admin/guards/admin-auth.guard';
import CONSTANTS from 'src/common/constants';
import { AdminManagedAccessService } from './admin-managed-access.service';
import { ManagedAdminRequest } from './admin-managed.types';
import { StartAdminManagementSessionDto } from './dto/admin-managed-access.dto';

/** Starts, resolves, and explicitly terminates managed-store sessions. */
@ApiTags('Admin Management Sessions')
@ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
@Controller('admin/management-sessions')
@UseGuards(AdminAuthGuard)
export class AdminManagementSessionController {
  constructor(private readonly accessService: AdminManagedAccessService) {}

  /** Starts a session and returns its opaque token once. */
  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Start a managed-store session' })
  @ApiBody({ type: StartAdminManagementSessionDto })
  startSession(
    @Req() request: ManagedAdminRequest,
    @Body() dto: StartAdminManagementSessionDto,
  ) {
    return this.accessService.startSession(
      request.user!.userId,
      dto,
      this.accessService.getRequestMetadata(request),
    );
  }

  /** Returns the current cookie-backed session or null. */
  @Get('current')
  @ApiOperation({ summary: 'Get current managed-store session' })
  getCurrent(@Req() request: ManagedAdminRequest) {
    return this.accessService.getCurrentSession(
      request.user!.userId,
      this.accessService.extractSessionToken(request),
      this.accessService.getRequestMetadata(request),
    );
  }

  /** Ends the current managed-store session. */
  @Delete('current')
  @ApiOperation({ summary: 'End current managed-store session' })
  endCurrent(@Req() request: ManagedAdminRequest) {
    return this.accessService.endCurrentSession(
      request.user!.userId,
      this.accessService.extractSessionToken(request),
      AdminManagementSessionEndReason.user_exit,
      this.accessService.getRequestMetadata(request),
    );
  }
}
