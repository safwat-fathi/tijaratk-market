import { ApiProperty } from '@nestjs/swagger';
import { TenantCategory, TenantStatus } from '../../../generated/prisma/client';

export class AdminUserDto {
  @ApiProperty({ description: 'The unique ID of the admin user', example: 1 })
  id: number;

  @ApiProperty({
    description: 'The phone number of the admin user',
    example: '+201112223334',
  })
  phone: string;

  @ApiProperty({
    description: 'The name of the admin user',
    example: 'Super Admin',
  })
  name: string;

  @ApiProperty({
    description: 'The administrator control-plane role',
    enum: ['platform_admin', 'operations_admin'],
    example: 'operations_admin',
  })
  role: string;
}

export class AdminLoginResponseDto {
  @ApiProperty({
    description: 'JWT token for authentication',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  admin_access_token: string;

  @ApiProperty({
    description: 'The admin user profile details',
    type: AdminUserDto,
  })
  user: AdminUserDto;
}

export class AdminLogoutResponseDto {
  @ApiProperty({
    description: 'Indicates whether the logout was successful',
    example: true,
  })
  success: boolean;
}

export class AdminDashboardStatsResponseDto {
  @ApiProperty({
    description: 'Total number of merchants/tenants',
    example: 120,
  })
  totalMerchants: number;

  @ApiProperty({
    description: 'Number of active merchants/tenants',
    example: 95,
  })
  activeMerchants: number;

  @ApiProperty({
    description: 'Number of merchant applications awaiting review',
    example: 8,
  })
  pendingApplications: number;

  @ApiProperty({
    description:
      'Total number of ordinary and zone-storefront orders placed in the system',
    example: 1450,
  })
  totalOrders: number;

  @ApiProperty({
    description:
      'Number of ordinary and zone-storefront orders with completed status',
    example: 860,
  })
  completedOrders: number;

  @ApiProperty({
    description: 'Total number of subscription plans available',
    example: 3,
  })
  totalPlans: number;
}

export class AdminTenantCountDto {
  @ApiProperty({ description: 'Count of orders for this tenant', example: 25 })
  orders: number;

  @ApiProperty({
    description: 'Count of customers for this tenant',
    example: 40,
  })
  customers: number;
}

export class AdminTenantResponseDto {
  @ApiProperty({ description: 'The unique ID of the tenant', example: 1 })
  id: number;

  @ApiProperty({
    description: 'The brand/business name of the tenant',
    example: 'Tijaratk Groceries',
  })
  name: string;

  @ApiProperty({
    description: 'The contact phone number of the tenant',
    example: '+201012345678',
  })
  phone: string;

  @ApiProperty({
    description: 'The internal counter for customer reference numbers',
    example: 42,
  })
  customer_counter: number;

  @ApiProperty({
    description: 'The category of business the tenant belongs to',
    enum: TenantCategory,
    example: TenantCategory.grocery,
  })
  category: TenantCategory;

  @ApiProperty({
    description: 'The timestamp when bulk essentials were last added',
    nullable: true,
    example: '2026-06-21T12:00:00.000Z',
  })
  last_bulk_essentials_added_at: Date | null;

  @ApiProperty({
    description: 'The unique slug representing the tenant URL path',
    example: 'tijaratk-groceries',
  })
  slug: string;

  @ApiProperty({
    description: 'The active status of the tenant',
    enum: TenantStatus,
    example: TenantStatus.active,
  })
  status: TenantStatus;

  @ApiProperty({
    description: 'Indicates if delivery is currently available',
    example: true,
  })
  delivery_available: boolean;

  @ApiProperty({
    description: 'Start time of delivery operating hours (HH:MM)',
    nullable: true,
    example: '09:00',
  })
  delivery_starts_at: string | null;

  @ApiProperty({
    description: 'End time of delivery operating hours (HH:MM)',
    nullable: true,
    example: '22:00',
  })
  delivery_ends_at: string | null;

  @ApiProperty({
    description: 'The timestamp of when the tenant was registered',
    example: '2026-06-01T12:00:00.000Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'The timestamp of the last update to tenant info',
    example: '2026-06-02T15:30:00.000Z',
  })
  updated_at: Date;

  @ApiProperty({
    description: 'The deletion timestamp, if soft-deleted',
    nullable: true,
    example: null,
  })
  deleted_at: Date | null;

  @ApiProperty({
    description: 'Aggregated counts of associated relations',
    type: AdminTenantCountDto,
  })
  _count: AdminTenantCountDto;
}

export class AdminPlanResponseDto {
  @ApiProperty({
    description: 'The unique ID of the subscription plan',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'The name of the subscription plan',
    example: 'Premium Plan',
  })
  name: string;

  @ApiProperty({
    description: 'The monthly pricing of the plan',
    example: 49.99,
  })
  price: number;

  @ApiProperty({
    description: 'JSON object listing features included in the plan',
    example: { unlimitedProducts: true, prioritySupport: true },
  })
  features: any;

  @ApiProperty({
    description: 'Indicates if the plan is currently active and selectable',
    example: true,
  })
  is_active: boolean;

  @ApiProperty({
    description: 'The timestamp of plan creation',
    example: '2026-06-01T10:00:00.000Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'The timestamp of the last plan update',
    example: '2026-06-01T10:00:00.000Z',
  })
  updated_at: Date;
}
