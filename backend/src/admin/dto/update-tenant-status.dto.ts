import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { TenantStatus } from '../../../generated/prisma/client';

export class UpdateTenantStatusDto {
  @ApiProperty({
    description: 'The status of the tenant',
    enum: TenantStatus,
    example: TenantStatus.active,
  })
  @IsEnum(TenantStatus)
  @IsNotEmpty()
  status: TenantStatus;
}
