import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const DASHBOARD_PERIODS = ['today', '7d', '30d'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export class GetDashboardMeasurementsDto {
  @ApiPropertyOptional({
    enum: DASHBOARD_PERIODS,
    default: 'today',
  })
  @IsOptional()
  @IsIn(DASHBOARD_PERIODS)
  period?: DashboardPeriod;
}
