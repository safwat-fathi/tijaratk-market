import { Injectable } from '@nestjs/common';
import { WhatsappService } from 'src/whatsapp/whatsapp.service';
import {
  Order,
  OrderItem,
  Customer,
  Tenant,
  Product,
  DirectoryArea,
} from '../../generated/prisma/client';
import { welcomeCustomer } from 'src/whatsapp/templates';
import { OrderStatus } from 'src/common/enums/order-status.enum';
import { PrismaService } from 'src/prisma/prisma.service';

type OrderWithRelations = Order & {
  customer?: Customer | null;
  tenant?: Tenant | null;
  delivery_area?: DirectoryArea | null;
  order_items?: OrderItem[];
  items?: OrderItem[];
};
type OrderItemWithProduct = OrderItem & {
  pending_replacement_product?: Product | null;
};

@Injectable()
export class OrderWhatsappService {
  private static readonly MAX_ORDER_DETAILS_LENGTH = 1000;

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly prisma: PrismaService,
  ) {}

  private resolveStatusLabel(status: OrderStatus): string | null {
    if (status === OrderStatus.CONFIRMED) return 'تم التأكيد';
    if (status === OrderStatus.OUT_FOR_DELIVERY) return 'خرج للتوصيل';
    if (status === OrderStatus.COMPLETED) return 'تم التوصيل';
    if (status === OrderStatus.CANCELLED) return 'تم الإلغاء';
    if (status === OrderStatus.REJECTED_BY_CUSTOMER) {
      return 'تم الرفض من العميل';
    }
    return null;
  }

  async notifySellerNewOrder(order: OrderWithRelations): Promise<void> {
    const sellerNumber = order.tenant?.phone;
    if (!sellerNumber) return;

    const customerName = order.customer_name || order.customer?.name || 'عميل';
    const customerPhone =
      order.customer_phone || order.customer?.phone || 'غير متاح';
    const deliveryAddress =
      order.delivery_address ||
      order.delivery_area?.name_ar ||
      order.delivery_area?.name_en ||
      order.customer?.address ||
      'غير محدد';
    const orderDetails = this.buildOrderDetails(order);
    const total = Number(order.total || 0);

    await this.whatsappService.sendTemplatedMessage({
      key: 'new_order_merchant',
      to: sellerNumber,
      payload: {
        customerName,
        orderNumber: String(order.id),
        customerPhone,
        deliveryAddress,
        orderDetails,
        initialTotalEgp: total,
      },
    });
  }

  private buildOrderDetails(order: OrderWithRelations): string {
    const orderItems = order.items ?? order.order_items ?? [];
    if (orderItems.length === 0) return 'تفاصيل الأصناف غير متاحة';

    const segments = orderItems.map((item) => {
      const itemName = this.normalizeOneLineText(
        item.name_snapshot || 'منتج غير محدد',
      );
      const unitPrice = this.formatUnitPrice(item.unit_price);
      return `${itemName}: ${unitPrice}`;
    });

    return this.joinOrderDetailSegments(segments);
  }

  private formatUnitPrice(unitPrice: OrderItem['unit_price']): string {
    if (unitPrice === null || unitPrice === undefined) {
      return 'السعر يحدد لاحقاً';
    }

    const numericPrice = Number(unitPrice);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return 'السعر يحدد لاحقاً';
    }

    return numericPrice
      .toFixed(2)
      .replace(/\.00$/, '')
      .replace(/(\.\d)0$/, '$1');
  }

  private joinOrderDetailSegments(segments: string[]): string {
    const suffix = ', …';
    let details = '';

    for (const segment of segments) {
      const candidate = details ? `${details}, ${segment}` : segment;
      if (
        candidate.length <= OrderWhatsappService.MAX_ORDER_DETAILS_LENGTH
      ) {
        details = candidate;
        continue;
      }

      if (details) {
        if (
          details.length + suffix.length <=
          OrderWhatsappService.MAX_ORDER_DETAILS_LENGTH
        ) {
          return `${details}${suffix}`;
        }
        return details;
      }

      const maxSegmentLength =
        OrderWhatsappService.MAX_ORDER_DETAILS_LENGTH - suffix.length;
      return `${segment.slice(0, maxSegmentLength).trimEnd()}${suffix}`;
    }

    return details || 'تفاصيل الأصناف غير متاحة';
  }

  private normalizeOneLineText(value: string): string {
    return value.replace(/\s+/gu, ' ').trim() || 'منتج غير محدد';
  }

  async notifyCustomerConfirmed(order: OrderWithRelations): Promise<void> {
    const customerNumber = order.customer_phone || order.customer?.phone;
    if (!customerNumber) return;

    const customerName = order.customer_name || order.customer?.name || 'عميل';
    const total = Number(order.total || 0);

    await this.whatsappService.sendTemplatedMessage({
      key: 'order_received_customer',
      to: customerNumber,
      payload: {
        customerName,
        orderNumber: `#${order.id}`,
        totalEgp: total,
      },
    });
  }

  async notifyCustomerStatusUpdate(order: OrderWithRelations): Promise<void> {
    const customerNumber = order.customer_phone || order.customer?.phone;
    if (!customerNumber) return;

    const orderStatus = order.status as OrderStatus;
    let statusLabel = this.resolveStatusLabel(orderStatus);
    if (!statusLabel) return;

    let reason: string | null = null;
    if (orderStatus === OrderStatus.CANCELLED) {
      reason = order.merchant_cancellation_reason;
    } else if (orderStatus === OrderStatus.REJECTED_BY_CUSTOMER) {
      reason = order.customer_rejection_reason;
    }
    if (reason?.trim()) {
      statusLabel = `${statusLabel}. السبب: ${reason.trim()}`;
    }

    const customerName = order.customer_name || order.customer?.name || 'عميل';

    await this.whatsappService.sendTemplatedMessage({
      key: 'order_status_update_customer',
      to: customerNumber,
      payload: {
        customerName,
        orderNumber: `#${order.id}`,
        statusLabel,
      },
    });
  }

  /**
   * Sends customer replacement decision request when merchant proposes alternative product.
   */
  async notifyCustomerReplacementRequested(
    order: OrderWithRelations,
    item: OrderItemWithProduct,
  ): Promise<void> {
    const customerNumber = order.customer_phone || order.customer?.phone;
    if (!customerNumber || !item.pending_replacement_product?.name) return;

    const fulfillingMerchant = await this.resolveFulfillingMerchant(order);
    const storeName = fulfillingMerchant?.name || order.tenant?.name || 'المتجر';

    await this.whatsappService.sendTemplatedMessage({
      key: 'order_product_replacement',
      to: customerNumber,
      payload: {
        orderNumber: String(order.id),
        storeName,
        originalProductName: item.name_snapshot,
        replacementProductName: item.pending_replacement_product.name,
        orderTotal: Number(order.total || 0),
      },
    });
  }

  /**
   * Sends merchant notification when customer accepts replacement.
   */
  async notifyMerchantReplacementAccepted(
    order: OrderWithRelations,
  ): Promise<void> {
    const sellerNumber = (await this.resolveFulfillingMerchant(order))?.phone;
    if (!sellerNumber) return;

    const customerName = order.customer_name || order.customer?.name || 'عميل';

    await this.whatsappService.sendTemplatedMessage({
      key: 'merchant_replacement_accepted',
      to: sellerNumber,
      payload: {
        orderNumber: String(order.id),
        customerName,
      },
    });
  }

  /**
   * Sends merchant notification when customer rejects replacement.
   */
  async notifyMerchantReplacementRejected(
    order: OrderWithRelations,
    item: OrderItemWithProduct,
    reason?: string,
  ): Promise<void> {
    const sellerNumber = (await this.resolveFulfillingMerchant(order))?.phone;
    if (!sellerNumber) return;

    const customerName = order.customer_name || order.customer?.name || 'عميل';

    await this.whatsappService.sendTemplatedMessage({
      key: 'merchant_replacement_rejected',
      to: sellerNumber,
      payload: {
        orderNumber: `#${order.id}`,
        customerName,
        originalProductName: item.name_snapshot,
        replacementProductName:
          item.pending_replacement_product?.name || 'البديل المقترح',
        reason: reason?.trim() || 'بدون سبب',
      },
    });
  }

  async notifyWelcomeCustomer(order: OrderWithRelations): Promise<void> {
    const customerNumber = order.customer_phone || order.customer?.phone;
    if (!customerNumber) return;

    const storeName = order.tenant?.name || 'المحل';

    const message = welcomeCustomer({
      storeName,
    });

    await this.whatsappService.sendMessage(customerNumber, message);
  }

  /** Resolves the accepted dispatch merchant before falling back to the order owner. */
  private async resolveFulfillingMerchant(
    order: OrderWithRelations,
  ): Promise<{ name: string; phone: string } | undefined> {
    const acceptedAssignment = await this.prisma.orderDispatchAssignment.findFirst({
      where: {
        status: 'accepted',
        is_current: true,
        order_dispatch: { order_id: order.id, status: 'accepted' },
      },
      select: { target_tenant: { select: { name: true, phone: true } } },
      orderBy: { id: 'desc' },
    });

    if (acceptedAssignment) return acceptedAssignment.target_tenant;
    if (!order.tenant?.phone) return undefined;
    return { name: order.tenant.name, phone: order.tenant.phone };
  }

  /**
   * Sends merchant a close-day WhatsApp summary.
   */
  async notifyMerchantDailySummary({
    phone,
    date,
    totalOrders,
    completedOrders,
    cancelledOrders,
    totalSalesEgp,
    totalCollectedEgp,
  }: {
    phone: string;
    date: string;
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    totalSalesEgp: number;
    totalCollectedEgp: number;
  }): Promise<boolean> {
    if (!phone) {
      return false;
    }

    await this.whatsappService.sendTemplatedMessage({
      key: 'merchant_day_closure_summary',
      to: phone,
      payload: {
        date,
        totalOrders,
        completedOrders,
        cancelledOrders,
        totalSalesEgp,
        totalCollectedEgp,
      },
    });

    return true;
  }
}
