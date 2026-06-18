import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { Match } from 'src/common/decorators/match.decorator';
import { formatPhoneNumber } from 'src/common/utils/phone.util';
import { IsPhoneNumber } from 'src/common/validators/is-phone-number.validator';

export class VerifyPasswordResetDto {
  @ApiProperty({
    description: 'Merchant phone number',
    example: '+201112223334',
  })
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? formatPhoneNumber(value) : value,
  )
  @IsNotEmpty()
  @IsPhoneNumber({ allowedCountries: ['EG'] })
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  otp: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'password123' })
  @IsNotEmpty()
  @IsString()
  @Match('password', { message: 'Passwords do not match' })
  confirm_password: string;
}
