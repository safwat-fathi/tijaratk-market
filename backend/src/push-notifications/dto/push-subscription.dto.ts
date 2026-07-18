import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Browser encryption keys supplied by PushManager. */
export class PushSubscriptionKeysDto {
  @ApiProperty({ description: 'Browser P-256 public encryption key' })
  @IsString()
  @Length(16, 512)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'p256dh must be an unpadded base64url value',
  })
  p256dh: string;

  @ApiProperty({ description: 'Browser Web Push authentication secret' })
  @IsString()
  @Length(8, 256)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'auth must be an unpadded base64url value',
  })
  auth: string;
}

/** Validated browser subscription persisted for the authenticated actor. */
export class UpsertPushSubscriptionDto {
  @ApiProperty({ description: 'HTTPS browser push-service endpoint' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @Length(16, 4096)
  endpoint: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'PushSubscription expiration timestamp in milliseconds',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(8_640_000_000_000_000)
  expirationTime?: number | null;

  @ApiProperty({ type: PushSubscriptionKeysDto })
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;
}

/** Identifies one browser endpoint to remove for the authenticated actor. */
export class DeletePushSubscriptionDto {
  @ApiProperty({ description: 'HTTPS browser push-service endpoint' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @Length(16, 4096)
  endpoint: string;
}

/** Public browser configuration for opt-in notification controls. */
export class PushNotificationsConfigDto {
  @ApiProperty()
  enabled: boolean;

  @ApiPropertyOptional()
  publicKey?: string;
}

/** Browser subscription mutation result. */
export class PushSubscriptionStatusDto {
  @ApiProperty()
  subscribed: boolean;
}
