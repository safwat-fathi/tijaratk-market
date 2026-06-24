import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class UpdateTenantOnboardingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onboarding_completed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  onboarding_step?: number;
}
