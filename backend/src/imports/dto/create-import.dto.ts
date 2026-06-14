import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

const IMPORT_TYPES = ['catalog_items'] as const;
const IMPORT_MODES = [
  'create_only',
  'upsert',
  'update_only',
  'replace_source',
] as const;

export type CreateImportType = (typeof IMPORT_TYPES)[number];
export type CreateImportMode = (typeof IMPORT_MODES)[number];

/**
 * DTO for creating an admin import run from an uploaded file.
 */
export class CreateImportDto {
  @ApiProperty({ enum: IMPORT_TYPES, default: 'catalog_items' })
  @IsIn(IMPORT_TYPES)
  type: CreateImportType = 'catalog_items';

  @ApiProperty({ enum: IMPORT_MODES, default: 'upsert', required: false })
  @IsOptional()
  @IsIn(IMPORT_MODES)
  mode?: CreateImportMode = 'upsert';
}
