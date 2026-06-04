import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class UpdateTenantPlanDto {
  @ApiProperty({
    description: 'The ID of the subscription plan to assign to the tenant',
    example: 1,
  })
  @IsNumber()
  plan_id: number;
}
