import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

/**
 * Verifies and commits an authenticated phone-change challenge.
 */
export class VerifyPhoneChangeDto {
  @ApiProperty({ description: 'Signed phone-change challenge' })
  @IsString()
  @IsNotEmpty()
  @IsJWT()
  challengeToken: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  otp: string;
}
