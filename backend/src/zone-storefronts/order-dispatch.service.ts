import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { rm } from 'node:fs/promises';
import {
  OrderDispatchAssignmentStatus,
  OrderDispatchStatus,
  OrderSource,
  Prisma,
  ProductSource,
  ProductStatus,
} from '../../generated/prisma/client';
import { AdminActorContext } from 'src/admin-managed/admin-managed.types';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { ActivityActions } from 'src/activity-log/constants/activity-actions';
import {
  ActivityEntityTypes,
  ActivitySources,
} from 'src/activity-log/constants/activity-types';
import { OrderStatus } from 'src/common/enums/order-status.enum';
import { OrderType } from 'src/common/enums/order-type.enum';
import { PricingMode } from 'src/common/enums/pricing-mode.enum';
import { CreateOrderDto } from 'src/orders/dto/create-order.dto';
import { OrdersService } from 'src/orders/orders.service';
import {
  getAllowedCatalogCategoriesForSource,
  resolveCatalogSourceForTenantCategory,
} from 'src/products/catalog-source-policy';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AcceptOrderDispatchDto,
  AssignOrderDispatchDto,
  CancelOrderDispatchDto,
  RejectOrderDispatchDto,
  UpdateAssignedOrderReplacementDto,
  UpdateAssignedOrderStatusDto,
  UpdateDispatchQuoteLineDto,
} from './dto/zone-storefront.dto';
import { ZoneStorefrontNotificationsService } from './zone-storefront-notifications.service';
import { ZoneStorefrontsService } from './zone-storefronts.service';
import type { MetaTrackingContext } from 'src/meta-conversions/meta-conversions.types';

type MerchantRequestActor = {
  tenantId: number;
  userId: number;
};

/** Implements atomic zone checkout and manual cross-tenant dispatch workflows. */
@Injectable()
export class OrderDispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly activityLogService: ActivityLogService,
    private readonly zoneStorefrontsService: ZoneStorefrontsService,
    private readonly notifications: ZoneStorefrontNotificationsService,
  ) {}

  /** Atomically creates an operator-owned draft order and pending dispatch. */
  async createPublicOrder(
    slug: string,
    dto: CreateOrderDto,
    prescriptionFile?: Express.Multer.File,
    metaTrackingContext?: MetaTrackingContext,
  ) {
    let zone: Awaited<
      ReturnType<ZoneStorefrontsService['requireCheckoutZone']>
    >;
    let created: Awaited<ReturnType<OrdersService['createForTenantId']>>;

    try {
      zone = await this.zoneStorefrontsService.requireCheckoutZone(slug);
      if (dto.prescription_unavailability_action && !prescriptionFile) {
        throw new BadRequestException('Prescription file is required');
      }
      if (prescriptionFile && zone.operator_tenant.category !== 'pharmacy') {
        throw new BadRequestException(
          'Prescription uploads are only available for pharmacy zones',
        );
      }

      const catalogSource = resolveCatalogSourceForTenantCategory(
        zone.operator_tenant.category,
      );
      if (!catalogSource) {
        throw new BadRequestException('Unsupported zone category');
      }
      const allowedCategories =
        getAllowedCatalogCategoriesForSource(catalogSource);
      if (
        (dto.items ?? []).some((item) => typeof item.product_id !== 'number')
      ) {
        throw new BadRequestException(
          'Zone catalog items must reference an available product',
        );
      }
      const productIds = Array.from(
        new Set(
          (dto.items ?? [])
            .map((item) => item.product_id)
            .filter((id): id is number => typeof id === 'number'),
        ),
      );
      const trustedItems = dto.items?.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        notes: item.notes,
        selection_quantity: item.selection_quantity,
        selection_grams: item.selection_grams,
        selection_amount_egp: item.selection_amount_egp,
        unit_option_id: item.unit_option_id,
      }));

      const forcedDto: CreateOrderDto = {
        ...dto,
        items: trustedItems,
        order_type: trustedItems?.length
          ? OrderType.CATALOG
          : OrderType.FREE_TEXT,
        total: undefined,
        delivery_area_id: zone.area_id,
        delivery_area_slug: zone.area.slug,
        order_source: OrderSource.zone_storefront,
        source_metadata: {
          zone_storefront_id: zone.id,
          zone_slug: zone.slug,
          area_id: zone.area_id,
          area_slug: zone.area.slug,
        },
      };

      created = await this.zoneStorefrontsService.runInOperatorTenant(
        zone.operator_tenant_id,
        async (manager) => {
          if (productIds.length > 0) {
            const validProductCount = await manager.product.count({
              where: {
                id: { in: productIds },
                tenant_id: zone.operator_tenant_id,
                catalog_item_id: { not: null },
                source: ProductSource.catalog,
                status: ProductStatus.active,
                is_available: true,
                deleted_at: null,
                category: { in: allowedCategories },
              },
            });
            if (validProductCount !== productIds.length) {
              throw new BadRequestException(
                'One or more products are unavailable for this zone',
              );
            }
          }

          return this.ordersService.createForTenantId(
            zone.operator_tenant_id,
            forcedDto,
            { source: ActivitySources.Storefront },
            prescriptionFile,
            {
              skipPostCommitEffects: true,
              metaTrackingContext,
              afterPersist: async (transactionManager, order) => {
                const dispatch = await transactionManager.orderDispatch.create({
                  data: {
                    order_id: order.id,
                    zone_storefront_id: zone.id,
                    status: OrderDispatchStatus.pending,
                  },
                });
                await this.activityLogService.create(
                  {
                    tenantId: zone.operator_tenant_id,
                    entityType: ActivityEntityTypes.OrderDispatch,
                    entityId: dispatch.id,
                    action: ActivityActions.OrderDispatchCreated,
                    title: 'تم إنشاء طلب منطقة في قائمة الإسناد',
                    newValues: {
                      order_id: order.id,
                      status: dispatch.status,
                      zone_storefront_id: zone.id,
                    },
                    source: ActivitySources.Storefront,
                  },
                  transactionManager,
                );
              },
            },
          );
        },
      );
    } catch (error) {
      await this.deleteUploadedFileQuietly(prescriptionFile);
      throw error;
    }

    const completeOrder = await this.zoneStorefrontsService.runInOperatorTenant(
      zone.operator_tenant_id,
      () => this.ordersService.findOne(created.id),
    );
    const dispatch = await this.prisma.orderDispatch.findUniqueOrThrow({
      where: { order_id: created.id },
      select: { id: true },
    });
    await this.ordersService.invalidateOrderCaches(zone.operator_tenant_id);
    await this.notifications.notifyNewOrder({
      dispatchId: dispatch.id,
      orderNumber: String(completeOrder.id),
      zoneName: zone.name,
      area: zone.area.name_ar,
      operationsPhone: zone.operations_phone,
      customerName: completeOrder.customer_name || 'عميل',
      customerPhone: completeOrder.customer_phone || '',
      total: Number(completeOrder.total || 0),
    });

    return {
      id: completeOrder.id,
      public_token: completeOrder.public_token,
      status: completeOrder.status,
      subtotal: completeOrder.subtotal,
      delivery_fee: completeOrder.delivery_fee,
      total: completeOrder.total,
      customer_access_code: created.customer_access_code,
      ...(created.meta_purchase
        ? { meta_purchase: created.meta_purchase }
        : {}),
      zone_storefront: {
        id: zone.id,
        name: zone.name,
        slug: zone.slug,
      },
    };
  }

  /** Returns the session-scoped zone identity and verified assignment candidates. */
  async findManagedContext(actor: AdminActorContext) {
    const zone = await this.requireManagedZone(actor.tenantId);
    const eligibleMerchants =
      await this.zoneStorefrontsService.findEligibleMerchants(zone.id);

    return {
      zone: {
        id: zone.id,
        name: zone.name,
        slug: zone.slug,
        is_active: zone.is_active,
        area: {
          id: zone.area.id,
          name_ar: zone.area.name_ar,
          name_en: zone.area.name_en,
          slug: zone.area.slug,
        },
        operator_tenant: {
          id: zone.operator_tenant.id,
          name: zone.operator_tenant.name,
        },
      },
      eligible_merchants: eligibleMerchants.filter(
        (merchant) => merchant.membership?.is_active,
      ),
    };
  }

  /** Lists dispatches for the operator tenant represented by a management session. */
  async findManagedQueue(actor: AdminActorContext, status?: string) {
    const zone = await this.requireManagedZone(actor.tenantId);
    const normalizedStatus = status?.trim();
    if (
      normalizedStatus &&
      !Object.values(OrderDispatchStatus).includes(
        normalizedStatus as OrderDispatchStatus,
      )
    ) {
      throw new BadRequestException('Invalid dispatch status');
    }

    return this.zoneStorefrontsService.runInOperatorTenant(
      zone.operator_tenant_id,
      (manager) =>
        manager.orderDispatch.findMany({
          where: {
            zone_storefront_id: zone.id,
            ...(normalizedStatus
              ? { status: normalizedStatus as OrderDispatchStatus }
              : {}),
          },
          select: {
            id: true,
            status: true,
            version: true,
            created_at: true,
            updated_at: true,
            order: {
              select: {
                id: true,
                public_token: true,
                status: true,
                customer_name: true,
                customer_phone: true,
                delivery_address: true,
                total: true,
                created_at: true,
              },
            },
            assignments: {
              where: { is_current: true },
              select: {
                id: true,
                status: true,
                version: true,
                assigned_at: true,
                target_tenant: { select: { id: true, name: true } },
              },
              take: 1,
            },
          },
          orderBy: { created_at: 'desc' },
          take: 200,
        }),
    );
  }

  /** Returns managed dispatch details and immutable assignment history. */
  async findManagedDispatch(actor: AdminActorContext, dispatchId: number) {
    const zone = await this.requireManagedZone(actor.tenantId);
    const dispatch = await this.readDispatchDetail(
      zone.operator_tenant_id,
      dispatchId,
      zone.id,
    );
    if (!dispatch) throw new NotFoundException('Dispatch not found');
    return dispatch;
  }

  /** Creates a new current assignment and revokes any superseded pending attempt. */
  async assign(
    actor: AdminActorContext,
    dispatchId: number,
    dto: AssignOrderDispatchDto,
  ) {
    const zone = await this.requireManagedZone(actor.tenantId);
    const merchant = await this.zoneStorefrontsService.requireEligibleMerchant(
      zone.id,
      dto.target_tenant_id,
    );

    const result = await this.zoneStorefrontsService.runInOperatorTenant(
      zone.operator_tenant_id,
      async (manager) => {
        const dispatch = await manager.orderDispatch.findFirst({
          where: { id: dispatchId, zone_storefront_id: zone.id },
          include: { order: true },
        });
        if (!dispatch) throw new NotFoundException('Dispatch not found');
        if (
          dispatch.status === OrderDispatchStatus.accepted ||
          dispatch.status === OrderDispatchStatus.cancelled
        ) {
          throw new BadRequestException('Dispatch can no longer be assigned');
        }

        const versionUpdate = await manager.orderDispatch.updateMany({
          where: {
            id: dispatch.id,
            version: dto.expected_version,
            status: {
              in: [
                OrderDispatchStatus.pending,
                OrderDispatchStatus.awaiting_merchant,
              ],
            },
          },
          data: {
            status: OrderDispatchStatus.awaiting_merchant,
            version: { increment: 1 },
          },
        });
        if (versionUpdate.count !== 1) this.throwVersionConflict();

        const previousAssignment =
          await manager.orderDispatchAssignment.findFirst({
            where: { order_dispatch_id: dispatch.id },
            select: {
              target_tenant: { select: { id: true, name: true } },
            },
            orderBy: { created_at: 'desc' },
          });
        await manager.orderDispatchAssignment.updateMany({
          where: { order_dispatch_id: dispatch.id, is_current: true },
          data: {
            status: OrderDispatchAssignmentStatus.revoked,
            is_current: false,
            responded_at: new Date(),
            version: { increment: 1 },
          },
        });
        const assignment = await manager.orderDispatchAssignment.create({
          data: {
            order_dispatch_id: dispatch.id,
            target_tenant_id: merchant.id,
            assigned_by_admin_id: actor.adminId!,
            status: OrderDispatchAssignmentStatus.pending,
            internal_notes: dto.internal_notes?.trim() || null,
          },
        });

        await this.activityLogService.create(
          {
            tenantId: zone.operator_tenant_id,
            actorAdminId: actor.adminId,
            actorAdminName: actor.adminName,
            actorAdminRole: actor.adminRole,
            managementSessionId: actor.managementSessionId,
            entityType: ActivityEntityTypes.OrderDispatch,
            entityId: dispatch.id,
            action: ActivityActions.OrderDispatchAssigned,
            title: 'تم إسناد طلب منطقة إلى متجر',
            newValues: {
              assignment_id: assignment.id,
              target_tenant_id: merchant.id,
              status: OrderDispatchStatus.awaiting_merchant,
            },
            source: ActivitySources.Admin,
            requestId: actor.requestId,
            ipAddress: actor.ipAddress,
          },
          manager,
        );

        return { dispatch, assignment, previousAssignment };
      },
    );

    await this.notifications.notifyAssignment({
      dispatchId,
      orderNumber: String(result.dispatch.order_id),
      merchantName: merchant.name,
      merchantPhone: merchant.phone,
      zoneName: zone.name,
      area: zone.area.name_ar,
    });
    if (
      result.previousAssignment &&
      result.previousAssignment.target_tenant.id !== merchant.id
    ) {
      await this.notifications.notifyReassignment({
        operationsPhone: zone.operations_phone,
        orderNumber: String(result.dispatch.order_id),
        previousMerchantName: result.previousAssignment.target_tenant.name,
        newMerchantName: merchant.name,
      });
    }
    return this.findManagedDispatch(actor, dispatchId);
  }

  /** Cancels a dispatch and order without incrementing operator cancellation policy. */
  async cancel(
    actor: AdminActorContext,
    dispatchId: number,
    dto: CancelOrderDispatchDto,
  ) {
    const zone = await this.requireManagedZone(actor.tenantId);
    const result = await this.zoneStorefrontsService.runInOperatorTenant(
      zone.operator_tenant_id,
      async (manager) => {
        const dispatch = await manager.orderDispatch.findFirst({
          where: { id: dispatchId, zone_storefront_id: zone.id },
          include: { order: true },
        });
        if (!dispatch) throw new NotFoundException('Dispatch not found');
        if (dispatch.status === OrderDispatchStatus.cancelled) {
          throw new BadRequestException('Dispatch is already cancelled');
        }
        if (
          dispatch.order.status === OrderStatus.COMPLETED ||
          dispatch.order.status === OrderStatus.REJECTED_BY_CUSTOMER
        ) {
          throw new BadRequestException('Completed order cannot be cancelled');
        }

        const updated = await manager.orderDispatch.updateMany({
          where: { id: dispatch.id, version: dto.expected_version },
          data: {
            status: OrderDispatchStatus.cancelled,
            cancellation_reason: dto.reason.trim(),
            cancelled_by_admin_id: actor.adminId,
            cancelled_at: new Date(),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) this.throwVersionConflict();
        await manager.orderDispatchAssignment.updateMany({
          where: { order_dispatch_id: dispatch.id, is_current: true },
          data: {
            status: OrderDispatchAssignmentStatus.cancelled,
            is_current: false,
            responded_at: new Date(),
            version: { increment: 1 },
          },
        });
        const order = await manager.order.update({
          where: { id: dispatch.order_id },
          data: {
            status: OrderStatus.CANCELLED,
            merchant_cancellation_reason: dto.reason.trim(),
            merchant_cancelled_at: new Date(),
          },
        });
        await this.activityLogService.create(
          {
            tenantId: zone.operator_tenant_id,
            actorAdminId: actor.adminId,
            actorAdminName: actor.adminName,
            actorAdminRole: actor.adminRole,
            managementSessionId: actor.managementSessionId,
            entityType: ActivityEntityTypes.OrderDispatch,
            entityId: dispatch.id,
            action: ActivityActions.OrderDispatchCancelled,
            title: 'تم إلغاء طلب المنطقة',
            oldValues: { dispatch_status: dispatch.status },
            newValues: {
              dispatch_status: OrderDispatchStatus.cancelled,
              order_status: OrderStatus.CANCELLED,
            },
            metadata: { reason: dto.reason.trim() },
            source: ActivitySources.Admin,
            requestId: actor.requestId,
            ipAddress: actor.ipAddress,
          },
          manager,
        );
        return order;
      },
    );

    await this.ordersService.invalidateOrderCaches(zone.operator_tenant_id);
    if (result.customer_phone) {
      await this.notifications.notifyCustomerStatus({
        customerPhone: result.customer_phone,
        customerName: result.customer_name || 'عميل',
        orderNumber: String(result.id),
        statusLabel: `تم الإلغاء. السبب: ${dto.reason.trim()}`,
      });
    }
    return this.findManagedDispatch(actor, dispatchId);
  }

  /** Lists only current assignments owned by the authenticated merchant tenant. */
  async findAssignedOrders(actor: MerchantRequestActor) {
    const assignments = await this.prisma.orderDispatchAssignment.findMany({
      where: {
        target_tenant_id: actor.tenantId,
        is_current: true,
        status: {
          in: [
            OrderDispatchAssignmentStatus.pending,
            OrderDispatchAssignmentStatus.accepted,
          ],
        },
      },
      select: {
        order_dispatch_id: true,
        order_dispatch: {
          select: {
            zone_storefront: {
              select: { operator_tenant_id: true, name: true },
            },
          },
        },
      },
      orderBy: { assigned_at: 'desc' },
    });

    const dispatches = await Promise.all(
      assignments.map((assignment) =>
        this.readMerchantDispatch(
          assignment.order_dispatch.zone_storefront.operator_tenant_id,
          assignment.order_dispatch_id,
          actor.tenantId,
          false,
        ),
      ),
    );
    return dispatches.filter((dispatch) => dispatch !== null);
  }

  /** Returns one tenant-safe assigned order detail after assignment validation. */
  async findAssignedOrder(actor: MerchantRequestActor, dispatchId: number) {
    const assignment = await this.requireMerchantAssignment(
      dispatchId,
      actor.tenantId,
    );
    const result = await this.readMerchantDispatch(
      assignment.order_dispatch.zone_storefront.operator_tenant_id,
      dispatchId,
      actor.tenantId,
      true,
    );
    if (!result) throw new NotFoundException('Assigned order not found');
    return result;
  }

  /** Returns sanitized central-catalog candidates for an accepted replacement. */
  async findReplacementProducts(
    actor: MerchantRequestActor,
    dispatchId: number,
    search?: string,
  ) {
    const assignment = await this.requireMerchantAssignment(
      dispatchId,
      actor.tenantId,
      OrderDispatchAssignmentStatus.accepted,
    );
    const operatorTenant =
      assignment.order_dispatch.zone_storefront.operator_tenant;
    const catalogSource = resolveCatalogSourceForTenantCategory(
      operatorTenant.category,
    );
    const allowedCategories = catalogSource
      ? getAllowedCatalogCategoriesForSource(catalogSource)
      : [];
    const normalizedSearch = search?.trim().slice(0, 120);

    return this.zoneStorefrontsService.runInOperatorTenant(
      assignment.order_dispatch.zone_storefront.operator_tenant_id,
      (manager) =>
        manager.product.findMany({
          where: {
            tenant_id:
              assignment.order_dispatch.zone_storefront.operator_tenant_id,
            catalog_item_id: { not: null },
            source: ProductSource.catalog,
            status: ProductStatus.active,
            is_available: true,
            deleted_at: null,
            category: { in: allowedCategories },
            ...(normalizedSearch
              ? { name: { contains: normalizedSearch, mode: 'insensitive' } }
              : {}),
          },
          select: {
            id: true,
            name: true,
            image_url: true,
            category: true,
            current_price: true,
          },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          take: 100,
        }),
    );
  }

  /** Upserts a pending quote line without touching order or product pricing. */
  async updateQuoteLine(
    actor: MerchantRequestActor,
    dispatchId: number,
    orderItemId: number,
    dto: UpdateDispatchQuoteLineDto,
  ) {
    const assignment = await this.requireMerchantAssignment(
      dispatchId,
      actor.tenantId,
      OrderDispatchAssignmentStatus.pending,
    );
    await this.zoneStorefrontsService.runInOperatorTenant(
      assignment.order_dispatch.zone_storefront.operator_tenant_id,
      async (manager) => {
        const item = await manager.orderItem.findFirst({
          where: {
            id: orderItemId,
            order_id: assignment.order_dispatch.order_id,
          },
        });
        if (!item) throw new NotFoundException('Order item not found');

        const updated = await manager.orderDispatchAssignment.updateMany({
          where: {
            id: assignment.id,
            target_tenant_id: actor.tenantId,
            status: OrderDispatchAssignmentStatus.pending,
            is_current: true,
            version: dto.expected_version,
          },
          data: { version: { increment: 1 } },
        });
        if (updated.count !== 1) this.throwVersionConflict();

        const total = this.roundCurrency(dto.total_price);
        const quantity = this.parseQuantity(item.quantity);
        const unit = this.roundCurrency(quantity > 0 ? total / quantity : total);
        await manager.orderDispatchQuoteLine.upsert({
          where: {
            assignment_id_order_item_id: {
              assignment_id: assignment.id,
              order_item_id: item.id,
            },
          },
          create: {
            assignment_id: assignment.id,
            order_item_id: item.id,
            unit_price: new Prisma.Decimal(unit),
            total_price: new Prisma.Decimal(total),
          },
          update: {
            unit_price: new Prisma.Decimal(unit),
            total_price: new Prisma.Decimal(total),
          },
        });
        await this.activityLogService.create(
          {
            tenantId:
              assignment.order_dispatch.zone_storefront.operator_tenant_id,
            actorUserId: actor.userId,
            entityType: ActivityEntityTypes.OrderDispatch,
            entityId: dispatchId,
            action: ActivityActions.OrderDispatchQuoteChanged,
            title: 'تم تحديث عرض سعر طلب المنطقة',
            newValues: { order_item_id: item.id, total_price: total },
            source: ActivitySources.Dashboard,
          },
          manager,
        );
      },
    );
    return this.findAssignedOrder(actor, dispatchId);
  }

  /** Rejects a current assignment and returns the untouched dispatch to pending. */
  async rejectAssignment(
    actor: MerchantRequestActor,
    dispatchId: number,
    dto: RejectOrderDispatchDto,
  ) {
    const assignment = await this.requireMerchantAssignment(
      dispatchId,
      actor.tenantId,
      OrderDispatchAssignmentStatus.pending,
    );
    const operatorTenantId =
      assignment.order_dispatch.zone_storefront.operator_tenant_id;
    await this.zoneStorefrontsService.runInOperatorTenant(
      operatorTenantId,
      async (manager) => {
        const updated = await manager.orderDispatchAssignment.updateMany({
          where: {
            id: assignment.id,
            version: dto.expected_version,
            status: OrderDispatchAssignmentStatus.pending,
            is_current: true,
          },
          data: {
            status: OrderDispatchAssignmentStatus.rejected,
            reason: dto.reason.trim(),
            is_current: false,
            responded_by_user_id: actor.userId,
            responded_at: new Date(),
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) this.throwVersionConflict();
        await manager.orderDispatch.update({
          where: { id: dispatchId },
          data: {
            status: OrderDispatchStatus.pending,
            version: { increment: 1 },
          },
        });
        await this.activityLogService.create(
          {
            tenantId: operatorTenantId,
            actorUserId: actor.userId,
            entityType: ActivityEntityTypes.OrderDispatch,
            entityId: dispatchId,
            action: ActivityActions.OrderDispatchRejected,
            title: 'رفض المتجر إسناد طلب المنطقة',
            oldValues: { status: OrderDispatchStatus.awaiting_merchant },
            newValues: { status: OrderDispatchStatus.pending },
            metadata: { reason: dto.reason.trim() },
            source: ActivitySources.Dashboard,
          },
          manager,
        );
      },
    );

    await this.notifications.notifyRejection({
      operationsPhone:
        assignment.order_dispatch.zone_storefront.operations_phone,
      orderNumber: String(assignment.order_dispatch.order_id),
      merchantName: assignment.target_tenant.name,
      reason: dto.reason.trim(),
    });
    return { status: OrderDispatchAssignmentStatus.rejected };
  }

  /** Applies quote snapshots and confirms the order in one operator transaction. */
  async acceptAssignment(
    actor: MerchantRequestActor,
    dispatchId: number,
    dto: AcceptOrderDispatchDto,
  ) {
    const assignment = await this.requireMerchantAssignment(
      dispatchId,
      actor.tenantId,
      OrderDispatchAssignmentStatus.pending,
    );
    const operatorTenantId =
      assignment.order_dispatch.zone_storefront.operator_tenant_id;
    const accepted = await this.zoneStorefrontsService.runInOperatorTenant(
      operatorTenantId,
      async (manager) => {
        const current = await manager.orderDispatchAssignment.findFirst({
          where: {
            id: assignment.id,
            order_dispatch_id: dispatchId,
            target_tenant_id: actor.tenantId,
            status: OrderDispatchAssignmentStatus.pending,
            is_current: true,
          },
          include: {
            quote_lines: true,
            order_dispatch: {
              include: { order: { include: { order_items: true } } },
            },
          },
        });
        if (!current) throw new NotFoundException('Assigned order not found');
        if (current.order_dispatch.order.status !== OrderStatus.DRAFT) {
          throw new BadRequestException('Order pricing is already locked');
        }

        const versionUpdate = await manager.orderDispatchAssignment.updateMany({
          where: {
            id: current.id,
            version: dto.expected_version,
            status: OrderDispatchAssignmentStatus.pending,
            is_current: true,
          },
          data: {
            status: OrderDispatchAssignmentStatus.accepted,
            responded_by_user_id: actor.userId,
            responded_at: new Date(),
            version: { increment: 1 },
          },
        });
        if (versionUpdate.count !== 1) this.throwVersionConflict();

        const quoteByItem = new Map(
          current.quote_lines.map((line) => [line.order_item_id, line]),
        );
        for (const item of current.order_dispatch.order.order_items) {
          const quote = quoteByItem.get(item.id);
          if (!quote) continue;
          await manager.orderItem.update({
            where: { id: item.id },
            data: {
              unit_price: quote.unit_price,
              total_price: quote.total_price,
            },
          });
        }

        const refreshedItems = await manager.orderItem.findMany({
          where: { order_id: current.order_dispatch.order_id },
        });
        const subtotal = this.roundCurrency(
          refreshedItems.reduce(
            (sum, item) =>
              item.is_out_of_stock ? sum : sum + Number(item.total_price || 0),
            0,
          ),
        );
        const oldTotal = Number(current.order_dispatch.order.total || 0);
        const newTotal = this.roundCurrency(
          subtotal + Number(current.order_dispatch.order.delivery_fee || 0),
        );
        const order = await manager.order.update({
          where: { id: current.order_dispatch.order_id },
          data: {
            subtotal: new Prisma.Decimal(subtotal),
            total: new Prisma.Decimal(newTotal),
            pricing_mode: PricingMode.MANUAL,
            status: OrderStatus.CONFIRMED,
          },
        });
        await manager.orderDispatch.update({
          where: { id: dispatchId },
          data: {
            status: OrderDispatchStatus.accepted,
            accepted_at: new Date(),
            version: { increment: 1 },
          },
        });
        await this.activityLogService.create(
          {
            tenantId: operatorTenantId,
            actorUserId: actor.userId,
            entityType: ActivityEntityTypes.OrderDispatch,
            entityId: dispatchId,
            action: ActivityActions.OrderDispatchAccepted,
            title: 'قبل المتجر طلب المنطقة وتم تثبيت السعر',
            oldValues: {
              dispatch_status: OrderDispatchStatus.awaiting_merchant,
              order_status: OrderStatus.DRAFT,
              total: oldTotal,
            },
            newValues: {
              dispatch_status: OrderDispatchStatus.accepted,
              order_status: OrderStatus.CONFIRMED,
              total: newTotal,
            },
            metadata: { price_changed: oldTotal !== newTotal },
            source: ActivitySources.Dashboard,
          },
          manager,
        );
        return { order, oldTotal, newTotal };
      },
    );

    await this.ordersService.invalidateOrderCaches(operatorTenantId);
    if (
      accepted.order.customer_phone &&
      accepted.oldTotal !== accepted.newTotal
    ) {
      await this.notifications.notifyAcceptance({
        customerPhone: accepted.order.customer_phone,
        customerName: accepted.order.customer_name || 'عميل',
        orderNumber: String(accepted.order.id),
        publicToken: accepted.order.public_token,
        merchantName: assignment.target_tenant.name,
        oldTotal: accepted.oldTotal,
        newTotal: accepted.newTotal,
      });
    }
    return this.findAssignedOrder(actor, dispatchId);
  }

  /** Progresses an accepted assigned order without allowing merchant cancellation. */
  async updateAssignedStatus(
    actor: MerchantRequestActor,
    dispatchId: number,
    dto: UpdateAssignedOrderStatusDto,
  ) {
    const assignment = await this.requireMerchantAssignment(
      dispatchId,
      actor.tenantId,
      OrderDispatchAssignmentStatus.accepted,
    );
    const operatorTenantId =
      assignment.order_dispatch.zone_storefront.operator_tenant_id;
    const order = await this.zoneStorefrontsService.runInOperatorTenant(
      operatorTenantId,
      async (manager) => {
        const currentOrder = await manager.order.findUnique({
          where: { id: assignment.order_dispatch.order_id },
        });
        if (!currentOrder) throw new NotFoundException('Assigned order not found');
        const validTransition =
          (currentOrder.status === OrderStatus.CONFIRMED &&
            dto.status === OrderStatus.OUT_FOR_DELIVERY) ||
          (currentOrder.status === OrderStatus.OUT_FOR_DELIVERY &&
            dto.status === OrderStatus.COMPLETED);
        if (!validTransition) {
          throw new BadRequestException('Invalid fulfillment status transition');
        }
        const updatedOrder = await manager.order.update({
          where: { id: currentOrder.id },
          data: { status: dto.status },
        });
        if (dto.status === OrderStatus.COMPLETED) {
          await manager.customer.update({
            where: { id: currentOrder.customer_id },
            data: { completed_order_count: { increment: 1 } },
          });
        }
        await this.activityLogService.create(
          {
            tenantId: operatorTenantId,
            actorUserId: actor.userId,
            entityType: ActivityEntityTypes.Order,
            entityId: currentOrder.id,
            action: ActivityActions.OrderStatusChanged,
            title: 'تم تحديث حالة تنفيذ طلب المنطقة',
            oldValues: { status: currentOrder.status },
            newValues: { status: dto.status },
            metadata: { dispatch_id: dispatchId },
            source: ActivitySources.Dashboard,
          },
          manager,
        );
        return updatedOrder;
      },
    );

    await this.ordersService.invalidateOrderCaches(operatorTenantId);
    if (order.customer_phone) {
      await this.notifications.notifyCustomerStatus({
        customerPhone: order.customer_phone,
        customerName: order.customer_name || 'عميل',
        orderNumber: String(order.id),
        statusLabel:
          dto.status === OrderStatus.COMPLETED ? 'تم التوصيل' : 'خرج للتوصيل',
      });
    }
    return this.findAssignedOrder(actor, dispatchId);
  }

  /** Uses the existing customer-visible replacement flow for an accepted dispatch. */
  async updateAssignedReplacement(
    actor: MerchantRequestActor,
    dispatchId: number,
    orderItemId: number,
    dto: UpdateAssignedOrderReplacementDto,
  ) {
    const assignment = await this.requireMerchantAssignment(
      dispatchId,
      actor.tenantId,
      OrderDispatchAssignmentStatus.accepted,
    );
    const operatorTenantId =
      assignment.order_dispatch.zone_storefront.operator_tenant_id;
    const savedItem = await this.zoneStorefrontsService.runInOperatorTenant(
      operatorTenantId,
      async (manager) => {
        await this.requireOrderItemForDispatch(
          manager,
          assignment.order_dispatch.order_id,
          orderItemId,
        );
        if (dto.replacement_product_id) {
          const catalogSource = resolveCatalogSourceForTenantCategory(
            assignment.order_dispatch.zone_storefront.operator_tenant.category,
          );
          const allowedCategories = catalogSource
            ? getAllowedCatalogCategoriesForSource(catalogSource)
            : [];
          const replacement = await manager.product.findFirst({
            where: {
              id: dto.replacement_product_id,
              tenant_id: operatorTenantId,
              catalog_item_id: { not: null },
              source: ProductSource.catalog,
              status: ProductStatus.active,
              is_available: true,
              deleted_at: null,
              category: { in: allowedCategories },
            },
            select: { id: true },
          });
          if (!replacement) {
            throw new NotFoundException('Replacement product not found');
          }
        }
        return this.ordersService.replaceOrderItem(
          operatorTenantId,
          orderItemId,
          dto.replacement_product_id ?? null,
          { userId: actor.userId, source: ActivitySources.Dashboard },
          { skipCustomerNotification: true },
        );
      },
    );
    await this.zoneStorefrontsService.runInOperatorTenant(
      operatorTenantId,
      () =>
        this.ordersService.notifyCustomerReplacementRequestedAfterCommit(
          assignment.order_dispatch.order_id,
          orderItemId,
        ),
    );
    return savedItem;
  }

  /** Resets a replacement decision for an accepted assigned order. */
  async resetAssignedReplacement(
    actor: MerchantRequestActor,
    dispatchId: number,
    orderItemId: number,
  ) {
    const assignment = await this.requireMerchantAssignment(
      dispatchId,
      actor.tenantId,
      OrderDispatchAssignmentStatus.accepted,
    );
    const operatorTenantId =
      assignment.order_dispatch.zone_storefront.operator_tenant_id;
    return this.zoneStorefrontsService.runInOperatorTenant(
      operatorTenantId,
      async (manager) => {
        await this.requireOrderItemForDispatch(
          manager,
          assignment.order_dispatch.order_id,
          orderItemId,
        );
        return this.ordersService.resetOrderItemReplacement(
          operatorTenantId,
          orderItemId,
          { userId: actor.userId, source: ActivitySources.Dashboard },
        );
      },
    );
  }

  /** Resolves the zone attached to the operator tenant in a management session. */
  private async requireManagedZone(operatorTenantId: number) {
    const zone = await this.prisma.zoneStorefront.findUnique({
      where: { operator_tenant_id: operatorTenantId },
      include: { area: true, operator_tenant: true },
    });
    if (!zone) throw new NotFoundException('Zone storefront not found');
    return zone;
  }

  /** Verifies merchant ownership before entering the operator tenant RLS context. */
  private async requireMerchantAssignment(
    dispatchId: number,
    merchantTenantId: number,
    requiredStatus?: OrderDispatchAssignmentStatus,
  ) {
    const assignment = await this.prisma.orderDispatchAssignment.findFirst({
      where: {
        order_dispatch_id: dispatchId,
        target_tenant_id: merchantTenantId,
        is_current: true,
        ...(requiredStatus ? { status: requiredStatus } : {}),
      },
      include: {
        target_tenant: { select: { id: true, name: true, phone: true } },
        order_dispatch: {
          select: {
            id: true,
            order_id: true,
            status: true,
            zone_storefront: {
              select: {
                id: true,
                name: true,
                operations_phone: true,
                operator_tenant_id: true,
                operator_tenant: {
                  select: { phone: true, category: true },
                },
              },
            },
          },
        },
      },
    });
    if (!assignment) throw new NotFoundException('Assigned order not found');
    return assignment;
  }

  /** Reads one dispatch for an administrator from inside operator tenant RLS. */
  private async readDispatchDetail(
    operatorTenantId: number,
    dispatchId: number,
    zoneId: number,
  ) {
    return this.zoneStorefrontsService.runInOperatorTenant(
      operatorTenantId,
      (manager) =>
        manager.orderDispatch.findFirst({
          where: { id: dispatchId, zone_storefront_id: zoneId },
          select: {
            id: true,
            status: true,
            version: true,
            cancellation_reason: true,
            cancelled_at: true,
            accepted_at: true,
            created_at: true,
            updated_at: true,
            order: {
              select: {
                id: true,
                public_token: true,
                status: true,
                customer_name: true,
                customer_phone: true,
                delivery_address: true,
                delivery_time_window_snapshot: true,
                subtotal: true,
                delivery_fee: true,
                total: true,
                notes: true,
                order_items: true,
              },
            },
            assignments: {
              select: {
                id: true,
                status: true,
                is_current: true,
                version: true,
                reason: true,
                internal_notes: true,
                assigned_at: true,
                responded_at: true,
                target_tenant: { select: { id: true, name: true } },
                assigned_by_admin: { select: { id: true, name: true } },
                responded_by_user: { select: { id: true, name: true } },
                quote_lines: true,
              },
              orderBy: { created_at: 'desc' },
            },
          },
        }),
    );
  }

  /** Reads the explicit minimum fulfillment payload for one assigned merchant. */
  private async readMerchantDispatch(
    operatorTenantId: number,
    dispatchId: number,
    merchantTenantId: number,
    includeHistory: boolean,
  ) {
    return this.zoneStorefrontsService.runInOperatorTenant(
      operatorTenantId,
      (manager) =>
        manager.orderDispatch.findFirst({
          where: {
            id: dispatchId,
            assignments: {
              some: {
                target_tenant_id: merchantTenantId,
                is_current: true,
                status: {
                  in: [
                    OrderDispatchAssignmentStatus.pending,
                    OrderDispatchAssignmentStatus.accepted,
                  ],
                },
              },
            },
          },
          select: {
            id: true,
            status: true,
            version: true,
            created_at: true,
            zone_storefront: { select: { name: true, slug: true } },
            order: {
              select: {
                id: true,
                status: true,
                customer_name: true,
                customer_phone: true,
                delivery_address: true,
                delivery_time_window_snapshot: true,
                subtotal: true,
                delivery_fee: true,
                total: true,
                notes: true,
                order_items: {
                  include: {
                    pending_replacement_product: {
                      select: { id: true, name: true, image_url: true },
                    },
                    replaced_by_product: {
                      select: { id: true, name: true, image_url: true },
                    },
                  },
                },
              },
            },
            assignments: {
              where: includeHistory
                ? { target_tenant_id: merchantTenantId }
                : { target_tenant_id: merchantTenantId, is_current: true },
              select: {
                id: true,
                status: true,
                is_current: true,
                version: true,
                reason: true,
                assigned_at: true,
                responded_at: true,
                quote_lines: true,
              },
              orderBy: { created_at: 'desc' },
            },
          },
        }),
    );
  }

  /** Ensures an item identifier belongs to the already-authorized dispatch order. */
  private async requireOrderItemForDispatch(
    manager: Prisma.TransactionClient,
    orderId: number,
    orderItemId: number,
  ): Promise<void> {
    const item = await manager.orderItem.findFirst({
      where: { id: orderItemId, order_id: orderId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Order item not found');
  }

  /** Throws the stable optimistic concurrency response used by all actors. */
  private throwVersionConflict(): never {
    throw new ConflictException({
      code: 'DISPATCH_VERSION_CONFLICT',
      message: 'Dispatch state changed; refresh and try again',
    });
  }

  /** Parses the numeric portion of legacy quantity snapshots for unit pricing. */
  private parseQuantity(value: string): number {
    const normalized = value.replace(/[^0-9٠-٩.]/g, '').replace(/[٠-٩]/g, (digit) =>
      String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)),
    );
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  /** Normalizes all quote calculations to two decimal places. */
  private roundCurrency(value: number): number {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  /** Removes an upload that failed before the order transaction took ownership. */
  private async deleteUploadedFileQuietly(
    prescriptionFile?: Express.Multer.File,
  ): Promise<void> {
    if (!prescriptionFile?.path) return;

    try {
      await rm(prescriptionFile.path, { force: true });
    } catch {
      // Best-effort cleanup must not hide the original checkout error.
    }
  }
}
