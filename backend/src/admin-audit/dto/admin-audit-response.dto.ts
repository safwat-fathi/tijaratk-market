import { ApiProperty } from '@nestjs/swagger';
import {
  AdminAuditEntityType,
  AdminAuditOutcome,
  AdminRole,
} from '../../../generated/prisma/client';

/** Immutable administrator identity returned for an audit event. */
export class AdminAuditActorDto {
  @ApiProperty({ nullable: true, example: 7 })
  id: number | null;

  @ApiProperty({ example: 'أحمد محمد' })
  name: string;

  @ApiProperty({ enum: AdminRole, nullable: true })
  role: AdminRole | null;
}

/** Minimal tenant context attached to a platform audit event. */
export class AdminAuditTenantDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: 'سوبر ماركت النور' })
  name: string;
}

/** One serialized platform administrator audit event. */
export class AdminAuditLogItemDto {
  @ApiProperty({ example: 1001 })
  id: number;

  @ApiProperty({ type: AdminAuditActorDto })
  actor: AdminAuditActorDto;

  @ApiProperty({ type: AdminAuditTenantDto, nullable: true })
  tenant: AdminAuditTenantDto | null;

  @ApiProperty({ nullable: true })
  management_session_id: number | null;

  @ApiProperty({ enum: AdminAuditEntityType, nullable: true })
  entity_type: AdminAuditEntityType | null;

  @ApiProperty({ nullable: true })
  entity_id: number | null;

  @ApiProperty({ example: 'product.created' })
  action: string;

  @ApiProperty({ example: 'تم إضافة منتج جديد' })
  title: string;

  @ApiProperty({ enum: AdminAuditOutcome })
  outcome: AdminAuditOutcome;

  @ApiProperty({ nullable: true })
  request_id: string | null;

  @ApiProperty({ nullable: true })
  ip_address: string | null;

  @ApiProperty({ type: Object, nullable: true })
  metadata: Record<string, unknown> | null;

  @ApiProperty({ format: 'date-time' })
  created_at: string;
}

/** Cursor-paginated administrator audit response. */
export class AdminAuditLogListResponseDto {
  @ApiProperty({ type: [AdminAuditLogItemDto] })
  items: AdminAuditLogItemDto[];

  @ApiProperty({ nullable: true, example: 950 })
  next_cursor: number | null;
}
