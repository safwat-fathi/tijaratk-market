import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class TogglePlanStatusDto {
  @ApiProperty({
    description: 'Whether the subscription plan is active or inactive',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  is_active: boolean;
}
