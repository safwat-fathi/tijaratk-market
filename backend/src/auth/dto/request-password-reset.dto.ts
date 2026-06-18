import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsNotEmpty } from 'class-validator';
import { formatPhoneNumber } from 'src/common/utils/phone.util';
import { IsPhoneNumber } from 'src/common/validators/is-phone-number.validator';

export class RequestPasswordResetDto {
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
}
