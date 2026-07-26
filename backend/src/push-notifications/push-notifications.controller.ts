import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { AllowAnyAdmin } from 'src/admin/decorators/admin-role.decorator';
import { AdminAuthGuard } from 'src/admin/guards/admin-auth.guard';
import CONSTANTS from 'src/common/constants';
import {
  CustomerPushSubscriptionStatusDto,
  DeleteCustomerPushSubscriptionDto,
  DeletePushSubscriptionDto,
  PushNotificationsConfigDto,
  PushSubscriptionStatusDto,
  UpsertPushSubscriptionDto,
  UpsertCustomerPushSubscriptionDto,
} from './dto/push-subscription.dto';
import { PushNotificationsService } from './push-notifications.service';

type MerchantPushRequest = Request & {
  user?: { userId?: number; tenant_id?: number };
};

type AdminPushRequest = Request & {
  user?: { userId?: number };
};

/** Public configuration and authenticated merchant Web Push endpoints. */
@ApiTags('Push Notifications')
@Controller('push-notifications')
export class PushNotificationsController {
  constructor(
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  /** Returns the browser-safe VAPID public key only when push is enabled. */
  @Get('config')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get browser Web Push configuration' })
  @ApiResponse({ status: 200, type: PushNotificationsConfigDto })
  getConfig() {
    return this.pushNotificationsService.getBrowserConfig();
  }

  /** Registers an installed customer app and any valid saved identities. */
  @Post('customer/subscriptions')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a customer Web Push subscription' })
  @ApiBody({ type: UpsertCustomerPushSubscriptionDto })
  @ApiResponse({
    status: 201,
    description: 'Customer device registered',
    type: CustomerPushSubscriptionStatusDto,
  })
  upsertCustomerSubscription(
    @Body() dto: UpsertCustomerPushSubscriptionDto,
  ) {
    return this.pushNotificationsService.upsertCustomerSubscription(dto);
  }

  /** Removes an installed customer app by its secure device credential. */
  @Delete('customer/subscriptions')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Delete a customer Web Push subscription' })
  @ApiBody({ type: DeleteCustomerPushSubscriptionDto })
  @ApiResponse({
    status: 200,
    description: 'Customer device removed',
    type: PushSubscriptionStatusDto,
  })
  deleteCustomerSubscription(
    @Body() dto: DeleteCustomerPushSubscriptionDto,
  ) {
    return this.pushNotificationsService.deleteCustomerSubscription(
      dto.deviceToken,
    );
  }

  /** Registers one browser device for the authenticated merchant user. */
  @Post('subscriptions')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT), ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Register a merchant Web Push subscription' })
  @ApiBody({ type: UpsertPushSubscriptionDto })
  @ApiResponse({
    status: 201,
    description: 'Subscription registered',
    type: PushSubscriptionStatusDto,
  })
  upsertMerchantSubscription(
    @Req() request: MerchantPushRequest,
    @Body() dto: UpsertPushSubscriptionDto,
  ) {
    const userId = request.user?.userId;
    const tenantId = request.user?.tenant_id;
    if (!userId || !tenantId) {
      throw new UnauthorizedException('Merchant context is required');
    }
    return this.pushNotificationsService.upsertMerchantSubscription(
      userId,
      tenantId,
      dto,
    );
  }

  /** Removes one browser device owned by the authenticated merchant user. */
  @Delete('subscriptions')
  @UseGuards(AuthGuard(CONSTANTS.AUTH.JWT), ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
  @ApiOperation({ summary: 'Delete a merchant Web Push subscription' })
  @ApiBody({ type: DeletePushSubscriptionDto })
  @ApiResponse({
    status: 200,
    description: 'Subscription removed',
    type: PushSubscriptionStatusDto,
  })
  deleteMerchantSubscription(
    @Req() request: MerchantPushRequest,
    @Body() dto: DeletePushSubscriptionDto,
  ) {
    const userId = request.user?.userId;
    if (!userId) throw new UnauthorizedException('Merchant context is required');
    return this.pushNotificationsService.deleteMerchantSubscription(
      userId,
      dto.endpoint,
    );
  }
}

/** Authenticated administrator Web Push device endpoints. */
@ApiTags('Admin Push Notifications')
@Controller('admin/push-notifications')
@UseGuards(AdminAuthGuard)
@AllowAnyAdmin()
@ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
export class AdminPushNotificationsController {
  constructor(
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  /** Registers one browser device for the active administrator. */
  @Post('subscriptions')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register an administrator Web Push subscription' })
  @ApiBody({ type: UpsertPushSubscriptionDto })
  @ApiResponse({
    status: 201,
    description: 'Subscription registered',
    type: PushSubscriptionStatusDto,
  })
  upsertAdminSubscription(
    @Req() request: AdminPushRequest,
    @Body() dto: UpsertPushSubscriptionDto,
  ) {
    const adminId = request.user?.userId;
    if (!adminId) throw new UnauthorizedException('Admin context is required');
    return this.pushNotificationsService.upsertAdminSubscription(adminId, dto);
  }

  /** Removes one browser device owned by the active administrator. */
  @Delete('subscriptions')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Delete an administrator Web Push subscription' })
  @ApiBody({ type: DeletePushSubscriptionDto })
  @ApiResponse({
    status: 200,
    description: 'Subscription removed',
    type: PushSubscriptionStatusDto,
  })
  deleteAdminSubscription(
    @Req() request: AdminPushRequest,
    @Body() dto: DeletePushSubscriptionDto,
  ) {
    const adminId = request.user?.userId;
    if (!adminId) throw new UnauthorizedException('Admin context is required');
    return this.pushNotificationsService.deleteAdminSubscription(
      adminId,
      dto.endpoint,
    );
  }
}
