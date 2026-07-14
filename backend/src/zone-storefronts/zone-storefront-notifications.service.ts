import { Injectable, Logger } from '@nestjs/common';
import { WhatsappService } from 'src/whatsapp/whatsapp.service';

type ZoneOrderNotification = {
  dispatchId: number;
  orderNumber: string;
  zoneName: string;
  area: string;
  operationsPhone: string;
  customerName: string;
  customerPhone: string;
  total: number;
};

/** Sends best-effort typed WhatsApp notifications for zone dispatch events. */
@Injectable()
export class ZoneStorefrontNotificationsService {
  private readonly logger = new Logger(ZoneStorefrontNotificationsService.name);

  constructor(private readonly whatsappService: WhatsappService) {}

  /** Notifies operations and acknowledges a newly committed zone order. */
  async notifyNewOrder(payload: ZoneOrderNotification): Promise<void> {
    await Promise.allSettled([
      this.safeSend('new zone order operations', () =>
        this.whatsappService.sendTemplatedMessage({
          key: 'zone_order_operations',
          to: payload.operationsPhone,
          payload: {
            orderNumber: payload.orderNumber,
            zoneName: payload.zoneName,
            area: payload.area,
            totalEgp: payload.total,
          },
        }),
      ),
      this.safeSend('new zone order customer', () =>
        this.whatsappService.sendTemplatedMessage({
          key: 'order_received_customer',
          to: payload.customerPhone,
          payload: {
            customerName: payload.customerName,
            orderNumber: `#${payload.orderNumber}`,
            totalEgp: payload.total,
          },
        }),
      ),
    ]);
  }

  /** Notifies the selected merchant after a committed assignment attempt. */
  async notifyAssignment(payload: {
    dispatchId: number;
    orderNumber: string;
    merchantName: string;
    merchantPhone: string;
    zoneName: string;
    area: string;
  }): Promise<void> {
    const clientUrl = String(process.env.CLIENT_URL || '').replace(/\/$/, '');
    if (!clientUrl) {
      this.logger.warn('CLIENT_URL is missing; skipping dispatch assignment link');
      return;
    }
    await this.safeSend('zone order assignment', () =>
      this.whatsappService.sendTemplatedMessage({
        key: 'zone_order_assigned',
        to: payload.merchantPhone,
        payload: {
          merchantName: payload.merchantName,
          orderNumber: payload.orderNumber,
          zoneName: payload.zoneName,
          area: payload.area,
          assignmentUrl: `${clientUrl}/merchant/assigned-orders/${payload.dispatchId}`,
        },
      }),
    );
  }

  /** Alerts zone operations when a merchant rejects an assignment. */
  async notifyRejection(payload: {
    operationsPhone: string;
    orderNumber: string;
    merchantName: string;
    reason: string;
  }): Promise<void> {
    await this.safeSend('zone dispatch rejection', () =>
      this.whatsappService.sendTemplatedMessage({
        key: 'zone_dispatch_rejected_operations',
        to: payload.operationsPhone,
        payload: {
          orderNumber: payload.orderNumber,
          merchantName: payload.merchantName,
          reason: payload.reason,
        },
      }),
    );
  }

  /** Alerts operations after one current assignment is replaced by another. */
  async notifyReassignment(payload: {
    operationsPhone: string;
    orderNumber: string;
    previousMerchantName: string;
    newMerchantName: string;
  }): Promise<void> {
    await this.safeSend('zone dispatch reassignment', () =>
      this.whatsappService.sendTemplatedMessage({
        key: 'zone_dispatch_reassigned_operations',
        to: payload.operationsPhone,
        payload: {
          orderNumber: payload.orderNumber,
          previousMerchantName: payload.previousMerchantName,
          newMerchantName: payload.newMerchantName,
        },
      }),
    );
  }

  /** Notifies the customer after merchant acceptance locks the final quote. */
  async notifyAcceptance(payload: {
    customerPhone: string;
    customerName: string;
    orderNumber: string;
    publicToken: string;
    merchantName: string;
    oldTotal: number;
    newTotal: number;
  }): Promise<void> {
    const clientUrl = String(process.env.CLIENT_URL || '').replace(/\/$/, '');
    if (!clientUrl) {
      this.logger.warn('CLIENT_URL is missing; skipping zone acceptance notification');
      return;
    }
    await this.safeSend('zone order acceptance', () =>
      this.whatsappService.sendTemplatedMessage({
        key: 'zone_order_accepted_customer',
        to: payload.customerPhone,
        payload: {
          customerName: payload.customerName,
          orderNumber: payload.orderNumber,
          merchantName: payload.merchantName,
          oldTotal: payload.oldTotal,
          newTotal: payload.newTotal,
          trackingUrl: `${clientUrl}/track-order/${payload.publicToken}`,
        },
      }),
    );
  }

  /** Sends a best-effort customer status message after committed fulfillment changes. */
  async notifyCustomerStatus(payload: {
    customerPhone: string;
    customerName: string;
    orderNumber: string;
    statusLabel: string;
  }): Promise<void> {
    await this.safeSend('zone order status', () =>
      this.whatsappService.sendTemplatedMessage({
        key: 'order_status_update_customer',
        to: payload.customerPhone,
        payload: {
          customerName: payload.customerName,
          orderNumber: `#${payload.orderNumber}`,
          statusLabel: payload.statusLabel,
        },
      }),
    );
  }

  /** Logs delivery failures without allowing them to affect committed state. */
  private async safeSend(
    label: string,
    send: () => Promise<void>,
  ): Promise<void> {
    try {
      await send();
    } catch (error) {
      this.logger.warn(`Failed to send ${label} notification`, error);
    }
  }
}
