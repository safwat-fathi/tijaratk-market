import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { DirectoryEventType } from '../../../generated/prisma/client';

/**
 * Payload for recording a public stores directory event.
 */
export class CreateDirectoryEventDto {
  @ApiProperty({
    enum: DirectoryEventType,
    example: DirectoryEventType.store_click,
  })
  @IsEnum(DirectoryEventType)
  event_type: DirectoryEventType;

  @ApiPropertyOptional({ example: 'khair-supermarket' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  tenant_slug?: string;

  @ApiPropertyOptional({ example: 'sheikh-zayed' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  area_slug?: string;

  @ApiPropertyOptional({ example: 'supermarkets' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category_slug?: string;

  @ApiPropertyOptional({ example: 'visitor-123' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  visitor_key?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
