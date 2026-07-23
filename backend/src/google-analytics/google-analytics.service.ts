import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { encrypt } from 'src/common/utils/encryption.util';
import { OrderSource, type Prisma } from '../../generated/prisma/client';
import type { OrderStatus } from 'src/common/enums/order-status.enum';
import { GA4_MARKETING_CONSENT_COOKIE } from './google-analytics.constants';
import type {
  EnqueueGa4LifecycleInput,
  Ga4DeliveryConfig,
  Ga4MeasurementPayload,
  Ga4TrackingContext,
} from './google-analytics.types';

type Ga4OrderSnapshot = Prisma.OrderGetPayload<{
  include: {
    tenant: { select: { id: true; name: true; slug: true; category: true } };
    order_items: true;
  };
}>;

/** Builds consented GA4 lifecycle payloads and stores them transactionally. */
@Injectable()
export class GoogleAnalyticsService {
  private readonly logger = new Logger(GoogleAnalyticsService.name);
  private hasLoggedConfigurationWarning = false;

  constructor(private readonly configService: ConfigService) {}

  /** Returns validated Measurement Protocol configuration or null when disabled. */
  getDeliveryConfig(): Ga4DeliveryConfig | null {
    const measurementId = this.configService
      .get<string>('GA4_MEASUREMENT_ID')
      ?.trim()
      .toUpperCase();
    const apiSecret = this.configService.get<string>('GA4_API_SECRET')?.trim();
    const encryptionPassword = this.configService
      .get<string>('ENCRYPTION_PASSWORD')
      ?.trim();

    if (!measurementId && !apiSecret) return null;
    if (
      !measurementId ||
      !/^G-[A-Z0-9]+$/.test(measurementId) ||
      !apiSecret ||
      apiSecret.length > 255 ||
      !encryptionPassword
    ) {
      this.logConfigurationWarningOnce(
        'GA4 Measurement Protocol is disabled because its configuration is incomplete or invalid',
      );
      return null;
    }

    return { measurementId, apiSecret };
  }

  /** Accepts browser identifiers only for explicitly consented direct checkout. */
  buildTrackingContext(
    request: Request,
    clientId?: string,
    sessionId?: string,
  ): Ga4TrackingContext | undefined {
    const cookies = (request.cookies ?? {}) as Record<string, unknown>;
    if (
      cookies[GA4_MARKETING_CONSENT_COOKIE] !== 'granted' ||
      !this.getDeliveryConfig()
    ) {
      return undefined;
    }

    const normalizedClientId = clientId?.trim();
    if (
      !normalizedClientId ||
      !/^[A-Za-z0-9._-]{1,128}$/.test(normalizedClientId)
    ) {
      return undefined;
    }
    const normalizedSessionId = sessionId?.trim();

    return {
      clientId: normalizedClientId,
      ...(normalizedSessionId && /^\d{1,20}$/.test(normalizedSessionId)
        ? { sessionId: normalizedSessionId }
        : {}),
    };
  }

  /** Enqueues one idempotent lifecycle event without exposing customer PII. */
  async enqueueLifecycleEvent(
    input: EnqueueGa4LifecycleInput,
  ): Promise<void> {
    if (!this.getDeliveryConfig()) return;

    const order = await input.manager.order.findUnique({
      where: { id: input.orderId },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true, category: true },
        },
        order_items: true,
      },
    });
    const clientId = order?.ga_client_id;
    if (!clientId || order.order_source === OrderSource.zone_storefront) {
      return;
    }

    const payload = this.buildLifecyclePayload({
      order,
      clientId,
      eventName: input.eventName,
      previousStatus: input.previousStatus,
      occurredAt: input.occurredAt ?? new Date(),
      cancellationReasonCode: input.cancellationReasonCode,
    });
    await input.manager.ga4EventOutbox.createMany({
      data: {
        order_id: order.id,
        event_name: input.eventName,
        encrypted_payload: encrypt(JSON.stringify(payload)),
      },
      skipDuplicates: true,
    });
  }

  /** Creates a GA4 payload from the order snapshot at the status transition. */
  private buildLifecyclePayload({
    order,
    clientId,
    eventName,
    previousStatus,
    occurredAt,
    cancellationReasonCode,
  }: {
    order: Ga4OrderSnapshot;
    clientId: string;
    eventName: EnqueueGa4LifecycleInput['eventName'];
    previousStatus: OrderStatus;
    occurredAt: Date;
    cancellationReasonCode?: string;
  }): Ga4MeasurementPayload {
    const value = this.toCurrency(order.total);
    const commonParams: Record<string, unknown> = {
      order_id: String(order.id),
      store_id: String(order.tenant.id),
      store_slug: order.tenant.slug,
      store_name: order.tenant.name,
      store_category: order.tenant.category,
      storefront_type: 'tenant',
      currency: 'EGP',
      value,
      engagement_time_msec: 1,
      ...this.toSessionParameter(order.ga_session_id),
    };

    const params =
      eventName === 'purchase'
        ? {
            ...commonParams,
            transaction_id: `order_${order.id}`,
            shipping: this.toCurrency(order.delivery_fee),
            items: order.order_items
              .filter((item) => item.is_out_of_stock !== true)
              .map((item) =>
                this.toPurchaseItem(
                  item as unknown as Record<string, unknown>,
                ),
              ),
          }
        : eventName === 'order_cancelled'
          ? {
              ...commonParams,
              cancellation_stage: previousStatus,
              cancellation_reason_code:
                cancellationReasonCode?.trim().slice(0, 64) ||
                'order_cancelled',
            }
          : commonParams;

    return {
      client_id: clientId,
      timestamp_micros: occurredAt.getTime() * 1_000,
      consent: {
        ad_user_data: 'DENIED',
        ad_personalization: 'DENIED',
      },
      events: [{ name: eventName, params }],
    };
  }

  /** Maps a persisted order item to a privacy-safe GA4 ecommerce item. */
  private toPurchaseItem(item: Record<string, unknown>) {
    const quantity = this.resolveItemQuantity(item);
    const totalPrice = this.toFiniteNumber(item.total_price) ?? 0;

    return {
      item_id:
        item.product_id == null
          ? `order_item_${String(item.id)}`
          : String(item.product_id),
      item_name: String(item.name_snapshot || 'Order item').slice(0, 100),
      price: this.toCurrency(quantity > 0 ? totalPrice / quantity : totalPrice),
      quantity,
    };
  }

  /** Resolves commerce quantity while treating weight/price selections as one line. */
  private resolveItemQuantity(item: Record<string, unknown>): number {
    if (
      item.selection_mode === 'weight' ||
      item.selection_mode === 'price'
    ) {
      return 1;
    }
    const selectionQuantity = this.toFiniteNumber(item.selection_quantity);
    if (selectionQuantity !== undefined && selectionQuantity > 0) {
      return selectionQuantity;
    }
    const snapshotQuantity = this.toFiniteNumber(item.quantity);
    return snapshotQuantity !== undefined && snapshotQuantity > 0
      ? snapshotQuantity
      : 1;
  }

  /** Converts decimal-like values to finite numbers. */
  private toFiniteNumber(value: unknown): number | undefined {
    if (value === null || value === undefined) return undefined;
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  /** Produces non-negative currency rounded to two decimal places. */
  private toCurrency(value: unknown): number {
    const number = this.toFiniteNumber(value) ?? 0;
    return Math.round((Math.max(0, number) + Number.EPSILON) * 100) / 100;
  }

  /** Emits only session identifiers that are safe positive JavaScript integers. */
  private toSessionParameter(
    sessionId: string | null,
  ): { session_id?: number } {
    if (!sessionId) return {};
    const number = Number(sessionId);
    return Number.isSafeInteger(number) && number > 0
      ? { session_id: number }
      : {};
  }

  /** Logs incomplete configuration only once per process. */
  private logConfigurationWarningOnce(message: string): void {
    if (this.hasLoggedConfigurationWarning) return;
    this.hasLoggedConfigurationWarning = true;
    this.logger.warn(message);
  }
}
