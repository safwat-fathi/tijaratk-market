import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({
    description: 'The admin phone number used for login',
    example: '+201112223334',
  })
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
