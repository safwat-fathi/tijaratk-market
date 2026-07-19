import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import {
  AdminRole,
  Prisma,
  PushNotificationEventType,
  TenantStatus,
} from '../../generated/prisma/client';
import {
  ADMIN_MANAGED_PERMISSIONS,
  normalizeAdminManagedPermissions,
  type AdminManagedPermission,
} from 'src/admin-managed/constants/admin-managed-permissions';
import { decrypt, encrypt } from 'src/common/utils/encryption.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpsertPushSubscriptionDto } from './dto/push-subscription.dto';
import type {
  BrowserPushSubscription,
  ClaimedPushEvent,
  PushDeliveryConfig,
  PushDeliveryTarget,
  PushNotificationEnvelope,
  PushOutboxPayload,
} from './push-notifications.types';
import { PUSH_CLIENT_EVENT_TYPES } from './push-notifications.constants';

type SubscriptionActor =
  | { type: 'merchant'; userId: number; tenantId: number }
  | { type: 'admin'; adminId: number };

/** Owns encrypted subscriptions, transactional enqueueing, and recipient resolution. */
@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);
  private configurationWarningLogged = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /** Returns browser-safe feature state without exposing private configuration. */
  getBrowserConfig(): { enabled: boolean; publicKey?: string } {
    const config = this.getDeliveryConfig(false);
    return config
      ? { enabled: true, publicKey: config.publicKey }
      : { enabled: false };
  }

  /** Returns complete delivery configuration only when the feature is usable. */
  getDeliveryConfig(logInvalid = true): PushDeliveryConfig | null {
    const enabled = ['1', 'true', 'yes', 'on'].includes(
      String(
        this.configService.get<string>('PUSH_NOTIFICATIONS_ENABLED') || '',
      ).toLowerCase(),
    );
    if (!enabled) return null;

    const subject = this.configService
      .get<string>('PUSH_VAPID_SUBJECT')
      ?.trim();
    const publicKey = this.configService
      .get<string>('PUSH_VAPID_PUBLIC_KEY')
      ?.trim();
    const privateKey = this.configService
      .get<string>('PUSH_VAPID_PRIVATE_KEY')
      ?.trim();
    const encryptionPassword = this.configService
      .get<string>('ENCRYPTION_PASSWORD')
      ?.trim();
    const subjectValid = Boolean(
      subject &&
        (subject.startsWith('mailto:') || subject.startsWith('https://')),
    );

    if (!subjectValid || !publicKey || !privateKey || !encryptionPassword) {
      if (logInvalid) {
        this.logConfigurationWarningOnce(
          'Web Push is disabled because VAPID or encryption configuration is incomplete',
        );
      }
      return null;
    }

    return { subject: subject!, publicKey, privateKey };
  }

  /** Creates or reassigns one merchant browser subscription. */
  async upsertMerchantSubscription(
    userId: number,
    tenantId: number,
    dto: UpsertPushSubscriptionDto,
  ): Promise<{ subscribed: true }> {
    await this.upsertSubscription(
      { type: 'merchant', userId, tenantId },
      dto,
    );
    return { subscribed: true };
  }

  /** Creates or reassigns one administrator browser subscription. */
  async upsertAdminSubscription(
    adminId: number,
    dto: UpsertPushSubscriptionDto,
  ): Promise<{ subscribed: true }> {
    await this.upsertSubscription({ type: 'admin', adminId }, dto);
    return { subscribed: true };
  }

  /** Removes only the authenticated merchant's matching device endpoint. */
  async deleteMerchantSubscription(
    userId: number,
    endpoint: string,
  ): Promise<{ subscribed: false }> {
    await this.prisma.pushSubscription.deleteMany({
      where: {
        endpoint_hash: this.hashEndpoint(endpoint),
        merchant_user_id: userId,
      },
    });
    return { subscribed: false };
  }

  /** Removes only the authenticated administrator's matching device endpoint. */
  async deleteAdminSubscription(
    adminId: number,
    endpoint: string,
  ): Promise<{ subscribed: false }> {
    await this.prisma.pushSubscription.deleteMany({
      where: {
        endpoint_hash: this.hashEndpoint(endpoint),
        admin_user_id: adminId,
      },
    });
    return { subscribed: false };
  }

  /** Adds one direct storefront order event inside its database transaction. */
  async enqueueMerchantOrder(
    manager: Prisma.TransactionClient,
    input: { orderId: number; tenantId: number; storeName: string },
  ): Promise<void> {
    await this.enqueue(manager, {
      eventKey: `merchant-order:${input.orderId}`,
      eventType: PushNotificationEventType.merchant_order_created,
      tenantId: input.tenantId,
      orderId: input.orderId,
      payload: {
        storeName: this.normalizeDisplayName(input.storeName),
        orderNumber: String(input.orderId),
      },
    });
  }

  /** Adds one public zone order event inside the operator transaction. */
  async enqueueZoneOrder(
    manager: Prisma.TransactionClient,
    input: {
      orderId: number;
      tenantId: number;
      storeName: string;
      zoneId: number;
      dispatchId: number;
    },
  ): Promise<void> {
    await this.enqueue(manager, {
      eventKey: `zone-order:${input.orderId}`,
      eventType: PushNotificationEventType.zone_order_created,
      tenantId: input.tenantId,
      orderId: input.orderId,
      dispatchId: input.dispatchId,
      zoneId: input.zoneId,
      payload: {
        storeName: this.normalizeDisplayName(input.storeName),
        orderNumber: String(input.orderId),
      },
    });
  }

  /** Adds one merchant assignment event inside the dispatch transaction. */
  async enqueueZoneAssignment(
    manager: Prisma.TransactionClient,
    input: {
      assignmentId: number;
      dispatchId: number;
      orderId: number;
      targetTenantId: number;
      merchantName: string;
      zoneId: number;
      zoneName: string;
    },
  ): Promise<void> {
    await this.enqueue(manager, {
      eventKey: `zone-assignment:${input.assignmentId}`,
      eventType: PushNotificationEventType.zone_assignment_created,
      tenantId: input.targetTenantId,
      orderId: input.orderId,
      dispatchId: input.dispatchId,
      assignmentId: input.assignmentId,
      zoneId: input.zoneId,
      payload: {
        storeName: this.normalizeDisplayName(input.merchantName),
        zoneName: this.normalizeDisplayName(input.zoneName),
        orderNumber: String(input.orderId),
      },
    });
  }

  /** Resolves currently authorized encrypted endpoints for one claimed event. */
  async resolveDeliveryTargets(
    event: ClaimedPushEvent,
  ): Promise<PushDeliveryTarget[]> {
    if (event.event_type === PushNotificationEventType.zone_assignment_created) {
      return this.resolveMerchantTargets(event.tenant_id);
    }

    const adminPermission =
      event.event_type === PushNotificationEventType.zone_order_created
        ? ADMIN_MANAGED_PERMISSIONS.DispatchesRead
        : ADMIN_MANAGED_PERMISSIONS.OrdersRead;
    const adminTargets = await this.resolveAdminTargets(
      event.tenant_id,
      adminPermission,
    );

    if (event.event_type === PushNotificationEventType.zone_order_created) {
      return adminTargets;
    }

    const merchantTargets = await this.resolveMerchantTargets(event.tenant_id);
    return [...merchantTargets, ...adminTargets];
  }

  /** Builds the privacy-safe payload appropriate for the target actor. */
  buildEnvelope(
    event: ClaimedPushEvent,
    target: PushDeliveryTarget,
  ): PushNotificationEnvelope {
    const payload = this.parseOutboxPayload(event.payload);
    const orderNumber = payload.orderNumber;
    const isAssignment =
      event.event_type === PushNotificationEventType.zone_assignment_created;
    const isAdmin = target.actor === 'admin';
    let type: PushNotificationEnvelope['type'];
    let title: string;
    let body: string;
    let url: string;

    if (isAssignment) {
      type = PUSH_CLIENT_EVENT_TYPES.MerchantAssignmentCreated;
      title = 'طلب منطقة جديد';
      body = `تم إسناد الطلب #${orderNumber} إلى متجرك.`;
      url = `/merchant/assigned-orders/${event.dispatch_id}`;
    } else if (isAdmin) {
      type = PUSH_CLIENT_EVENT_TYPES.AdminOrderCreated;
      title = 'طلب جديد';
      body = `وصل طلب جديد #${orderNumber} إلى ${payload.storeName}.`;
      if (event.event_type === PushNotificationEventType.zone_order_created) {
        url = `/admin/zones/${event.zone_id}/dispatches/${event.dispatch_id}`;
      } else if (target.adminRole === AdminRole.platform_admin) {
        url = `/admin/orders?search=${encodeURIComponent(orderNumber)}`;
      } else {
        url = `/admin/merchants/${event.tenant_id}`;
      }
    } else {
      type = PUSH_CLIENT_EVENT_TYPES.MerchantOrderCreated;
      title = 'طلب جديد';
      body = `وصل طلب جديد #${orderNumber} إلى ${payload.storeName}.`;
      url = '/merchant/orders?tab=draft';
    }

    return {
      version: 1,
      eventId: event.event_key,
      type,
      title,
      body,
      url,
      ...(!isAdmin && target.notificationIconUrl
        ? { iconUrl: target.notificationIconUrl }
        : {}),
      tag: event.event_key,
      createdAt: event.created_at.toISOString(),
    };
  }

  /** Decrypts one stored browser subscription immediately before delivery. */
  decryptSubscription(encryptedSubscription: string): BrowserPushSubscription {
    const parsed = JSON.parse(decrypt(encryptedSubscription)) as unknown;
    if (!this.isBrowserPushSubscription(parsed)) {
      throw new Error('Invalid encrypted push subscription');
    }
    return parsed;
  }

  /** Deletes an invalid or expired subscription without exposing its endpoint. */
  async deleteSubscriptionById(subscriptionId: number): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { id: subscriptionId },
    });
  }

  /** Removes terminal outbox rows and devices not refreshed for the retention window. */
  async cleanup(terminalBefore: Date, subscriptionBefore: Date): Promise<void> {
    await Promise.all([
      this.prisma.pushNotificationOutbox.deleteMany({
        where: { terminal_at: { lt: terminalBefore } },
      }),
      this.prisma.pushSubscription.deleteMany({
        where: {
          OR: [
            { last_seen_at: { lt: subscriptionBefore } },
            { expiration_time: { lt: new Date() } },
          ],
        },
      }),
    ]);
  }

  /** Persists or reassigns one encrypted device registration. */
  private async upsertSubscription(
    actor: SubscriptionActor,
    dto: UpsertPushSubscriptionDto,
  ): Promise<void> {
    if (!this.getDeliveryConfig()) {
      throw new ServiceUnavailableException(
        'Web Push notifications are not configured',
      );
    }

    const normalized: BrowserPushSubscription = {
      endpoint: dto.endpoint.trim(),
      expirationTime: dto.expirationTime ?? null,
      keys: {
        p256dh: dto.keys.p256dh.trim(),
        auth: dto.keys.auth.trim(),
      },
    };
    const now = new Date();
    const actorData =
      actor.type === 'merchant'
        ? {
            merchant_user_id: actor.userId,
            merchant_tenant_id: actor.tenantId,
            admin_user_id: null,
          }
        : {
            merchant_user_id: null,
            merchant_tenant_id: null,
            admin_user_id: actor.adminId,
          };
    const data = {
      ...actorData,
      encrypted_subscription: encrypt(JSON.stringify(normalized)),
      expiration_time:
        normalized.expirationTime === null
          ? null
          : new Date(normalized.expirationTime),
      last_seen_at: now,
    };

    await this.prisma.pushSubscription.upsert({
      where: { endpoint_hash: this.hashEndpoint(normalized.endpoint) },
      create: {
        endpoint_hash: this.hashEndpoint(normalized.endpoint),
        ...data,
      },
      update: data,
    });
  }

  /** Creates one deduplicated outbox event without resetting an existing event. */
  private async enqueue(
    manager: Prisma.TransactionClient,
    input: {
      eventKey: string;
      eventType: PushNotificationEventType;
      tenantId: number;
      orderId?: number;
      dispatchId?: number;
      assignmentId?: number;
      zoneId?: number;
      payload: PushOutboxPayload;
    },
  ): Promise<void> {
    if (!this.getDeliveryConfig(false)) return;
    await manager.pushNotificationOutbox.upsert({
      where: { event_key: input.eventKey },
      create: {
        event_key: input.eventKey,
        event_type: input.eventType,
        tenant_id: input.tenantId,
        order_id: input.orderId,
        dispatch_id: input.dispatchId,
        assignment_id: input.assignmentId,
        zone_id: input.zoneId,
        payload: input.payload as Prisma.InputJsonValue,
      },
      update: {},
    });
  }

  /** Finds active merchant users and devices for exactly one tenant. */
  private async resolveMerchantTargets(
    tenantId: number,
  ): Promise<PushDeliveryTarget[]> {
    const now = new Date();
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        merchant_tenant_id: tenantId,
        merchant_user_id: { not: null },
        OR: [{ expiration_time: null }, { expiration_time: { gt: now } }],
      },
      include: {
        merchant_user: { select: { deleted_at: true, tenant_id: true } },
        merchant_tenant: {
          select: {
            status: true,
            directory_profile: { select: { logo_url: true } },
          },
        },
      },
    });

    return subscriptions
      .filter(
        (subscription) =>
          subscription.merchant_user?.deleted_at === null &&
          subscription.merchant_user.tenant_id === tenantId &&
          subscription.merchant_tenant?.status === TenantStatus.active,
      )
      .map((subscription) => ({
        subscriptionId: subscription.id,
        encryptedSubscription: subscription.encrypted_subscription,
        actor: 'merchant' as const,
        notificationIconUrl: this.normalizeNotificationIconUrl(
          subscription.merchant_tenant?.directory_profile?.logo_url,
        ),
      }));
  }

  /** Finds active admins and rechecks current tenant permission grants. */
  private async resolveAdminTargets(
    tenantId: number,
    requiredPermission: AdminManagedPermission,
  ): Promise<PushDeliveryTarget[]> {
    const now = new Date();
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        admin_user_id: { not: null },
        OR: [{ expiration_time: null }, { expiration_time: { gt: now } }],
      },
      include: {
        admin_user: {
          select: {
            is_active: true,
            role: true,
            tenant_accesses: {
              where: {
                tenant_id: tenantId,
                is_active: true,
                revoked_at: null,
                OR: [{ expires_at: null }, { expires_at: { gt: now } }],
              },
              select: { permissions: true },
            },
          },
        },
      },
    });

    return subscriptions.flatMap((subscription) => {
      const admin = subscription.admin_user;
      if (!admin?.is_active) return [];
      const allowed =
        admin.role === AdminRole.platform_admin ||
        admin.tenant_accesses.some((access) =>
          normalizeAdminManagedPermissions(access.permissions).includes(
            requiredPermission,
          ),
        );
      if (!allowed) return [];
      return [
        {
          subscriptionId: subscription.id,
          encryptedSubscription: subscription.encrypted_subscription,
          actor: 'admin' as const,
          adminRole: admin.role,
        },
      ];
    });
  }

  /** Parses only the minimal payload allowed in push outbox rows. */
  private parseOutboxPayload(value: Prisma.JsonValue): PushOutboxPayload {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Invalid push outbox payload');
    }
    const storeName = value.storeName;
    const orderNumber = value.orderNumber;
    if (typeof storeName !== 'string' || typeof orderNumber !== 'string') {
      throw new Error('Invalid push outbox payload');
    }
    return {
      storeName: this.normalizeDisplayName(storeName),
      orderNumber: orderNumber.slice(0, 32),
      ...(typeof value.zoneName === 'string'
        ? { zoneName: this.normalizeDisplayName(value.zoneName) }
        : {}),
    };
  }

  /** Hashes a sensitive endpoint for lookup without storing it in plaintext. */
  private hashEndpoint(endpoint: string): string {
    return createHash('sha256').update(endpoint.trim()).digest('hex');
  }

  /** Bounds names displayed on lock screens. */
  private normalizeDisplayName(value: string): string {
    return value.replace(/\s+/gu, ' ').trim().slice(0, 120) || 'المتجر';
  }

  /** Allows only bounded HTTPS or same-origin paths for notification artwork. */
  private normalizeNotificationIconUrl(
    value: string | null | undefined,
  ): string | undefined {
    const normalized = value?.trim();
    if (!normalized || normalized.length > 2_048) return undefined;
    if (normalized.startsWith('/') && !normalized.startsWith('//')) {
      return normalized;
    }

    try {
      const parsed = new URL(normalized);
      if (
        parsed.protocol !== 'https:' ||
        parsed.username ||
        parsed.password
      ) {
        return undefined;
      }
      return parsed.href;
    } catch {
      return undefined;
    }
  }

  /** Runtime-validates decrypted subscription material. */
  private isBrowserPushSubscription(
    value: unknown,
  ): value is BrowserPushSubscription {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const candidate = value as Partial<BrowserPushSubscription>;
    return Boolean(
      typeof candidate.endpoint === 'string' &&
        candidate.endpoint.startsWith('https://') &&
        candidate.keys &&
        typeof candidate.keys.p256dh === 'string' &&
        typeof candidate.keys.auth === 'string',
    );
  }

  /** Emits one sanitized warning for invalid server configuration. */
  private logConfigurationWarningOnce(message: string): void {
    if (this.configurationWarningLogged) return;
    this.configurationWarningLogged = true;
    this.logger.warn(message);
  }
}
