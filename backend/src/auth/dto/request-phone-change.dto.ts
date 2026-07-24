import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { formatPhoneNumber } from 'src/common/utils/phone.util';
import { IsPhoneNumber } from 'src/common/validators/is-phone-number.validator';

/**
 * Starts an authenticated merchant-owner phone change.
 */
export class RequestPhoneChangeDto {
  @ApiProperty({ description: 'Current merchant password' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    description: 'New Egyptian login and store contact number',
    example: '+201112223334',
  })
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? formatPhoneNumber(value) : value,
  )
  @IsNotEmpty()
  @IsPhoneNumber({ allowedCountries: ['EG'] })
  newPhone: string;
}
