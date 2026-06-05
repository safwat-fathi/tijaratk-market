import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { formatPhoneNumber } from 'src/common/utils/phone.util';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Match } from 'src/common/decorators/match.decorator';
import { IsPhoneNumber } from 'src/common/validators/is-phone-number.validator';
import {
  TENANT_CATEGORY_VALUES,
  TenantCategory,
} from 'src/tenants/constants/tenant-category';

export class SignupDto {
  @ApiProperty({
    example: 'My Awesome Store',
    description: 'The name of the store',
  })
  @IsNotEmpty()
  @IsString()
  storeName: string;

  @ApiProperty({
    example: 'Ahmed Mohamed',
    description: 'The name of the owner',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: '+201112223334',
    description: 'The phone number of the owner',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? formatPhoneNumber(value) : value,
  )
  @IsNotEmpty()
  @IsPhoneNumber({ allowedCountries: ['EG'] })
  phone: string;

  @ApiPropertyOptional({
    example: 'grocery',
    description: 'Store category',
    enum: TENANT_CATEGORY_VALUES,
  })
  @IsOptional()
  @IsString()
  @IsIn(TENANT_CATEGORY_VALUES)
  category?: TenantCategory;

  @ApiProperty({
    example: 'password123',
    description: 'The password for the account',
    minLength: 6,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    example: 'password123',
    description: 'Confirm password',
  })
  @IsNotEmpty()
  @IsString()
  @Match('password', { message: 'Passwords do not match' })
  confirm_password: string;
}
