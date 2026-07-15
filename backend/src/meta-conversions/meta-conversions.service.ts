import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request } from 'express';
import { encrypt } from 'src/common/utils/encryption.util';
import { safeNormalizePhoneNumber } from 'src/common/utils/phone.utils';
import {
  META_CONTEXT_HEADER,
  META_CONTEXT_MAX_AGE_MS,
  META_CONTEXT_SIGNATURE_HEADER,
  META_MARKETING_CONSENT_COOKIE,
} from './meta-conversions.constants';
import type {
  EnqueueMetaPurchaseInput,
  MetaDeliveryConfig,
  MetaPurchaseOrderItem,
  MetaPurchaseResponse,
  MetaServerEvent,
  MetaStorefrontType,
  MetaTrackingContext,
} from './meta-conversions.types';

type SignedBrowserContext = {
  ip?: string;
  userAgent?: string;
  timestamp: number;
};

/** Builds consented Meta events and persists them in the transactional outbox. */
@Injectable()
export class MetaConversionsService {
  private readonly logger = new Logger(MetaConversionsService.name);
  private hasLoggedConfigurationWarning = false;

  constructor(private readonly configService: ConfigService) {}

  /** Returns validated server delivery configuration or null when disabled. */
  getDeliveryConfig(): MetaDeliveryConfig | null {
    const pixelId = this.configService.get<string>('META_PIXEL_ID')?.trim();
    const accessToken = this.configService
      .get<string>('META_CAPI_ACCESS_TOKEN')
      ?.trim();
    const graphApiVersion = this.configService
      .get<string>('META_GRAPH_API_VERSION')
      ?.trim();
    const encryptionPassword = this.configService
      .get<string>('ENCRYPTION_PASSWORD')
      ?.trim();

    if (!pixelId && !accessToken && !graphApiVersion) {
      return null;
    }

    if (
      !pixelId ||
      !/^\d+$/.test(pixelId) ||
      !accessToken ||
      !graphApiVersion ||
      !/^v\d+\.\d+$/.test(graphApiVersion) ||
      !encryptionPassword
    ) {
      this.logConfigurationWarningOnce(
        'Meta CAPI is disabled because its required configuration is incomplete or invalid',
      );
      return null;
    }

    const testEventCode = this.configService
      .get<string>('META_CAPI_TEST_EVENT_CODE')
      ?.trim();

    return {
      pixelId,
      accessToken,
      graphApiVersion,
      ...(testEventCode ? { testEventCode } : {}),
    };
  }

  /** Converts an HTTP request into the limited context allowed in Meta events. */
  buildTrackingContext(
    request: Request,
    storefrontType: MetaStorefrontType,
    canonicalPath: string,
  ): MetaTrackingContext | undefined {
    const cookies = (request.cookies ?? {}) as Record<string, unknown>;
    if (cookies[META_MARKETING_CONSENT_COOKIE] !== 'granted') {
      return undefined;
    }

    if (!this.getDeliveryConfig()) {
      return undefined;
    }

    const clientUrl = this.configService.get<string>('CLIENT_URL')?.trim();
    const signingSecret = this.configService
      .get<string>('META_CONTEXT_SIGNING_SECRET')
      ?.trim();
    if (!clientUrl || !signingSecret) {
      this.logConfigurationWarningOnce(
        'Meta CAPI enqueueing is disabled because CLIENT_URL or META_CONTEXT_SIGNING_SECRET is missing',
      );
      return undefined;
    }

    let eventSourceUrl: string;
    try {
      eventSourceUrl = new URL(canonicalPath, clientUrl).toString();
    } catch {
      this.logConfigurationWarningOnce(
        'Meta CAPI enqueueing is disabled because CLIENT_URL is invalid',
      );
      return undefined;
    }

    const signedContext = this.readSignedBrowserContext(
      request,
      signingSecret,
    );
    if (!signedContext) {
      return undefined;
    }

    const clientIp = this.normalizeIp(signedContext.ip);
    const clientUserAgent = this.normalizeUserAgent(
      signedContext.userAgent,
    );
    const fbp = this.normalizeBrowserIdentifier(cookies._fbp);
    const fbc = this.normalizeBrowserIdentifier(cookies._fbc);

    return {
      consentGranted: true,
      eventSourceUrl,
      storefrontType,
      ...(clientIp ? { clientIp } : {}),
      ...(clientUserAgent ? { clientUserAgent } : {}),
      ...(fbp ? { fbp } : {}),
      ...(fbc ? { fbc } : {}),
    };
  }

  /** Enqueues one encrypted Purchase event inside the caller's order transaction. */
  async enqueuePurchase(
    input: EnqueueMetaPurchaseInput,
  ): Promise<MetaPurchaseResponse | undefined> {
    if (!input.context?.consentGranted || !this.getDeliveryConfig()) {
      return undefined;
    }

    const normalizedPhone = safeNormalizePhoneNumber(
      input.order.customer_phone || '',
      'EG',
    );
    if (!normalizedPhone) {
      this.logger.warn(
        `Meta Purchase was not enqueued for order ${input.order.id}: invalid phone`,
      );
      return undefined;
    }

    const eventId = `purchase_${randomUUID()}`;
    const value = this.normalizeCurrencyValue(input.order.total);
    const event = this.buildPurchaseEvent(
      eventId,
      value,
      normalizedPhone,
      input.order.created_at,
      input.orderItems,
      input.context,
    );
    const encryptedPayload = encrypt(JSON.stringify(event));

    await input.manager.metaConversionOutbox.create({
      data: {
        order_id: input.order.id,
        event_id: eventId,
        event_name: event.event_name,
        encrypted_payload: encryptedPayload,
      },
    });

    return {
      event_id: eventId,
      value,
      currency: 'EGP',
    };
  }

  /** Creates the exact server event stored for later CAPI delivery. */
  private buildPurchaseEvent(
    eventId: string,
    value: number,
    normalizedPhone: string,
    createdAt: Date,
    orderItems: MetaPurchaseOrderItem[],
    context: MetaTrackingContext,
  ): MetaServerEvent {
    const contents = orderItems.flatMap((item) => {
      if (item.product_id == null) return [];

      const quantity = this.resolveItemQuantity(item);
      const totalPrice = this.toFiniteNumber(item.total_price);
      const itemPrice =
        totalPrice !== undefined && quantity > 0
          ? this.roundCurrency(totalPrice / quantity)
          : undefined;

      return [
        {
          id: String(item.product_id),
          quantity,
          ...(itemPrice !== undefined ? { item_price: itemPrice } : {}),
        },
      ];
    });
    const phoneHash = createHash('sha256')
      .update(normalizedPhone.replace(/\D/g, ''))
      .digest('hex');

    return {
      event_name: 'Purchase',
      event_time: Math.floor(createdAt.getTime() / 1000),
      event_id: eventId,
      action_source: 'website',
      event_source_url: context.eventSourceUrl,
      user_data: {
        ph: [phoneHash],
        ...(context.clientIp
          ? { client_ip_address: context.clientIp }
          : {}),
        ...(context.clientUserAgent
          ? { client_user_agent: context.clientUserAgent }
          : {}),
        ...(context.fbp ? { fbp: context.fbp } : {}),
        ...(context.fbc ? { fbc: context.fbc } : {}),
      },
      custom_data: {
        currency: 'EGP',
        value,
        conversion_type: 'order_created',
        storefront_type: context.storefrontType,
        num_items: contents.reduce(
          (sum, content) => sum + content.quantity,
          0,
        ),
        ...(contents.length > 0
          ? {
              content_type: 'product' as const,
              contents,
              content_ids: contents.map((content) => content.id),
            }
          : {}),
      },
    };
  }

  /** Verifies and decodes browser metadata signed by the Next.js server. */
  private readSignedBrowserContext(
    request: Request,
    signingSecret: string,
  ): SignedBrowserContext | undefined {
    const encodedContext = request.get(META_CONTEXT_HEADER)?.trim();
    const providedSignature = request
      .get(META_CONTEXT_SIGNATURE_HEADER)
      ?.trim();
    if (!encodedContext || !providedSignature) return undefined;

    const expectedSignature = createHmac('sha256', signingSecret)
      .update(encodedContext)
      .digest('base64url');
    const expectedBuffer = Buffer.from(expectedSignature);
    const providedBuffer = Buffer.from(providedSignature);
    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(
        Buffer.from(encodedContext, 'base64url').toString('utf8'),
      ) as SignedBrowserContext;
      if (
        !Number.isFinite(parsed.timestamp) ||
        Math.abs(Date.now() - parsed.timestamp) > META_CONTEXT_MAX_AGE_MS
      ) {
        return undefined;
      }
      return parsed;
    } catch {
      return undefined;
    }
  }

  /** Converts a stored decimal-like value into a non-negative EGP amount. */
  private normalizeCurrencyValue(value: unknown): number {
    const numericValue = this.toFiniteNumber(value) ?? 0;
    return this.roundCurrency(Math.max(0, numericValue));
  }

  /** Resolves a stable commerce quantity for a persisted order item. */
  private resolveItemQuantity(item: MetaPurchaseOrderItem): number {
    const selectionQuantity = this.toFiniteNumber(item.selection_quantity);
    if (selectionQuantity !== undefined && selectionQuantity > 0) {
      return selectionQuantity;
    }
    return 1;
  }

  /** Converts Prisma decimal-like values to finite JavaScript numbers. */
  private toFiniteNumber(value: unknown): number | undefined {
    if (value === null || value === undefined) return undefined;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : undefined;
  }

  /** Rounds monetary values to two decimal places. */
  private roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  /** Accepts only valid IP addresses for Meta request matching. */
  private normalizeIp(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const candidate = value.trim().replace(/^::ffff:/, '');
    return isIP(candidate) ? candidate : undefined;
  }

  /** Bounds user-agent data before it enters the encrypted outbox. */
  private normalizeUserAgent(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().slice(0, 512);
    return normalized || undefined;
  }

  /** Validates Meta browser identifiers without attempting to hash them. */
  private normalizeBrowserIdentifier(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    return /^[A-Za-z0-9._-]{1,255}$/.test(normalized)
      ? normalized
      : undefined;
  }

  /** Logs one configuration warning without flooding clustered worker logs. */
  private logConfigurationWarningOnce(message: string): void {
    if (this.hasLoggedConfigurationWarning) return;
    this.hasLoggedConfigurationWarning = true;
    this.logger.warn(message);
  }
}
