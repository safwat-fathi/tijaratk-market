import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsNotEmpty, IsString } from 'class-validator';

/**
 * Resends a code for an authenticated phone-change challenge.
 */
export class ResendPhoneChangeDto {
  @ApiProperty({ description: 'Signed phone-change challenge' })
  @IsString()
  @IsNotEmpty()
  @IsJWT()
  challengeToken: string;
}
