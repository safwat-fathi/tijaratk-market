import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { TenantCategory } from '../../../generated/prisma/client';

/**
 * Payload for merchant general settings updates.
 */
export class UpdateTenantSettingsDto {
  @ApiProperty({ example: 'My Awesome Store', description: 'Store name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: TenantCategory.grocery,
    enum: TenantCategory,
    description: 'Store category',
  })
  @IsEnum(TenantCategory)
  category: TenantCategory;
}
