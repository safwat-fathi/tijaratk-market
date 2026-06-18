import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { basename } from 'node:path';
import {
  Order,
  OrderItem,
  DayClosure,
  Prisma,
  OrderSource,
  TenantStatus,
  TenantCategory,
} from '../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CustomersService } from 'src/customers/customers.service';
import { PricingMode } from 'src/common/enums/pricing-mode.enum';
import { OrderStatus } from 'src/common/enums/order-status.enum';
import { TenantsService } from 'src/tenants/tenants.service';
import { OrderWhatsappService } from './order-whatsapp.service';
import { Product } from '../../generated/prisma/client';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { ProductPriceHistory } from '../../generated/prisma/client';
import { ReplacementDecisionStatus } from 'src/common/enums/replacement-decision-status.enum';
import { ReplacementDecisionAction } from './dto/decide-replacement.dto';
import { DbTenantContext } from 'src/common/contexts/db-tenant.context';
import { OrderItemSelectionMode } from 'src/common/enums/order-item-selection-mode.enum';
import { ProductOrderMode } from 'src/common/enums/product-order-mode.enum';
import { OrderType } from 'src/common/enums/order-type.enum';

type DayCloseSummary = {
  orders_count: number;
  cancelled_count: number;
  completed_sales_total: number;
};

type DayCloseComputationSummary = DayCloseSummary & {
  completed_count: number;
  non_cancelled_sales_total: number;
};

type DayClosePayload = DayCloseSummary & {
  id: number;
  closure_date: string;
  closed_at: Date;
};

type DayCloseTodayStatusPayload = {
  is_closed: boolean;
  closure: DayClosePayload | null;
  preview: DayCloseSummary;
};

type CloseDayResultPayload = {
  is_already_closed: boolean;
  closure: DayClosePayload;
  whatsapp_sent: boolean;
};

type OrderWithItemsPayload = Order & {
  order_items?: OrderItem[];
  items?: OrderItem[];
};

type PrescriptionUpload = Pick<
  Express.Multer.File,
  'filename' | 'mimetype' | 'originalname' | 'path'
>;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private static readonly MAX_TRACKING_TOKENS = 15;
  private static readonly CAIRO_TIME_ZONE = 'Africa/Cairo';
  private static readonly CANCELLED_STATUSES = [
    OrderStatus.CANCELLED,
    OrderStatus.REJECTED_BY_CUSTOMER,
  ] as const;

  constructor(
    private readonly prisma: PrismaService,

    private readonly customersService: CustomersService,
    private readonly tenantsService: TenantsService,
    private readonly orderWhatsappService: OrderWhatsappService,
  ) {}

  async createForTenantSlug(
    tenantSlug: string,
    createOrderDto: CreateOrderDto,
    prescriptionUpload?: PrescriptionUpload,
  ): Promise<Order> {
    const tenant = await this.tenantsService.findOneBySlug(tenantSlug);
    if (!tenant) {
      await this.deleteUploadedFileQuietly(prescriptionUpload);
      throw new NotFoundException(`Tenant with slug ${tenantSlug} not found`);
    }

    if (tenant.status === TenantStatus.suspended) {
      await this.deleteUploadedFileQuietly(prescriptionUpload);
      throw new ForbiddenException('هذا المتجر غير متاح حاليا');
    }

    if (tenant.delivery_available === false) {
      await this.deleteUploadedFileQuietly(prescriptionUpload);
      throw new BadRequestException('التوصيل غير متاح حاليا');
    }

    if (
      createOrderDto.prescription_unavailability_action &&
      !prescriptionUpload
    ) {
      throw new BadRequestException('Prescription file is required');
    }

    if (prescriptionUpload && tenant.category !== TenantCategory.pharmacy) {
      await this.deleteUploadedFileQuietly(prescriptionUpload);
      throw new BadRequestException(
        'Prescription uploads are only available for pharmacy stores',
      );
    }

    return this.createForTenantId(tenant.id, createOrderDto, prescriptionUpload);
  }

  /**
   * Creates an order and items while preserving historical snapshots.
   */
  async createForTenantId(
    tenantId: number,
    createOrderDto: CreateOrderDto,
    prescriptionUpload?: PrescriptionUpload,
  ): Promise<Order> {
    let isFirstOrder = false;

    let savedOrder: Order;
    try {
      savedOrder = await this.withTenantManager(tenantId, async (manager) => {
        const deliveryAreaId = await this.resolveDeliveryAreaId(
          manager,
          tenantId,
          createOrderDto,
        );
        const customer = await this.customersService.findOrCreate(
          createOrderDto.customer.phone,
          tenantId,
          createOrderDto.customer.name,
          createOrderDto.customer.address,
          manager,
          deliveryAreaId,
        );

        const hasItems = Boolean(createOrderDto.items?.length);
        const items = createOrderDto.items || [];
        const resolvedOrderType =
          createOrderDto.order_type ??
          (hasItems ? OrderType.CATALOG : OrderType.FREE_TEXT);

        const productIds = Array.from(
          new Set(
            items
              .map((item) => item.product_id)
              .filter((id): id is number => typeof id === 'number'),
          ),
        );

        const products = productIds.length
          ? await manager.product.findMany({
              where: {
                id: { in: productIds },
                tenant_id: tenantId,
                status: ProductStatus.ACTIVE,
              },
            })
          : [];

        const productsById = new Map<number, any>(
          products.map((product) => [product.id, product]),
        );

        const tenant = await manager.tenant.findUnique({
          where: { id: tenantId },
        });
        const deliveryFee = Number(tenant?.delivery_fee || 0);

        let deliveryTimeWindowSnapshot: string | null = null;
        if (tenant?.delivery_starts_at && tenant?.delivery_ends_at) {
          const formatTime = (time: string) => {
            const [hours, minutes] = time.split(':');
            const h = parseInt(hours, 10);
            const period = h >= 12 ? 'مساءً' : 'صباحاً';
            const h12 = h % 12 || 12;
            return `${h12}:${minutes} ${period}`;
          };
          deliveryTimeWindowSnapshot = `من ${formatTime(tenant.delivery_starts_at)} إلى ${formatTime(tenant.delivery_ends_at)}`;
        } else {
          deliveryTimeWindowSnapshot = 'طوال اليوم';
        }

        let subtotal: number | undefined;
        let total: number | undefined;
        let pricingMode = PricingMode.MANUAL;

        const orderPayload: Prisma.OrderUncheckedCreateInput = {
          tenant_id: tenantId,
          customer_id: customer.id,
          public_token: randomUUID(),
          order_type: resolvedOrderType,
          status: OrderStatus.DRAFT,
          pricing_mode: pricingMode,
          delivery_fee: deliveryFee,
          delivery_area_id: deliveryAreaId,
          delivery_time_window_snapshot: deliveryTimeWindowSnapshot,
          free_text_payload: createOrderDto.free_text_payload,
          notes: createOrderDto.notes,
          card_on_delivery_requested:
            createOrderDto.card_on_delivery_requested ?? false,
          delivery_address: createOrderDto.customer.address,
          customer_phone: customer.phone,
          customer_name: createOrderDto.customer.name,
          order_source: createOrderDto.order_source ?? OrderSource.storefront,
          source_metadata: createOrderDto.source_metadata
            ? (createOrderDto.source_metadata as Prisma.InputJsonValue)
            : undefined,
          prescription_file_url:
            this.buildPrescriptionFileUrl(prescriptionUpload),
          prescription_original_filename:
            this.normalizePrescriptionOriginalFilename(prescriptionUpload),
          prescription_mime_type: prescriptionUpload?.mimetype?.slice(0, 120),
          prescription_unavailability_action:
            this.normalizePrescriptionUnavailabilityAction(
              createOrderDto.prescription_unavailability_action,
            ),
        };

        const persistedOrder = await manager.order.create({
          data: orderPayload,
        });

        if (hasItems) {
          const orderItemsPayload: Prisma.OrderItemUncheckedCreateInput[] =
            items.map((item) => {
              const matchedProduct = item.product_id
                ? productsById.get(item.product_id)
                : undefined;

              const selectionMode = this.resolveItemSelectionMode(
                item.selection_mode,
                matchedProduct?.order_mode,
              );
              const selectionQuantity =
                item.selection_quantity != null &&
                Number.isFinite(Number(item.selection_quantity)) &&
                Number(item.selection_quantity) > 0
                  ? Number(item.selection_quantity)
                  : null;
              const selectionGrams =
                item.selection_grams != null &&
                Number.isFinite(Number(item.selection_grams)) &&
                Number(item.selection_grams) > 0
                  ? Math.round(Number(item.selection_grams))
                  : null;
              const selectionAmountEgp =
                item.selection_amount_egp != null &&
                Number.isFinite(Number(item.selection_amount_egp)) &&
                Number(item.selection_amount_egp) > 0
                  ? this.roundCurrency(Number(item.selection_amount_egp))
                  : null;
              const unitOptionId =
                typeof item.unit_option_id === 'string'
                  ? item.unit_option_id.trim().slice(0, 64)
                  : null;
              const quantityText = this.resolveQuantityText(
                String(item.quantity).trim(),
                selectionMode,
                selectionQuantity,
                selectionGrams,
                unitOptionId,
                matchedProduct,
              );
              const resolvedUnitPrice = this.resolveItemUnitPrice(
                item.unit_price,
                matchedProduct?.current_price,
              );
              const explicitLineTotal =
                selectionMode === OrderItemSelectionMode.PRICE
                  ? (selectionAmountEgp ?? item.total_price)
                  : item.total_price;
              const lineTotal = this.resolveItemTotal(
                quantityText,
                resolvedUnitPrice ?? undefined,
                explicitLineTotal,
              );

              return {
                order_id: persistedOrder.id,
                product_id: matchedProduct?.id,
                name_snapshot:
                  item.name?.trim() || matchedProduct?.name || 'منتج غير محدد',
                quantity: quantityText,
                unit_price: resolvedUnitPrice,
                total_price: lineTotal,
                notes: item.notes,
                selection_mode: selectionMode,
                selection_quantity: selectionQuantity,
                selection_grams: selectionGrams,
                selection_amount_egp: selectionAmountEgp,
                unit_option_id: unitOptionId,
              };
            });

          await manager.orderItem.createMany({
            data: orderItemsPayload as any,
          });
          const orderItems = await manager.orderItem.findMany({
            where: { order_id: persistedOrder.id },
          });

          const pricedLines = orderItems
            .map((item) =>
              item.total_price !== null ? Number(item.total_price) : null,
            )
            .filter(
              (value): value is number =>
                value !== null && !Number.isNaN(value),
            );

          if (pricedLines.length > 0) {
            subtotal = this.roundCurrency(
              pricedLines.reduce((sum, lineTotal) => sum + lineTotal, 0),
            );
          }
        }

        if (createOrderDto.total != null) {
          pricingMode = PricingMode.MANUAL;
          total = Number(createOrderDto.total);
        } else if (subtotal !== undefined) {
          pricingMode = PricingMode.AUTO;
          total = this.roundCurrency(subtotal + Number(deliveryFee));
        } else if (deliveryFee > 0) {
          pricingMode = PricingMode.MANUAL;
          total = Number(deliveryFee);
        } else {
          pricingMode = PricingMode.MANUAL;
          total = undefined;
        }

        await manager.order.update({
          where: { id: persistedOrder.id },
          data: { pricing_mode: pricingMode, subtotal, total },
        });
        persistedOrder.pricing_mode = pricingMode;
        persistedOrder.subtotal =
          subtotal === undefined ? null : new Prisma.Decimal(subtotal);
        persistedOrder.total =
          total === undefined ? null : new Prisma.Decimal(total);

        await manager.customer.update({
          where: { id: customer.id },
          data: { order_count: { increment: 1 }, last_order_at: new Date() },
        });

        if (customer.order_count === 0) {
          isFirstOrder = true;
        }

        return persistedOrder;
      });
    } catch (error) {
      await this.deleteUploadedFileQuietly(prescriptionUpload);
      throw error;
    }

    const completeOrder = await this.findOne(savedOrder.id);
    await this.notifyOrderCreated(completeOrder, isFirstOrder);

    return completeOrder;
  }

  async findAll(tenantId: number, date?: string): Promise<Order[]> {
    const whereClause: Prisma.OrderWhereInput = { tenant_id: tenantId };
    if (date) {
      whereClause.created_at = {
        gte: new Date(`${date}T00:00:00.000+02:00`),
        lte: new Date(`${date}T23:59:59.999+02:00`),
      };
    }
    const orders = await this.orderClient().findMany({
      where: whereClause,
      include: {
        customer: true,
        order_items: {
          include: {
            replaced_by_product: true,
            pending_replacement_product: true,
          },
        },
        delivery_area: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return orders.map((order) => this.mapOrderPayload(order));
  }

  /**
   * Returns today's close-day status and preview using Cairo day boundaries.
   */
  async getTodayDayCloseStatus(
    tenantId: number,
  ): Promise<DayCloseTodayStatusPayload> {
    const closureDate = this.getCairoDateKey();
    const closureDateValue = this.toDateOnlyValue(closureDate);

    const [closure, preview] = await Promise.all([
      this.dayClosureClient().findFirst({
        where: {
          tenant_id: tenantId,
          closure_date: closureDateValue,
        },
      }),
      this.computeDayCloseSummary(tenantId, closureDate),
    ]);

    return {
      is_closed: Boolean(closure),
      closure: closure ? this.mapDayClosure(closure) : null,
      preview: {
        orders_count: preview.orders_count,
        cancelled_count: preview.cancelled_count,
        completed_sales_total: preview.completed_sales_total,
      },
    };
  }

  /**
   * Closes current Cairo day for tenant with idempotent behavior.
   */
  async closeDay(tenantId: number): Promise<CloseDayResultPayload> {
    const closureDate = this.getCairoDateKey();
    const closureDateValue = this.toDateOnlyValue(closureDate);

    const existingClosure = await this.dayClosureClient().findFirst({
      where: {
        tenant_id: tenantId,
        closure_date: closureDateValue,
      },
    });

    if (existingClosure) {
      return {
        is_already_closed: true,
        closure: this.mapDayClosure(existingClosure),
        whatsapp_sent: false,
      };
    }

    const summary = await this.computeDayCloseSummary(tenantId, closureDate);

    const closure = {
      tenant_id: tenantId,
      closure_date: closureDateValue,
      orders_count: summary.orders_count,
      cancelled_count: summary.cancelled_count,
      completed_sales_total: summary.completed_sales_total,
      closed_at: new Date(),
    };

    let savedClosure: DayClosure;
    try {
      savedClosure = await this.dayClosureClient().create({ data: closure });
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      const duplicateClosure = await this.dayClosureClient().findFirst({
        where: {
          tenant_id: tenantId,
          closure_date: closureDateValue,
        },
      });

      if (!duplicateClosure) {
        throw error;
      }

      return {
        is_already_closed: true,
        closure: this.mapDayClosure(duplicateClosure),
        whatsapp_sent: false,
      };
    }

    const tenant = await this.tenantsService.findOneById(tenantId);
    let whatsappSent = false;

    if (tenant?.phone) {
      try {
        whatsappSent =
          await this.orderWhatsappService.notifyMerchantDailySummary({
            phone: tenant.phone,
            date: this.formatCairoDateForMessage(closureDate),
            totalOrders: summary.orders_count,
            completedOrders: summary.completed_count,
            cancelledOrders: summary.cancelled_count,
            totalSalesEgp: summary.non_cancelled_sales_total,
            totalCollectedEgp: summary.completed_sales_total,
          });
      } catch (error) {
        this.logger.warn(
          `Failed to send close-day summary to tenant ${tenantId}`,
          error,
        );
      }
    }

    return {
      is_already_closed: false,
      closure: this.mapDayClosure(savedClosure),
      whatsapp_sent: whatsappSent,
    };
  }

  async findOne(id: number): Promise<Order> {
    const order = await this.orderClient().findFirst({
      where: { id },
      include: {
        customer: true,
        order_items: {
          include: {
            replaced_by_product: true,
            pending_replacement_product: true,
          },
        },
        tenant: true,
        delivery_area: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return this.mapOrderPayload(order);
  }

  async update(id: number, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);
    const previousStatus = order.status as unknown as OrderStatus;
    const nextStatus = updateOrderDto.status;

    if (nextStatus && nextStatus !== previousStatus) {
      this.validateStatusTransition(previousStatus, nextStatus);
    }

    const updateData: Prisma.OrderUpdateInput = {};

    if (nextStatus !== undefined) {
      updateData.status = nextStatus;
    }

    if (nextStatus === OrderStatus.CANCELLED) {
      updateData.merchant_cancellation_reason = this.normalizeOptionalReason(
        updateOrderDto.cancellation_reason,
      );
      updateData.merchant_cancelled_at = new Date();
    }

    if (updateOrderDto.total !== undefined) {
      updateData.total = updateOrderDto.total;
      updateData.pricing_mode = PricingMode.MANUAL;
    }

    const savedOrder = await this.orderClient().update({
      where: { id: order.id },
      data: updateData,
      include: {
        customer: true,
        order_items: {
          include: {
            replaced_by_product: true,
            pending_replacement_product: true,
          },
        },
        tenant: true,
        delivery_area: true,
      },
    });

    if (nextStatus && nextStatus !== previousStatus) {
      await this.notifyCustomerStatusChange(savedOrder);
    }

    return this.mapOrderPayload(savedOrder);
  }

  /**
   * Sets or clears pending replacement product for a specific order item.
   */
  async replaceOrderItem(
    tenantId: number,
    itemId: number,
    replacementProductId: number | null,
  ): Promise<OrderItem> {
    const orderItem = await this.orderItemClient().findFirst({
      where: { id: itemId },
      include: { order: true },
    });

    if (!orderItem || orderItem.order.tenant_id !== tenantId) {
      throw new NotFoundException(`Order item with ID ${itemId} not found`);
    }

    this.ensureCustomerDecisionWindow(orderItem.order.status as any);

    if (
      orderItem.replacement_decision_status ===
        ReplacementDecisionStatus.APPROVED ||
      orderItem.replacement_decision_status ===
        ReplacementDecisionStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Replacement decision is locked. Reset replacement decision before changing it.',
      );
    }

    if (replacementProductId === null) {
      return this.orderItemClient().update({
        where: { id: orderItem.id },
        data: {
          pending_replacement_product_id: null,
          replaced_by_product_id: null,
          replacement_decision_status: ReplacementDecisionStatus.NONE,
          replacement_decision_reason: null,
          replacement_decided_at: null,
        },
      }) as unknown as OrderItem;
    }

    const replacement = await this.productClient().findFirst({
      where: {
        id: replacementProductId,
        tenant_id: tenantId,
        status: ProductStatus.ACTIVE,
      },
    });

    if (!replacement) {
      throw new NotFoundException(
        `Replacement product with ID ${replacementProductId} not found`,
      );
    }

    const savedItem = await this.orderItemClient().update({
      where: { id: orderItem.id },
      data: {
        pending_replacement_product_id: replacement.id,
        replaced_by_product_id: null,
        replacement_decision_status: ReplacementDecisionStatus.PENDING,
        replacement_decision_reason: null,
        replacement_decided_at: null,
      },
    });

    await this.notifyCustomerReplacementRequested(
      savedItem.order_id,
      savedItem.id,
    );

    return savedItem;
  }

  /**
   * Clears replacement decision state so merchant can request another customer decision.
   */
  async resetOrderItemReplacement(
    tenantId: number,
    itemId: number,
  ): Promise<OrderItem> {
    const orderItem = await this.orderItemClient().findFirst({
      where: { id: itemId },
      include: { order: true },
    });

    if (!orderItem || orderItem.order.tenant_id !== tenantId) {
      throw new NotFoundException(`Order item with ID ${itemId} not found`);
    }

    this.ensureCustomerDecisionWindow(orderItem.order.status as any);

    return this.orderItemClient().update({
      where: { id: orderItem.id },
      data: {
        pending_replacement_product_id: null,
        replaced_by_product_id: null,
        replacement_decision_status: ReplacementDecisionStatus.NONE,
        replacement_decision_reason: null,
        replacement_decided_at: null,
      },
    }) as unknown as OrderItem;
  }

  /**
   * Applies customer approval/rejection decision on a pending item replacement.
   */
  async decideReplacementByPublicToken(
    token: string,
    itemId: number,
    decision: ReplacementDecisionAction,
    reason?: string,
  ): Promise<OrderItem> {
    const orderItem = await this.orderItemClient().findFirst({
      where: {
        id: itemId,
        order: {
          public_token: token,
        },
      },
      include: { order: true },
    });

    if (!orderItem) {
      throw new NotFoundException(
        `Order item with ID ${itemId} for token ${token} not found`,
      );
    }

    this.ensureCustomerDecisionWindow(orderItem.order.status as any);

    if (
      orderItem.replacement_decision_status !==
        ReplacementDecisionStatus.PENDING ||
      !orderItem.pending_replacement_product_id
    ) {
      throw new BadRequestException(
        'No pending replacement available for customer decision',
      );
    }

    const normalizedReason = this.normalizeOptionalReason(reason);

    if (
      decision !== ReplacementDecisionAction.APPROVE &&
      decision !== ReplacementDecisionAction.REJECT
    ) {
      throw new BadRequestException('Invalid replacement decision');
    }

    const savedItem = await this.orderItemClient().update({
      where: { id: orderItem.id },
      data:
        decision === ReplacementDecisionAction.APPROVE
          ? {
              replaced_by_product_id: orderItem.pending_replacement_product_id,
              pending_replacement_product_id: null,
              replacement_decision_status: ReplacementDecisionStatus.APPROVED,
              replacement_decision_reason: normalizedReason,
              replacement_decided_at: new Date(),
            }
          : {
              replaced_by_product_id: null,
              pending_replacement_product_id: null,
              replacement_decision_status: ReplacementDecisionStatus.REJECTED,
              replacement_decision_reason: normalizedReason,
              replacement_decided_at: new Date(),
            },
    });

    await this.notifyMerchantReplacementDecision(
      savedItem.order_id,
      savedItem.id,
      decision,
      normalizedReason,
    );

    return savedItem;
  }

  /**
   * Sets order as rejected by customer through public tracking token.
   */
  async rejectOrderByPublicToken(
    token: string,
    reason?: string,
  ): Promise<Order> {
    const order = await this.orderClient().findFirst({
      where: { public_token: token },
      include: { customer: true, tenant: true, delivery_area: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with token ${token} not found`);
    }

    this.ensureCustomerDecisionWindow(order.status as any);

    const savedOrder = await this.orderClient().update({
      where: { id: order.id },
      data: {
        status: OrderStatus.REJECTED_BY_CUSTOMER,
        customer_rejection_reason: this.normalizeOptionalReason(reason),
        customer_rejected_at: new Date(),
      },
      include: { customer: true, tenant: true, delivery_area: true },
    }) as unknown as Order;

    await this.notifyCustomerStatusChange(savedOrder);
    return savedOrder;
  }

  /**
   * Sets manual line price for an order item and recalculates order totals.
   */
  async updateOrderItemPrice(
    tenantId: number,
    itemId: number,
    totalPrice: number,
  ): Promise<OrderItem> {
    const normalizedTotal = this.roundCurrency(Number(totalPrice));
    if (Number.isNaN(normalizedTotal) || normalizedTotal <= 0) {
      throw new BadRequestException('Item price must be a positive number');
    }

    return this.withTenantManager(tenantId, async (manager) => {
      const orderItemRepository = manager.orderItem;
      const orderRepository = manager.order;

      const orderItem = await orderItemRepository.findFirst({
        where: { id: itemId },
        include: { order: true },
      });

      if (!orderItem || orderItem.order.tenant_id !== tenantId) {
        throw new NotFoundException(`Order item with ID ${itemId} not found`);
      }

      if (
        orderItem.order.status !== OrderStatus.DRAFT &&
        orderItem.order.status !== OrderStatus.CONFIRMED
      ) {
        throw new BadRequestException(
          'Item prices can only be updated for draft or confirmed orders',
        );
      }

      const numericQty = this.parseNumericQuantity(orderItem.quantity);
      const normalizedUnitPrice =
        numericQty !== null && numericQty > 0
          ? this.roundCurrency(normalizedTotal / numericQty)
          : normalizedTotal;

      const savedItem = (await orderItemRepository.update({
        where: { id: orderItem.id },
        data: {
          total_price: new Prisma.Decimal(normalizedTotal),
          unit_price: new Prisma.Decimal(normalizedUnitPrice),
        },
      })) as any;

      const order = await orderRepository.findFirst({
        where: { id: orderItem.order_id },
      });
      if (!order) {
        throw new NotFoundException(
          `Order with ID ${orderItem.order_id} not found`,
        );
      }

      const orderItems = await orderItemRepository.findMany({
        where: { order_id: order.id },
        select: { total_price: true },
      });

      const pricedLines = orderItems
        .map((item) =>
          item.total_price !== null ? Number(item.total_price) : null,
        )
        .filter(
          (value): value is number => value !== null && !Number.isNaN(value),
        );

      const subtotal =
        pricedLines.length > 0
          ? this.roundCurrency(
              pricedLines.reduce((sum, value) => sum + value, 0),
            )
          : undefined;

      const deliveryFee = Number(order.delivery_fee || 0);

      let recomputedTotal: number | undefined;
      if (subtotal !== undefined) {
        recomputedTotal = this.roundCurrency(subtotal + deliveryFee);
      } else if (deliveryFee > 0) {
        recomputedTotal = this.roundCurrency(deliveryFee);
      } else {
        recomputedTotal = undefined;
      }

      await orderRepository.update({
        where: { id: order.id },
        data: {
          pricing_mode: PricingMode.MANUAL,
          subtotal:
            subtotal === undefined ? null : new Prisma.Decimal(subtotal),
          total:
            recomputedTotal === undefined
              ? null
              : new Prisma.Decimal(recomputedTotal),
        },
      });

      const targetProductId =
        orderItem.replaced_by_product_id ?? orderItem.product_id ?? null;
      if (targetProductId) {
        await this.updateProductPriceHistory(
          manager,
          tenantId,
          targetProductId,
          normalizedUnitPrice,
        );
      }

      return savedItem;
    });
  }

  async findByPublicToken(token: string): Promise<Order> {
    const order = await this.orderClient().findFirst({
      where: { public_token: token },
      include: {
        customer: true,
        order_items: {
          include: {
            replaced_by_product: true,
            pending_replacement_product: true,
          },
        },
        tenant: { select: { id: true, name: true, slug: true } },
        delivery_area: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with token ${token} not found`);
    }

    return this.mapOrderPayload(order);
  }

  async findByPublicTokens(tokens: string[]): Promise<Order[]> {
    const normalizedTokens = this.normalizeTrackingTokens(tokens);
    if (normalizedTokens.length === 0) {
      return [];
    }

    const orders = await this.orderClient().findMany({
      where: { public_token: { in: normalizedTokens } },
      include: {
        customer: true,
        order_items: {
          include: {
            replaced_by_product: true,
            pending_replacement_product: true,
          },
        },
        tenant: { select: { id: true, name: true, slug: true } },
        delivery_area: true,
      },
    });

    const ordersByToken = new Map(
      orders.map((order) => [order.public_token, order]),
    );

    return normalizedTokens
      .map((token) => ordersByToken.get(token))
      .filter((order) => Boolean(order))
      .map((order) => this.mapOrderPayload(order as OrderWithItemsPayload));
  }

  /**
   * Normalizes Prisma relation names to the frontend order contract.
   */
  private mapOrderPayload(order: OrderWithItemsPayload): Order {
    const orderItems = order.order_items;

    return {
      ...order,
      items: order.items ?? orderItems ?? [],
    } as unknown as Order;
  }

  private normalizeTrackingTokens(tokens: string[]): string[] {
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return [];
    }

    const normalized = tokens
      .map((token) => (typeof token === 'string' ? token.trim() : ''))
      .filter((token) => token.length > 0);

    return Array.from(new Set(normalized)).slice(
      0,
      OrdersService.MAX_TRACKING_TOKENS,
    );
  }

  private readonly publicTrackingRelations = {
    customer: true,
    items: {
      replaced_by_product: true,
      pending_replacement_product: true,
    },
    tenant: true,
  } as const;

  private readonly publicTrackingSelect = {
    tenant: {
      id: true,
      name: true,
      slug: true,
    },
  } as const;

  /**
   * Aggregates close-day metrics for a specific tenant and Cairo date.
   */
  private async computeDayCloseSummary(
    tenantId: number,
    closureDate: string,
  ): Promise<DayCloseComputationSummary> {
    type AggregateCount = string | number | null;
    const orders = await this.orderClient().findMany({
      where: {
        tenant_id: tenantId,
        created_at: {
          gte: new Date(`${closureDate}T00:00:00.000+02:00`),
          lte: new Date(`${closureDate}T23:59:59.999+02:00`),
        },
      },
      select: { id: true, status: true, total: true },
    });

    const dayAggregate = {
      orders_count: orders.length,
      cancelled_count: orders.filter((o: any) =>
        OrdersService.CANCELLED_STATUSES.includes(o.status),
      ).length,
      completed_count: orders.filter(
        (o: any) => o.status === OrderStatus.COMPLETED,
      ).length,
      non_cancelled_sales_total: orders
        .filter(
          (o: any) => !OrdersService.CANCELLED_STATUSES.includes(o.status),
        )
        .reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0),
      completed_sales_total: orders
        .filter((o: any) => o.status === OrderStatus.COMPLETED)
        .reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0),
    };

    return {
      orders_count: this.toSafeInt(dayAggregate?.orders_count),
      cancelled_count: this.toSafeInt(dayAggregate?.cancelled_count),
      completed_count: this.toSafeInt(dayAggregate?.completed_count),
      non_cancelled_sales_total: this.toSafeCurrency(
        dayAggregate?.non_cancelled_sales_total,
      ),
      completed_sales_total: this.toSafeCurrency(
        dayAggregate?.completed_sales_total,
      ),
    };
  }

  /**
   * Maps persisted closure entity to API payload.
   */
  private mapDayClosure(closure: DayClosure): DayClosePayload {
    return {
      id: closure.id,
      closure_date: this.formatDateOnlyValue(closure.closure_date),
      closed_at: closure.closed_at,
      orders_count: this.toSafeInt(closure.orders_count),
      cancelled_count: this.toSafeInt(closure.cancelled_count),
      completed_sales_total: this.toSafeCurrency(closure.completed_sales_total),
    };
  }

  /**
   * Gets current date key (YYYY-MM-DD) in Cairo timezone.
   */
  private getCairoDateKey(date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: OrdersService.CAIRO_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) {
      throw new Error('Failed to resolve Cairo date key');
    }

    return `${year}-${month}-${day}`;
  }

  /**
   * Converts a YYYY-MM-DD key into a Date value accepted by Prisma for @db.Date.
   */
  private toDateOnlyValue(dateKey: string): Date {
    return new Date(`${dateKey}T00:00:00.000Z`);
  }

  /**
   * Formats a persisted date-only value for API responses.
   */
  private formatDateOnlyValue(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /**
   * Formats closure date for merchant-facing WhatsApp message.
   */
  private formatCairoDateForMessage(closureDate: string): string {
    const [year, month, day] = closureDate.split('-').map(Number);

    if (
      !year ||
      !month ||
      !day ||
      Number.isNaN(year) ||
      Number.isNaN(month) ||
      Number.isNaN(day)
    ) {
      return closureDate;
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    return new Intl.DateTimeFormat('ar-EG', {
      timeZone: OrdersService.CAIRO_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  /**
   * Returns true when DB error indicates unique constraint violation.
   */
  private isUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const errorCode =
      'code' in error && typeof error.code === 'string' ? error.code : null;

    return errorCode === '23505';
  }

  /**
   * Converts any numeric-like value into an integer fallback.
   */
  private toSafeInt(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.max(0, Math.trunc(parsed));
  }

  /**
   * Converts any numeric-like value into rounded currency fallback.
   */
  private toSafeCurrency(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return this.roundCurrency(parsed);
  }

  private validateStatusTransition(
    current: OrderStatus,
    next: OrderStatus,
  ): void {
    if (current === next) {
      return;
    }

    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.DRAFT]: [
        OrderStatus.CONFIRMED,
        OrderStatus.CANCELLED,
        OrderStatus.REJECTED_BY_CUSTOMER,
      ],
      [OrderStatus.CONFIRMED]: [
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.CANCELLED,
        OrderStatus.REJECTED_BY_CUSTOMER,
      ],
      [OrderStatus.OUT_FOR_DELIVERY]: [
        OrderStatus.COMPLETED,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REJECTED_BY_CUSTOMER]: [],
    };

    // eslint-disable-next-line security/detect-object-injection
    const allowedNext = allowedTransitions[current] || [];
    if (!allowedNext.includes(next)) {
      throw new BadRequestException(
        `Invalid status transition from ${current} to ${next}`,
      );
    }
  }

  /**
   * Resolves total price from explicit total or a unit-price calculation.
   */
  private resolveItemSelectionMode(
    selectionMode?: OrderItemSelectionMode | null,
    productOrderMode?: ProductOrderMode | null,
  ): OrderItemSelectionMode | null {
    if (selectionMode) {
      return selectionMode;
    }

    if (productOrderMode === ProductOrderMode.WEIGHT) {
      return OrderItemSelectionMode.WEIGHT;
    }

    if (productOrderMode === ProductOrderMode.PRICE) {
      return OrderItemSelectionMode.PRICE;
    }

    if (productOrderMode === ProductOrderMode.QUANTITY) {
      return OrderItemSelectionMode.QUANTITY;
    }

    return null;
  }

  private resolveQuantityText(
    fallbackQuantityText: string,
    selectionMode: OrderItemSelectionMode | null,
    selectionQuantity: number | null,
    selectionGrams: number | null,
    unitOptionId: string | null,
    matchedProduct?: Product,
  ): string {
    if (selectionMode === OrderItemSelectionMode.WEIGHT && selectionGrams) {
      return Number((selectionGrams / 1000).toFixed(3)).toString();
    }

    if (selectionMode === OrderItemSelectionMode.PRICE) {
      return '1';
    }

    if (
      selectionMode === OrderItemSelectionMode.QUANTITY &&
      selectionQuantity
    ) {
      const multiplier = this.resolveUnitOptionMultiplier(
        matchedProduct?.order_config as any,
        unitOptionId,
      );
      return Number((selectionQuantity * multiplier).toFixed(3)).toString();
    }

    return fallbackQuantityText || '1';
  }

  private resolveUnitOptionMultiplier(
    orderConfig: Product['order_config'],
    unitOptionId: string | null,
  ): number {
    if (!unitOptionId || !orderConfig || typeof orderConfig !== 'object') {
      return 1;
    }

    const config = orderConfig as {
      quantity?: { unit_options?: Array<{ id?: string; multiplier?: number }> };
    };
    const options = config.quantity?.unit_options;
    if (!Array.isArray(options) || options.length === 0) {
      return 1;
    }

    for (const option of options) {
      if (!option || typeof option !== 'object') {
        continue;
      }

      if (option.id !== unitOptionId) {
        continue;
      }

      const multiplier = Number(option.multiplier);
      if (Number.isFinite(multiplier) && multiplier > 0) {
        return multiplier;
      }
    }

    return 1;
  }

  private resolveItemTotal(
    quantityText: string,
    unitPrice?: number,
    totalPrice?: number,
  ): number | null {
    if (totalPrice != null) {
      return this.roundCurrency(Number(totalPrice));
    }

    if (unitPrice == null) {
      return null;
    }

    const numericQty = this.parseNumericQuantity(quantityText);
    if (numericQty === null) {
      return null;
    }

    return this.roundCurrency(Number(unitPrice) * numericQty);
  }

  /**
   * Parses numeric quantity from free-text input when possible.
   */
  private parseNumericQuantity(quantityText: string): number | null {
    // eslint-disable-next-line security/detect-unsafe-regex
    const match = /(?:\d+)(?:\.\d+)?/.exec(
      quantityText.trim().replace(',', '.'),
    );
    if (!match) {
      return null;
    }

    const parsed = Number(match[0]);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return null;
    }

    return parsed;
  }

  /**
   * Resolves effective unit price for snapshot storage, preferring explicit item value.
   */
  private resolveItemUnitPrice(
    explicitUnitPrice?: number,
    productCurrentPrice?: number | null,
  ): number | null {
    if (explicitUnitPrice != null) {
      return this.roundCurrency(Number(explicitUnitPrice));
    }

    if (productCurrentPrice != null) {
      const parsed = Number(productCurrentPrice);
      if (!Number.isNaN(parsed)) {
        return this.roundCurrency(parsed);
      }
    }

    return null;
  }

  /**
   * Rounds currency values to 2 decimal places.
   */
  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Updates product price history when line item price is manually overridden.
   */
  private async updateProductPriceHistory(
    manager: Prisma.TransactionClient,
    tenantId: number,
    targetProductId: number,
    normalizedUnitPrice: number,
  ): Promise<void> {
    const targetProduct = await manager.product.findFirst({
      where: {
        id: targetProductId,
        tenant_id: tenantId,
      },
    });

    if (!targetProduct) {
      throw new NotFoundException(
        `Product with ID ${targetProductId} not found`,
      );
    }

    const activeHistory = await manager.productPriceHistory.findFirst({
      where: {
        tenant_id: tenantId,
        product_id: targetProduct.id,
        effective_to: null,
      },
      orderBy: [{ effective_from: 'desc' }, { id: 'desc' }],
    });

    const activeHistoryPrice =
      activeHistory?.price != null
        ? this.roundCurrency(Number(activeHistory.price))
        : null;

    if (
      activeHistory &&
      activeHistoryPrice !== null &&
      activeHistoryPrice === normalizedUnitPrice
    ) {
      await manager.product.update({
        where: { id: targetProduct.id },
        data: { current_price: normalizedUnitPrice },
      });
      return;
    }

    const now = new Date();

    if (activeHistory) {
      await manager.productPriceHistory.update({
        where: { id: activeHistory.id },
        data: { effective_to: now },
      });
    }

    await manager.productPriceHistory.create({
      data: {
        tenant_id: tenantId,
        product_id: targetProduct.id,
        price: normalizedUnitPrice,
        effective_from: now,
        reason: 'manual update from order item',
      },
    });

    await manager.product.update({
      where: { id: targetProduct.id },
      data: { current_price: normalizedUnitPrice },
    });
  }

  /**
   * Ensures replacement decisions are only accepted while the order is still editable.
   */
  private ensureCustomerDecisionWindow(status: OrderStatus): void {
    if (status === OrderStatus.DRAFT || status === OrderStatus.CONFIRMED) {
      return;
    }

    throw new BadRequestException(
      'Customer replacement decision is allowed only for draft or confirmed orders',
    );
  }

  /**
   * Converts optional free-text reason to nullable clean value.
   */
  private normalizeOptionalReason(reason?: string): string | null {
    if (typeof reason !== 'string') {
      return null;
    }

    const trimmed = reason.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  /**
   * Sends customer notification after merchant requests replacement decision.
   */
  private async notifyCustomerReplacementRequested(
    orderId: number,
    itemId: number,
  ): Promise<void> {
    try {
      const order = (await this.findOne(orderId)) as any;
      const item = order.order_items.find((line) => line.id === itemId);
      if (!item || !item.pending_replacement_product) {
        return;
      }

      await this.orderWhatsappService.notifyCustomerReplacementRequested(
        order,
        item,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to notify customer for replacement request on order ${orderId}, item ${itemId}`,
        error,
      );
    }
  }

  /**
   * Sends merchant notification after customer accepts or rejects replacement.
   */
  private async notifyMerchantReplacementDecision(
    orderId: number,
    itemId: number,
    decision: ReplacementDecisionAction,
    reason?: string | null,
  ): Promise<void> {
    try {
      const order = (await this.findOne(orderId)) as any;
      const item = order.order_items.find((line) => line.id === itemId);
      if (!item) {
        return;
      }

      if (decision === ReplacementDecisionAction.APPROVE) {
        await this.orderWhatsappService.notifyMerchantReplacementAccepted(order);
        return;
      }

      await this.orderWhatsappService.notifyMerchantReplacementRejected(
        order,
        item,
        reason || undefined,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to notify merchant for replacement decision on order ${orderId}, item ${itemId}`,
        error,
      );
    }
  }

  private async notifyOrderCreated(
    order: Order,
    isFirstOrder: boolean,
  ): Promise<void> {
    try {
      await this.orderWhatsappService.notifySellerNewOrder(order);

      await this.orderWhatsappService.notifyCustomerConfirmed(order);

      if (isFirstOrder) {
        await this.orderWhatsappService.notifyWelcomeCustomer(order);
      }
    } catch (error) {
      this.logger.warn(`Failed to notify for order ${order.id}`, error);
    }
  }

  private async notifyCustomerStatusChange(order: Order): Promise<void> {
    try {
      if (order.status === OrderStatus.DRAFT) return;
      await this.orderWhatsappService.notifyCustomerStatusUpdate(order);
    } catch (error) {
      this.logger.warn(
        `Failed to notify customer for order ${order.id} status ${order.status}`,
        error,
      );
    }
  }

  private async resolveDeliveryAreaId(
    manager: Prisma.TransactionClient,
    tenantId: number,
    createOrderDto: CreateOrderDto,
  ): Promise<number | null> {
    const areaId = createOrderDto.delivery_area_id;
    const areaSlug =
      createOrderDto.delivery_area_slug?.trim() ||
      this.resolveSourceMetadataAreaSlug(createOrderDto.source_metadata);

    if (!areaId && !areaSlug) {
      const directoryProfile = await manager.tenantDirectoryProfile.findUnique({
        where: { tenant_id: tenantId },
        select: { area_id: true },
      });
      return directoryProfile?.area_id ?? null;
    }

    const areaWhere: Prisma.DirectoryAreaWhereInput = {
      is_active: true,
      ...(areaId ? { id: areaId } : { slug: areaSlug as string }),
    };

    const deliveryArea = await manager.tenantDeliveryArea.findFirst({
      where: {
        tenant_id: tenantId,
        is_active: true,
        area: areaWhere,
      },
      include: { area: true },
    });

    if (!deliveryArea) {
      throw new BadRequestException(
        'Selected delivery area is not available for this store',
      );
    }

    return deliveryArea.area_id;
  }

  private resolveSourceMetadataAreaSlug(
    sourceMetadata?: Record<string, any>,
  ): string | null {
    const areaSlug = sourceMetadata?.areaSlug;
    if (typeof areaSlug !== 'string') {
      return null;
    }

    const normalized = areaSlug.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private buildPrescriptionFileUrl(
    prescriptionUpload?: PrescriptionUpload,
  ): string | undefined {
    if (!prescriptionUpload) {
      return undefined;
    }

    const filename =
      prescriptionUpload.filename || basename(prescriptionUpload.path);
    return `/uploads/prescriptions/${filename}`;
  }

  private normalizePrescriptionOriginalFilename(
    prescriptionUpload?: PrescriptionUpload,
  ): string | undefined {
    const originalName = prescriptionUpload?.originalname?.trim();
    return originalName ? originalName.slice(0, 255) : undefined;
  }

  private normalizePrescriptionUnavailabilityAction(
    value?: string,
  ): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized.slice(0, 64) : undefined;
  }

  private async deleteUploadedFileQuietly(
    prescriptionUpload?: PrescriptionUpload,
  ): Promise<void> {
    if (!prescriptionUpload?.path) {
      return;
    }

    try {
      await rm(prescriptionUpload.path, { force: true });
    } catch {
      // Best effort cleanup only.
    }
  }

  /**
   * Runs work with request-scoped manager when available, otherwise creates a
   * tenant-configured transaction for non-request callers.
   */
  private async withTenantManager<T>(
    tenantId: number,
    callback: (manager: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const manager = DbTenantContext.getManager();
    if (manager) {
      return callback(manager);
    }

    return this.prisma.$transaction(async (transactionManager) => {
      await transactionManager.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenantId)}, true)`;
      return callback(transactionManager);
    });
  }

  private orderClient() {
    const manager = DbTenantContext.getManager();
    return manager ? manager.order : this.prisma.order;
  }

  private orderItemClient() {
    const manager = DbTenantContext.getManager();
    return manager ? manager.orderItem : this.prisma.orderItem;
  }

  private productClient() {
    const manager = DbTenantContext.getManager();
    return manager ? manager.product : this.prisma.product;
  }

  private dayClosureClient() {
    const manager = DbTenantContext.getManager();
    return manager ? manager.dayClosure : this.prisma.dayClosure;
  }
}
