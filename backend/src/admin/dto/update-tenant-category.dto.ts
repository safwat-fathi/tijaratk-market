import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { TenantCategory } from '../../../generated/prisma/client';

export class UpdateTenantCategoryDto {
  @ApiProperty({
    description: 'The target store category/type',
    enum: TenantCategory,
    example: TenantCategory.grocery,
  })
  @IsEnum(TenantCategory)
  @IsNotEmpty()
  category: TenantCategory;

  @ApiProperty({
    description: 'Force deactivate existing tenant products if store type changes',
    required: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  force_cleanup?: boolean;
}
