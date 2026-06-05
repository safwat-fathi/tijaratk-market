import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { formatPhoneNumber } from 'src/common/utils/phone.util';

export class AdminLoginDto {
  @ApiProperty({
    description: 'The admin phone number used for login',
    example: '+201112223334',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? formatPhoneNumber(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: 'The admin password',
    example: 'adminPassword123',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
