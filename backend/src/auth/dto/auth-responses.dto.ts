import { ApiProperty } from '@nestjs/swagger';

/**
 * Standard result for completed merchant credential changes.
 */
export class CredentialChangeResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Credential updated successfully' })
  message: string;
}

/**
 * Result returned after starting or resending a phone change.
 */
export class PhoneChangeChallengeResponseDto {
  @ApiProperty({ description: 'Signed short-lived phone-change challenge' })
  challengeToken: string;

  @ApiProperty({ example: '*********3334' })
  maskedPhone: string;

  @ApiProperty({ example: 600 })
  expiresInSeconds: number;
}
