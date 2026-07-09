import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ACTIVITY_ENTITY_TYPE_VALUES,
  ActivityEntityType,
} from '../constants/activity-types';

/**
 * Query parameters for tenant activity log timeline reads.
 */
export class QueryActivityLogDto {
  @ApiPropertyOptional({
    description: 'Filter by entity type',
    enum: ACTIVITY_ENTITY_TYPE_VALUES,
  })
  @IsOptional()
  @IsIn(ACTIVITY_ENTITY_TYPE_VALUES)
  entity_type?: ActivityEntityType;

  @ApiPropertyOptional({ description: 'Filter by entity id', example: 123 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  entity_id?: number;

  @ApiPropertyOptional({
    description: 'Filter by activity action',
    example: 'order.status_changed',
  })
  @IsOptional()
  @IsString()
  @MaxLength(96)
  action?: string;

  @ApiPropertyOptional({
    description: 'Pagination cursor. Returns rows with id lower than cursor.',
    example: 1000,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  cursor?: number;

  @ApiPropertyOptional({
    description: 'Page size',
    default: 20,
    maximum: 50,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
