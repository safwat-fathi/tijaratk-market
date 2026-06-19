import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { TenantCategory } from '../../../generated/prisma/client';

const hasValue = (value: unknown) =>
  typeof value === 'string' ? value.trim().length > 0 : value !== undefined;

const hasInstapayValue = (dto: UpdateTenantSettingsDto) =>
  hasValue(dto.instapay_account_name) || hasValue(dto.instapay_account_number);

const hasEwalletValue = (dto: UpdateTenantSettingsDto) =>
  hasValue(dto.ewallet_account_name) || hasValue(dto.ewallet_account_number);

/**
 * Payload for merchant general settings updates.
 */
export class UpdateTenantSettingsDto {
  @ApiProperty({ example: 'My Awesome Store', description: 'Store name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: TenantCategory.grocery,
    enum: TenantCategory,
    description: 'Store category',
  })
  @IsEnum(TenantCategory)
  category: TenantCategory;

  @ApiProperty({
    required: false,
    example: 'Ahmed Mohamed',
    description: 'Instapay account display name',
  })
  @ValidateIf((dto: UpdateTenantSettingsDto) => hasInstapayValue(dto))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  instapay_account_name?: string;

  @ApiProperty({
    required: false,
    example: 'ahmed@instapay',
    description: 'Instapay account handle or number',
  })
  @ValidateIf((dto: UpdateTenantSettingsDto) => hasInstapayValue(dto))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  instapay_account_number?: string;

  @ApiProperty({
    required: false,
    example: 'Ahmed Mohamed',
    description: 'E-wallet account display name',
  })
  @ValidateIf((dto: UpdateTenantSettingsDto) => hasEwalletValue(dto))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  ewallet_account_name?: string;

  @ApiProperty({
    required: false,
    example: '01000000000',
    description: 'E-wallet account number',
  })
  @ValidateIf((dto: UpdateTenantSettingsDto) => hasEwalletValue(dto))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  ewallet_account_number?: string;

  @ApiProperty({
    required: false,
    example: true,
    description: 'Allow customers to request card payment on delivery',
  })
  @IsOptional()
  @IsBoolean()
  card_on_delivery_available?: boolean;
}
