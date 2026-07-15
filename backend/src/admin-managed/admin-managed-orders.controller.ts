import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAuthGuard } from 'src/admin/guards/admin-auth.guard';
import CONSTANTS from 'src/common/constants';
import { OrdersService } from 'src/orders/orders.service';
import { ReplaceOrderItemDto } from 'src/orders/dto/replace-order-item.dto';
import { UpdateOrderItemPriceDto } from 'src/orders/dto/update-order-item-price.dto';
import { AdminActorContext } from './admin-managed.types';
import { ADMIN_MANAGED_PERMISSIONS } from './constants/admin-managed-permissions';
import { CurrentAdminActor } from './decorators/current-admin-actor.decorator';
import {
  RequireManagedFeature,
  RequireManagedPermissions,
} from './decorators/managed-policy.decorator';
import { ManagedTenantGuard } from './guards/managed-tenant.guard';
import {
  UpdateManagedOrderPricingDto,
  UpdateManagedOrderStatusDto,
} from './dto/admin-managed-order.dto';

/** Tenant-scoped order operations performed by a managed administrator. */
@ApiTags('Admin Managed Orders')
@ApiBearerAuth(CONSTANTS.ACCESS_TOKEN)
@Controller('admin/managed-tenants/:tenantId/orders')
@UseGuards(AdminAuthGuard, ManagedTenantGuard)
export class AdminManagedOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** Lists orders with order-specific customer data only. */
  @Get()
  @RequireManagedPermissions(
    ADMIN_MANAGED_PERMISSIONS.OrdersRead,
    ADMIN_MANAGED_PERMISSIONS.CustomersReadLimited,
  )
  @ApiOperation({ summary: 'List managed tenant orders' })
  listOrders(
    @CurrentAdminActor() actor: AdminActorContext,
    @Query('date') date?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.findAllForManagedAdmin(
      actor,
      date,
      limit ? Number(limit) : undefined,
    );
  }

  /** Returns one tenant-owned order and its fulfilment data. */
  @Get(':orderId')
  @RequireManagedPermissions(
    ADMIN_MANAGED_PERMISSIONS.OrdersRead,
    ADMIN_MANAGED_PERMISSIONS.CustomersReadLimited,
  )
  @ApiOperation({ summary: 'Get managed tenant order' })
  getOrder(
    @CurrentAdminActor() actor: AdminActorContext,
    @Param('orderId', ParseIntPipe) orderId: number,
  ) {
    return this.ordersService.findOneForManagedAdmin(actor, orderId);
  }

  /** Applies an existing order status transition. */
  @Patch(':orderId/status')
  @RequireManagedFeature('order_write')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.OrdersUpdateStatus)
  @ApiOperation({ summary: 'Update managed order status' })
  @ApiBody({ type: UpdateManagedOrderStatusDto })
  updateStatus(
    @CurrentAdminActor() actor: AdminActorContext,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: UpdateManagedOrderStatusDto,
  ) {
    return this.ordersService.updateForManagedAdmin(actor, orderId, dto);
  }

  /** Updates the order total without accepting status fields. */
  @Patch(':orderId/pricing')
  @RequireManagedFeature('order_write')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.OrdersUpdatePricing)
  @ApiOperation({ summary: 'Update managed order total' })
  @ApiBody({ type: UpdateManagedOrderPricingDto })
  updatePricing(
    @CurrentAdminActor() actor: AdminActorContext,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: UpdateManagedOrderPricingDto,
  ) {
    return this.ordersService.updateForManagedAdmin(actor, orderId, dto);
  }

  /** Updates one line price and recalculates the order. */
  @Patch('items/:itemId/price')
  @RequireManagedFeature('order_write')
  @RequireManagedPermissions(ADMIN_MANAGED_PERMISSIONS.OrdersUpdatePricing)
  @ApiOperation({ summary: 'Update managed order item price' })
  @ApiBody({ type: UpdateOrderItemPriceDto })
  updateItemPrice(
    @CurrentAdminActor() actor: AdminActorContext,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateOrderItemPriceDto,
  ) {
    return this.ordersService.updateOrderItemPriceForManagedAdmin(
      actor,
      itemId,
      dto.total_price,
    );
  }

  /** Marks a line unavailable and cancels the order when no lines remain. */
  @Patch('items/:itemId/out-of-stock')
  @RequireManagedFeature('order_write')
  @RequireManagedPermissions(
    ADMIN_MANAGED_PERMISSIONS.OrdersUpdatePricing,
    ADMIN_MANAGED_PERMISSIONS.ProductsUpdateAvailability,
  )
  @ApiOperation({
    summary: 'Mark managed order item out of stock',
    description:
      'Disables the linked tenant product and cancels the order when no deliverable items remain',
  })
  markOutOfStock(
    @CurrentAdminActor() actor: AdminActorContext,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.ordersService.markOrderItemOutOfStockForManagedAdmin(
      actor,
      itemId,
    );
  }

  /** Proposes or clears a customer-decided replacement. */
  @Patch('items/:itemId/replacement')
  @RequireManagedFeature('order_write')
  @RequireManagedPermissions(
    ADMIN_MANAGED_PERMISSIONS.OrdersManageReplacements,
    ADMIN_MANAGED_PERMISSIONS.ProductsRead,
  )
  @ApiOperation({ summary: 'Propose managed order item replacement' })
  @ApiBody({ type: ReplaceOrderItemDto })
  replaceItem(
    @CurrentAdminActor() actor: AdminActorContext,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: ReplaceOrderItemDto,
  ) {
    return this.ordersService.replaceOrderItemForManagedAdmin(
      actor,
      itemId,
      dto.replaced_by_product_id ?? null,
    );
  }

  /** Resets replacement state but never makes the customer decision. */
  @Patch('items/:itemId/replacement-reset')
  @RequireManagedFeature('order_write')
  @RequireManagedPermissions(
    ADMIN_MANAGED_PERMISSIONS.OrdersManageReplacements,
  )
  @ApiOperation({ summary: 'Reset managed order item replacement' })
  resetReplacement(
    @CurrentAdminActor() actor: AdminActorContext,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.ordersService.resetOrderItemReplacementForManagedAdmin(
      actor,
      itemId,
    );
  }
}
