import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddBulkEssentialItemsDto {
  @ApiPropertyOptional({ description: 'Single category title for item-level import' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Catalog item IDs selected from the category stage' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  catalog_item_ids?: number[];

  @ApiPropertyOptional({ description: 'Legacy list of category titles to import' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];
}
