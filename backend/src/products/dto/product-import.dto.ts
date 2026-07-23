import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  Allow,
  IsInt,
  IsNotEmptyObject,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { parseJsonIfString } from './parse-json.transform';

/** Maps Tijaratk product fields to zero-based uploaded spreadsheet columns. */
export class ProductImportMappingDto {
  @ApiProperty({ minimum: 0, example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  name: number;

  @ApiProperty({ minimum: 0, example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  current_price: number;

  @ApiPropertyOptional({ minimum: 0, example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  category?: number;

  @ApiPropertyOptional({ minimum: 0, example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  image_url?: number;

  @ApiPropertyOptional({ minimum: 0, example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  is_available?: number;
}

/** Swagger request body for spreadsheet preview uploads. */
export class PreviewProductImportDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file: string;
}

/** Multipart request body for a mapped product spreadsheet import. */
export class ImportProductSpreadsheetDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  @Allow()
  file: string;

  @ApiProperty({
    type: 'string',
    description: 'JSON-encoded ProductImportMappingDto',
    example:
      '{"name":0,"current_price":1,"category":2,"image_url":3,"is_available":4}',
  })
  @Transform(
    ({ value }: { value: unknown }) =>
      plainToInstance(
        ProductImportMappingDto,
        parseJsonIfString(value),
      ),
    { toClassOnly: true },
  )
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => ProductImportMappingDto)
  mapping: ProductImportMappingDto;
}
