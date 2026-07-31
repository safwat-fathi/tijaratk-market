import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import {
  AdminRole,
  OrderStatus,
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
import { CustomersService } from 'src/customers/customers.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  UpsertCustomerPushSubscriptionDto,
  UpsertPushSubscriptionDto,
} from './dto/push-subscription.dto';
import type {
  BrowserPushSubscription,
  ClaimedPushEvent,
  CustomerOrderStatusPushOutboxPayload,
  MerchantRegistrationPushOutboxPayload,
  OrderPushOutboxPayload,
  PushDeliveryConfig,
  PushDeliveryTarget,
  PushNotificationEnvelope,
} from './push-notifications.types';
import { PUSH_CLIENT_EVENT_TYPES } from './push-notifications.constants';

type SubscriptionActor =
  | { type: 'merchant'; userId: number; tenantId: number }
  | { type: 'admin'; adminId: number };

type PushOutboxEnqueueMetadata = {
  eventKey: string;
  tenantId: number;
  orderId?: number;
};

type PushOutboxEnqueueInput = PushOutboxEnqueueMetadata &
  (
    | {
        eventType: typeof PushNotificationEventType.merchant_registered;
        payload: MerchantRegistrationPushOutboxPayload;
      }
    | {
        eventType: typeof PushNotificationEventType.merchant_order_created;
        payload: OrderPushOutboxPayload;
      }
    | {
        eventType: typeof PushNotificationEventType.customer_order_status_changed;
        payload: CustomerOrderStatusPushOutboxPayload;
      }
    | {
        eventType: typeof PushNotificationEventType.customer_replacement_requested;
        payload: Record<string, never>;
      }
  );

/** Owns encrypted subscriptions, transactional enqueueing, and recipient resolution. */
@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);
  private configurationWarningLogged = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly customersService: CustomersService,
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

  /**
   * Registers an anonymous installed customer app and links valid identities.
   *
   * Endpoint rotation is reconciled by the secure device credential. Existing
   * merchant and administrator subscriptions can never be converted.
   */
  async upsertCustomerSubscription(
    dto: UpsertCustomerPushSubscriptionDto,
  ): Promise<{ subscribed: true; linkedCustomers: number }> {
    if (!this.getDeliveryConfig()) {
      throw new ServiceUnavailableException(
        'Web Push notifications are not configured',
      );
    }

    const globalCustomerIds =
      await this.customersService.resolvePublicIdentityIds(dto.identities);
    const normalized = this.normalizeSubscription(dto.subscription);
    const endpointHash = this.hashEndpoint(normalized.endpoint);
    const deviceTokenHash = this.hashCustomerDeviceToken(dto.deviceToken);
    const encryptedSubscription = encrypt(JSON.stringify(normalized));
    const expirationTime =
      normalized.expirationTime === null
        ? null
        : new Date(normalized.expirationTime);

    await this.prisma.$transaction(async (manager) => {
      const [deviceSubscription, endpointSubscription] = await Promise.all([
        manager.pushSubscription.findUnique({
          where: { customer_device_token_hash: deviceTokenHash },
          select: { id: true },
        }),
        manager.pushSubscription.findUnique({
          where: { endpoint_hash: endpointHash },
          select: {
            id: true,
            merchant_user_id: true,
            admin_user_id: true,
            customer_device_token_hash: true,
          },
        }),
      ]);

      if (
        endpointSubscription?.merchant_user_id ||
        endpointSubscription?.admin_user_id
      ) {
        throw new ConflictException(
          'This browser endpoint belongs to another push scope',
        );
      }

      if (
        deviceSubscription &&
        endpointSubscription &&
        deviceSubscription.id !== endpointSubscription.id
      ) {
        await manager.pushSubscription.delete({
          where: { id: endpointSubscription.id },
        });
      }

      const subscription = deviceSubscription
        ? await manager.pushSubscription.update({
            where: { id: deviceSubscription.id },
            data: {
              endpoint_hash: endpointHash,
              encrypted_subscription: encryptedSubscription,
              expiration_time: expirationTime,
              last_seen_at: new Date(),
            },
            select: { id: true },
          })
        : endpointSubscription
          ? await manager.pushSubscription.update({
              where: { id: endpointSubscription.id },
              data: {
                customer_device_token_hash: deviceTokenHash,
                encrypted_subscription: encryptedSubscription,
                expiration_time: expirationTime,
                last_seen_at: new Date(),
              },
              select: { id: true },
            })
          : await manager.pushSubscription.create({
              data: {
                endpoint_hash: endpointHash,
                customer_device_token_hash: deviceTokenHash,
                encrypted_subscription: encryptedSubscription,
                expiration_time: expirationTime,
                last_seen_at: new Date(),
              },
              select: { id: true },
            });

      await manager.pushSubscriptionCustomer.deleteMany({
        where: {
          push_subscription_id: subscription.id,
          ...(globalCustomerIds.length > 0
            ? { global_customer_id: { notIn: globalCustomerIds } }
            : {}),
        },
      });

      if (globalCustomerIds.length > 0) {
        await manager.pushSubscriptionCustomer.createMany({
          data: globalCustomerIds.map((globalCustomerId) => ({
            push_subscription_id: subscription.id,
            global_customer_id: globalCustomerId,
          })),
          skipDuplicates: true,
        });
      }
    });

    return {
      subscribed: true,
      linkedCustomers: globalCustomerIds.length,
    };
  }

  /** Removes the customer subscription authenticated by its device credential. */
  async deleteCustomerSubscription(
    deviceToken: string,
  ): Promise<{ subscribed: false }> {
    await this.prisma.pushSubscription.deleteMany({
      where: {
        customer_device_token_hash:
          this.hashCustomerDeviceToken(deviceToken),
      },
    });
    return { subscribed: false };
  }

  /** Adds one merchant registration event inside the signup transaction. */
  async enqueueMerchantRegistration(
    manager: Prisma.TransactionClient,
    input: { tenantId: number; storeName: string },
  ): Promise<void> {
    await this.enqueue(manager, {
      eventKey: `merchant-registration:${input.tenantId}`,
      eventType: PushNotificationEventType.merchant_registered,
      tenantId: input.tenantId,
      payload: {
        storeName: this.normalizeDisplayName(input.storeName),
      },
    });
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

  /** Adds one privacy-minimized customer order status event transactionally. */
  async enqueueCustomerOrderStatus(
    manager: Prisma.TransactionClient,
    input: {
      orderId: number;
      tenantId: number;
      status: string;
    },
  ): Promise<void> {
    if (!Object.values(OrderStatus).includes(input.status as OrderStatus)) {
      throw new Error('Invalid customer order status');
    }
    await this.enqueue(manager, {
      eventKey: `customer-order-status:${input.orderId}:${input.status}`,
      eventType: PushNotificationEventType.customer_order_status_changed,
      tenantId: input.tenantId,
      orderId: input.orderId,
      payload: { status: input.status as OrderStatus },
    });
  }

  /** Adds one customer replacement-action event transactionally. */
  async enqueueCustomerReplacement(
    manager: Prisma.TransactionClient,
    input: {
      orderId: number;
      tenantId: number;
      activityLogId: number;
    },
  ): Promise<void> {
    await this.enqueue(manager, {
      eventKey: `customer-replacement:${input.activityLogId}`,
      eventType: PushNotificationEventType.customer_replacement_requested,
      tenantId: input.tenantId,
      orderId: input.orderId,
      payload: {},
    });
  }

  /** Resolves currently authorized encrypted endpoints for one claimed event. */
  async resolveDeliveryTargets(
    event: ClaimedPushEvent,
  ): Promise<PushDeliveryTarget[]> {
    if (
      event.event_type ===
        PushNotificationEventType.customer_order_status_changed ||
      event.event_type ===
        PushNotificationEventType.customer_replacement_requested
    ) {
      return this.resolveCustomerTargets(event);
    }

    if (event.event_type === PushNotificationEventType.merchant_registered) {
      return this.resolvePlatformAdminTargets();
    }

    // Zone storefronts are retired. Residual outbox rows resolve to no targets so
    // the worker drains them instead of delivering links to removed routes.
    if (
      event.event_type === PushNotificationEventType.zone_order_created ||
      event.event_type === PushNotificationEventType.zone_assignment_created
    ) {
      return [];
    }

    const adminTargets = await this.resolveAdminTargets(
      event.tenant_id,
      ADMIN_MANAGED_PERMISSIONS.OrdersRead,
    );
    const merchantTargets = await this.resolveMerchantTargets(event.tenant_id);
    return [...merchantTargets, ...adminTargets];
  }

  /** Builds the privacy-safe payload appropriate for the target actor. */
  buildEnvelope(
    event: ClaimedPushEvent,
    target: PushDeliveryTarget,
  ): PushNotificationEnvelope {
    const isCustomerStatus =
      event.event_type ===
      PushNotificationEventType.customer_order_status_changed;
    const isCustomerReplacement =
      event.event_type ===
      PushNotificationEventType.customer_replacement_requested;

    if (isCustomerStatus || isCustomerReplacement) {
      if (target.actor !== 'customer') {
        throw new Error('Invalid push delivery target');
      }

      if (isCustomerReplacement) {
        return {
          version: 1,
          eventId: event.event_key,
          type: PUSH_CLIENT_EVENT_TYPES.CustomerReplacementRequested,
          title: 'مطلوب مراجعة طلبك',
          body: `${target.storeName} اقترح بديلاً في الطلب #${target.orderNumber}. افتح الطلب للمراجعة.`,
          url: target.notificationUrl,
          ...(target.notificationIconUrl
            ? { iconUrl: target.notificationIconUrl }
            : {}),
          tag: event.event_key,
          createdAt: event.created_at.toISOString(),
        };
      }

      const status = this.parseCustomerOrderStatusPayload(event.payload).status;
      return {
        version: 1,
        eventId: event.event_key,
        type: PUSH_CLIENT_EVENT_TYPES.CustomerOrderStatusChanged,
        title: this.customerStatusTitle(status),
        body: `${target.storeName} حدّث حالة الطلب #${target.orderNumber}: ${this.customerStatusLabel(status)}.`,
        url: target.notificationUrl,
        ...(target.notificationIconUrl
          ? { iconUrl: target.notificationIconUrl }
          : {}),
        tag: `customer-order:${target.orderNumber}`,
        createdAt: event.created_at.toISOString(),
      };
    }

    const isMerchantRegistration =
      event.event_type === PushNotificationEventType.merchant_registered;

    if (isMerchantRegistration) {
      if (
        target.actor !== 'admin' ||
        target.adminRole !== AdminRole.platform_admin
      ) {
        throw new Error('Invalid push delivery target');
      }
      const payload = this.parseMerchantRegistrationPayload(event.payload);
      return {
        version: 1,
        eventId: event.event_key,
        type: PUSH_CLIENT_EVENT_TYPES.AdminMerchantRegistered,
        title: 'طلب انضمام تاجر جديد',
        body: `سجّل ${payload.storeName} طلب انضمام جديدًا وينتظر المراجعة.`,
        url: '/admin/merchants?status=pending',
        tag: event.event_key,
        createdAt: event.created_at.toISOString(),
      };
    }

    const payload = this.parseOrderPayload(event.payload);
    const orderNumber = payload.orderNumber;
    const isAdmin = target.actor === 'admin';
    let type: PushNotificationEnvelope['type'];
    let title: string;
    let body: string;
    let url: string;

    if (isAdmin) {
      type = PUSH_CLIENT_EVENT_TYPES.AdminOrderCreated;
      title = 'طلب جديد';
      body = `وصل طلب جديد #${orderNumber} إلى ${payload.storeName}.`;
      if (target.adminRole === AdminRole.platform_admin) {
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

    const normalized = this.normalizeSubscription(dto);
    const now = new Date();
    const actorData =
      actor.type === 'merchant'
        ? {
            merchant_user_id: actor.userId,
            merchant_tenant_id: actor.tenantId,
            admin_user_id: null,
            customer_device_token_hash: null,
          }
        : {
            merchant_user_id: null,
            merchant_tenant_id: null,
            admin_user_id: actor.adminId,
            customer_device_token_hash: null,
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

    await this.prisma.$transaction(async (manager) => {
      const endpointHash = this.hashEndpoint(normalized.endpoint);
      const existing = await manager.pushSubscription.findUnique({
        where: { endpoint_hash: endpointHash },
        select: { id: true },
      });
      if (existing) {
        await manager.pushSubscriptionCustomer.deleteMany({
          where: { push_subscription_id: existing.id },
        });
      }
      await manager.pushSubscription.upsert({
        where: { endpoint_hash: endpointHash },
        create: {
          endpoint_hash: endpointHash,
          ...data,
        },
        update: data,
      });
    });
  }

  /** Creates one deduplicated outbox event without resetting an existing event. */
  private async enqueue(
    manager: Prisma.TransactionClient,
    input: PushOutboxEnqueueInput,
  ): Promise<void> {
    if (!this.getDeliveryConfig(false)) return;
    await manager.pushNotificationOutbox.upsert({
      where: { event_key: input.eventKey },
      create: {
        event_key: input.eventKey,
        event_type: input.eventType,
        tenant_id: input.tenantId,
        order_id: input.orderId,
        payload: input.payload as Prisma.InputJsonValue,
      },
      update: {},
    });
  }

  /** Resolves anonymous devices linked to the order's current global customer. */
  private async resolveCustomerTargets(
    event: ClaimedPushEvent,
  ): Promise<PushDeliveryTarget[]> {
    if (!event.order_id) return [];

    const order = await this.prisma.$transaction(async (manager) => {
      await manager.$executeRaw`SELECT set_config('app.tenant_id', ${String(event.tenant_id)}, true)`;
      return manager.order.findFirst({
        where: {
          id: event.order_id!,
          tenant_id: event.tenant_id,
          deleted_at: null,
        },
        select: {
          id: true,
          public_token: true,
          customer: { select: { global_customer_id: true } },
          tenant: {
            select: {
              name: true,
              directory_profile: { select: { logo_url: true } },
            },
          },
        },
      });
    });

    const globalCustomerId = order?.customer.global_customer_id;
    if (!order || !globalCustomerId) return [];

    const now = new Date();
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        customer_device_token_hash: { not: null },
        customer_links: {
          some: { global_customer_id: globalCustomerId },
        },
        OR: [{ expiration_time: null }, { expiration_time: { gt: now } }],
      },
      select: {
        id: true,
        encrypted_subscription: true,
      },
    });

    return subscriptions.map((subscription) => ({
      subscriptionId: subscription.id,
      encryptedSubscription: subscription.encrypted_subscription,
      actor: 'customer' as const,
      notificationUrl: `/track-order/${order.public_token}`,
      storeName: this.normalizeDisplayName(order.tenant.name),
      orderNumber: String(order.id),
      notificationIconUrl: this.normalizeNotificationIconUrl(
        order.tenant.directory_profile?.logo_url,
      ),
    }));
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

  /** Finds subscribed active platform administrators for global events. */
  private async resolvePlatformAdminTargets(): Promise<PushDeliveryTarget[]> {
    const now = new Date();
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        admin_user_id: { not: null },
        admin_user: {
          is: {
            is_active: true,
            role: AdminRole.platform_admin,
          },
        },
        OR: [{ expiration_time: null }, { expiration_time: { gt: now } }],
      },
      select: {
        id: true,
        encrypted_subscription: true,
      },
    });

    return subscriptions.map((subscription) => ({
      subscriptionId: subscription.id,
      encryptedSubscription: subscription.encrypted_subscription,
      actor: 'admin' as const,
      adminRole: AdminRole.platform_admin,
    }));
  }

  /** Parses the minimal payload allowed for merchant registration events. */
  private parseMerchantRegistrationPayload(
    value: Prisma.JsonValue,
  ): MerchantRegistrationPushOutboxPayload {
    const payload = this.parseOutboxObject(value);
    if (typeof payload.storeName !== 'string') {
      throw new Error('Invalid push outbox payload');
    }
    return {
      storeName: this.normalizeDisplayName(payload.storeName),
    };
  }

  /** Parses the minimal payload required by order and assignment events. */
  private parseOrderPayload(value: Prisma.JsonValue): OrderPushOutboxPayload {
    const payload = this.parseOutboxObject(value);
    if (
      typeof payload.storeName !== 'string' ||
      typeof payload.orderNumber !== 'string'
    ) {
      throw new Error('Invalid push outbox payload');
    }
    const orderNumber = payload.orderNumber.slice(0, 32);
    if (!orderNumber) throw new Error('Invalid push outbox payload');
    return {
      storeName: this.normalizeDisplayName(payload.storeName),
      orderNumber,
    };
  }

  /** Parses the only customer status value permitted in outbox JSON. */
  private parseCustomerOrderStatusPayload(
    value: Prisma.JsonValue,
  ): CustomerOrderStatusPushOutboxPayload {
    const payload = this.parseOutboxObject(value);
    if (
      typeof payload.status !== 'string' ||
      !Object.values(OrderStatus).includes(payload.status as OrderStatus)
    ) {
      throw new Error('Invalid push outbox payload');
    }
    return { status: payload.status as OrderStatus };
  }

  /** Returns a concise Arabic label suitable for a private lock screen. */
  private customerStatusLabel(status: OrderStatus): string {
    switch (status) {
      case OrderStatus.confirmed:
        return 'تم تأكيد الطلب';
      case OrderStatus.out_for_delivery:
        return 'الطلب في الطريق';
      case OrderStatus.completed:
        return 'تم تسليم الطلب';
      case OrderStatus.cancelled:
        return 'تم إلغاء الطلب';
      default:
        return 'تم تحديث الطلب';
    }
  }

  /** Returns the customer notification title for one meaningful status. */
  private customerStatusTitle(status: OrderStatus): string {
    switch (status) {
      case OrderStatus.confirmed:
        return 'تم تأكيد طلبك';
      case OrderStatus.out_for_delivery:
        return 'طلبك في الطريق';
      case OrderStatus.completed:
        return 'تم تسليم طلبك';
      case OrderStatus.cancelled:
        return 'تم إلغاء طلبك';
      default:
        return 'تحديث على طلبك';
    }
  }

  /** Narrows an outbox JSON value before event-specific validation. */
  private parseOutboxObject(value: Prisma.JsonValue): Prisma.JsonObject {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Invalid push outbox payload');
    }
    return value;
  }

  /** Hashes a sensitive endpoint for lookup without storing it in plaintext. */
  private hashEndpoint(endpoint: string): string {
    return createHash('sha256').update(endpoint.trim()).digest('hex');
  }

  /** Hashes the opaque device credential before it crosses persistence. */
  private hashCustomerDeviceToken(deviceToken: string): string {
    return createHash('sha256').update(deviceToken.trim()).digest('hex');
  }

  /** Normalizes browser subscription material before encryption. */
  private normalizeSubscription(
    dto: UpsertPushSubscriptionDto,
  ): BrowserPushSubscription {
    return {
      endpoint: dto.endpoint.trim(),
      expirationTime: dto.expirationTime ?? null,
      keys: {
        p256dh: dto.keys.p256dh.trim(),
        auth: dto.keys.auth.trim(),
      },
    };
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
