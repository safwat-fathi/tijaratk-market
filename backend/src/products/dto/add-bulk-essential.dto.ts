import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class AddBulkEssentialItemsDto {
  @ApiProperty({ description: 'List of English category titles to import' })
  @IsArray()
  @IsString({ each: true })
  categories: string[];
}
