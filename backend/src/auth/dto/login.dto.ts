import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { IsPhoneNumber } from 'src/common/validators/is-phone-number.validator';
import { Transform } from 'class-transformer';
import { formatPhoneNumber } from 'src/common/utils/phone.util';

export class LoginDto {
  @ApiProperty({
    description: 'The phone number of the user',
    example: '+201112223334',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? formatPhoneNumber(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  @IsPhoneNumber({ allowedCountries: ['EG'] })
  phone: string;

  @ApiProperty({
    description: 'The password of the user',
    example: 'password123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  pass: string;
}
