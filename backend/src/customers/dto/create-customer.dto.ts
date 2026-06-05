import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { formatPhoneNumber } from 'src/common/utils/phone.util';
import { IsPhoneNumber } from 'src/common/validators/is-phone-number.validator';

export class CreateCustomerDto {
  @ApiProperty()
  @Transform(({ value }) =>
    typeof value === 'string' ? formatPhoneNumber(value) : value,
  )
  @IsString()
  @IsPhoneNumber({ allowedCountries: ['EG'] })
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
