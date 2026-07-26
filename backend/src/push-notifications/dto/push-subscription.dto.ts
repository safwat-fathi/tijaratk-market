import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
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

/** One customer identity previously verified through the public access flow. */
export class CustomerPushIdentityDto {
  @ApiProperty({ description: 'Customer access code' })
  @IsString()
  @Length(4, 32)
  code: string;

  @ApiProperty({ description: 'Phone number paired with the access code' })
  @IsString()
  @Length(6, 32)
  phone: string;
}

/** Anonymous installed-app device registration with optional customer links. */
export class UpsertCustomerPushSubscriptionDto {
  @ApiProperty({
    description: 'Opaque device credential stored only in a secure cookie',
  })
  @IsString()
  @Length(43, 128)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'deviceToken must be an unpadded base64url value',
  })
  deviceToken: string;

  @ApiProperty({ type: UpsertPushSubscriptionDto })
  @ValidateNested()
  @Type(() => UpsertPushSubscriptionDto)
  subscription: UpsertPushSubscriptionDto;

  @ApiProperty({
    type: [CustomerPushIdentityDto],
    description: 'Saved customer identities to validate and link',
  })
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => CustomerPushIdentityDto)
  identities: CustomerPushIdentityDto[];
}

/** Anonymous installed-app device credential used to remove its registration. */
export class DeleteCustomerPushSubscriptionDto {
  @ApiProperty({
    description: 'Opaque device credential stored only in a secure cookie',
  })
  @IsString()
  @Length(43, 128)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'deviceToken must be an unpadded base64url value',
  })
  deviceToken: string;
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

/** Customer device registration result with the number of verified links. */
export class CustomerPushSubscriptionStatusDto extends PushSubscriptionStatusDto {
  @ApiProperty({ minimum: 0, maximum: 5 })
  linkedCustomers: number;
}
