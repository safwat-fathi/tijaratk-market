import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import CONSTANTS from 'src/common/constants';
import { AvailabilityRequestsService } from './availability-requests.service';
import { CreateAvailabilityRequestDto } from './dto/create-availability-request.dto';
import { GetAvailabilityRequests } from './dto/get-availability-requests/get-availability-requests';
import { GetAvailabilitySummaryDto } from './dto/get-availability-summary.dto';
import { Request } from 'express';

@ApiTags('Availability Requests')
@Controller('availability-requests')
export class AvailabilityRequestsController {
  constructor(
    private readonly availabilityRequestsService: AvailabilityRequestsService,
  ) {}

  @Post('public/:slug')
  @ApiOperation({
    summary: 'Create product availability request for a public storefront',
  })
  @ApiBody({ type: CreateAvailabilityRequestDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Availability request created successfully',
  })
  createPublic(
    @Param('slug') slug: string,
    @Body() dto: CreateAvailabilityRequestDto,
  ) {
    return this.availabilityRequestsService.createPublicBySlug(slug, dto);
  }

  @Get('merchant/summary')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'Get merchant availability requests summary',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Availability summary returned successfully',
  })
  getMerchantSummary(
    @Req() req: Request,
    @Query() query: GetAvailabilitySummaryDto,
  ) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.availabilityRequestsService.getMerchantSummary(
      tenantId,
      query.days,
      query.limit,
    );
  }

  @Get('merchant')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({
    summary: 'List merchant availability requests',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Availability requests returned successfully',
  })
  getMerchantRequests(
    @Req() req: Request,
    @Query() query: GetAvailabilityRequests,
  ) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.availabilityRequestsService.getMerchantRequests(
      tenantId,
      query,
    );
  }
}
