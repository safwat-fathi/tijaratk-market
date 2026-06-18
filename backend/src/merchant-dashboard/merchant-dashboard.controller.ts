import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import CONSTANTS from 'src/common/constants';
import { GetDashboardMeasurementsDto } from './dto/get-dashboard-measurements.dto';
import { MerchantDashboardService } from './merchant-dashboard.service';

@ApiTags('Merchant Dashboard')
@Controller('dashboard')
export class MerchantDashboardController {
  constructor(
    private readonly merchantDashboardService: MerchantDashboardService,
  ) {}

  @Get('measurements')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT))
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Get merchant dashboard MVP measurements' })
  getMeasurements(
    @Req() req: Request,
    @Query() query: GetDashboardMeasurementsDto,
  ) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    return this.merchantDashboardService.getMeasurements(
      tenantId,
      query.period,
    );
  }
}
