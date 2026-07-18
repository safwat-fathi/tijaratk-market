import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import webpush from 'web-push';
import { PushNotificationOutboxStatus } from '../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  PUSH_CLEANUP_INTERVAL_MS,
  PUSH_MESSAGE_TTL_SECONDS,
  PUSH_OUTBOX_BATCH_SIZE,
  PUSH_OUTBOX_LOCK_TIMEOUT_MS,
  PUSH_OUTBOX_MAX_ATTEMPTS,
  PUSH_OUTBOX_MAX_EVENT_AGE_MS,
  PUSH_OUTBOX_POLL_INTERVAL_MS,
  PUSH_OUTBOX_RETENTION_MS,
  PUSH_SUBSCRIPTION_STALE_MS,
} from './push-notifications.constants';
import { PushNotificationsService } from './push-notifications.service';
import type {
  ClaimedPushEvent,
  PushDeliveryConfig,
  PushDeliveryTarget,
} from './push-notifications.types';

/** Sanitized delivery failure carrying retry policy but no endpoint material. */
class PushDeliveryError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
  }
}

/** Claims and delivers Web Push outbox events safely across multiple processes. */
@Injectable()
export class PushNotificationsWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(PushNotificationsWorker.name);
  private readonly workerId = `${hostname()}:${process.pid}:${randomUUID()}`.slice(
    0,
    160,
  );
  private interval?: ReturnType<typeof setInterval>;
  private isTickRunning = false;
  private lastCleanupAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  /** Starts delivery polling only when complete server configuration exists. */
  onApplicationBootstrap(): void {
    if (!this.pushNotificationsService.getDeliveryConfig()) return;
    void this.tick();
    this.interval = setInterval(() => {
      void this.tick();
    }, PUSH_OUTBOX_POLL_INTERVAL_MS);
    this.interval.unref();
  }

  /** Stops the process-local timer during graceful application shutdown. */
  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval);
  }

  /** Runs one bounded non-overlapping delivery cycle. */
  private async tick(): Promise<void> {
    if (this.isTickRunning) return;
    this.isTickRunning = true;
    try {
      const config = this.pushNotificationsService.getDeliveryConfig();
      if (!config) return;
      const events = await this.claimEvents();
      await Promise.all(events.map((event) => this.processEvent(event, config)));
      await this.cleanupIfDue();
    } catch (error) {
      this.logger.error(
        `Push outbox worker tick failed: ${this.safeErrorCode(error)}`,
      );
    } finally {
      this.isTickRunning = false;
    }
  }

  /** Recovers stale locks and claims due rows with PostgreSQL skip-locked semantics. */
  private async claimEvents(): Promise<ClaimedPushEvent[]> {
    return this.prisma.$queryRaw<ClaimedPushEvent[]>`
      WITH recovered AS (
        UPDATE "push_notification_outbox"
        SET
          "status" = 'pending'::"push_notification_outbox_status_enum",
          "locked_at" = NULL,
          "locked_by" = NULL,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE
          "status" = 'processing'::"push_notification_outbox_status_enum"
          AND "locked_at" < CURRENT_TIMESTAMP - (${PUSH_OUTBOX_LOCK_TIMEOUT_MS} * INTERVAL '1 millisecond')
        RETURNING "id"
      ),
      candidates AS (
        SELECT "id"
        FROM "push_notification_outbox"
        WHERE
          "status" = 'pending'::"push_notification_outbox_status_enum"
          AND "next_attempt_at" <= CURRENT_TIMESTAMP
        ORDER BY "next_attempt_at" ASC, "id" ASC
        LIMIT ${PUSH_OUTBOX_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "push_notification_outbox" AS outbox
      SET
        "status" = 'processing'::"push_notification_outbox_status_enum",
        "attempt_count" = outbox."attempt_count" + 1,
        "locked_at" = CURRENT_TIMESTAMP,
        "locked_by" = ${this.workerId},
        "updated_at" = CURRENT_TIMESTAMP
      FROM candidates
      WHERE outbox."id" = candidates."id"
      RETURNING
        outbox."id",
        outbox."event_key",
        outbox."event_type",
        outbox."tenant_id",
        outbox."order_id",
        outbox."dispatch_id",
        outbox."assignment_id",
        outbox."zone_id",
        outbox."payload",
        outbox."attempt_count",
        outbox."created_at"
    `;
  }

  /** Delivers one event and transitions it to sent, retry, or dead-letter. */
  private async processEvent(
    event: ClaimedPushEvent,
    config: PushDeliveryConfig,
  ): Promise<void> {
    try {
      const targets =
        await this.pushNotificationsService.resolveDeliveryTargets(event);
      const results = await Promise.allSettled(
        targets.map((target) => this.deliver(event, target, config)),
      );
      const failures = results
        .filter(
          (result): result is PromiseRejectedResult =>
            result.status === 'rejected',
        )
        .map((result) => this.normalizeError(result.reason));
      const retryableFailure = failures.find((failure) => failure.retryable);
      if (retryableFailure) throw retryableFailure;
      if (failures.length > 0) throw failures[0];
      await this.markSent(event.id);
      this.logger.log(
        `Push event ${event.id} delivered to ${targets.length} active subscriptions`,
      );
    } catch (error) {
      const normalized = this.normalizeError(error);
      const tooOld =
        Date.now() - event.created_at.getTime() > PUSH_OUTBOX_MAX_EVENT_AGE_MS;
      if (
        normalized.retryable &&
        !tooOld &&
        event.attempt_count < PUSH_OUTBOX_MAX_ATTEMPTS
      ) {
        await this.markForRetry(event, normalized);
        this.logger.warn(
          `Push event ${event.id} scheduled for retry after ${normalized.code} (attempt ${event.attempt_count})`,
        );
        return;
      }
      await this.markDeadLetter(event.id, normalized);
      this.logger.warn(
        `Push event ${event.id} moved to dead letter after ${normalized.code}`,
      );
    }
  }

  /** Sends one encrypted subscription payload and prunes invalid endpoints. */
  private async deliver(
    event: ClaimedPushEvent,
    target: PushDeliveryTarget,
    config: PushDeliveryConfig,
  ): Promise<void> {
    let subscription: webpush.PushSubscription;
    try {
      subscription = this.pushNotificationsService.decryptSubscription(
        target.encryptedSubscription,
      );
    } catch {
      await this.pushNotificationsService.deleteSubscriptionById(
        target.subscriptionId,
      );
      return;
    }

    const envelope = this.pushNotificationsService.buildEnvelope(event, target);
    try {
      await webpush.sendNotification(subscription, JSON.stringify(envelope), {
        TTL: PUSH_MESSAGE_TTL_SECONDS,
        urgency: 'high',
        topic: createHash('sha256')
          .update(event.event_key)
          .digest('base64url')
          .slice(0, 32),
        vapidDetails: {
          subject: config.subject,
          publicKey: config.publicKey,
          privateKey: config.privateKey,
        },
      });
    } catch (error) {
      const statusCode = this.readStatusCode(error);
      if (statusCode === 404 || statusCode === 410) {
        await this.pushNotificationsService.deleteSubscriptionById(
          target.subscriptionId,
        );
        return;
      }
      const retryable =
        statusCode === undefined ||
        statusCode === 408 ||
        statusCode === 429 ||
        statusCode >= 500;
      throw new PushDeliveryError(
        statusCode ? `push_http_${statusCode}` : 'push_transport_error',
        retryable,
      );
    }
  }

  /** Marks a successfully handled event for bounded retention. */
  private async markSent(id: number): Promise<void> {
    const now = new Date();
    await this.prisma.pushNotificationOutbox.updateMany({
      where: { id, locked_by: this.workerId },
      data: {
        status: PushNotificationOutboxStatus.sent,
        locked_at: null,
        locked_by: null,
        last_error_code: null,
        sent_at: now,
        terminal_at: now,
      },
    });
  }

  /** Schedules a retry using bounded exponential backoff and jitter. */
  private async markForRetry(
    event: ClaimedPushEvent,
    error: PushDeliveryError,
  ): Promise<void> {
    const baseDelay = Math.min(
      5_000 * 2 ** Math.max(0, event.attempt_count - 1),
      15 * 60 * 1_000,
    );
    const jitter = baseDelay * (Math.random() * 0.2 - 0.1);
    await this.prisma.pushNotificationOutbox.updateMany({
      where: { id: event.id, locked_by: this.workerId },
      data: {
        status: PushNotificationOutboxStatus.pending,
        next_attempt_at: new Date(
          Date.now() + Math.max(1_000, jitter + baseDelay),
        ),
        locked_at: null,
        locked_by: null,
        last_error_code: error.code.slice(0, 64),
      },
    });
  }

  /** Records a terminal sanitized error without endpoint or customer data. */
  private async markDeadLetter(
    id: number,
    error: PushDeliveryError,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.pushNotificationOutbox.updateMany({
      where: { id, locked_by: this.workerId },
      data: {
        status: PushNotificationOutboxStatus.dead_letter,
        locked_at: null,
        locked_by: null,
        last_error_code: error.code.slice(0, 64),
        terminal_at: now,
      },
    });
  }

  /** Runs bounded retention cleanup without delaying normal request handling. */
  private async cleanupIfDue(): Promise<void> {
    if (Date.now() - this.lastCleanupAt < PUSH_CLEANUP_INTERVAL_MS) return;
    this.lastCleanupAt = Date.now();
    await this.pushNotificationsService.cleanup(
      new Date(Date.now() - PUSH_OUTBOX_RETENTION_MS),
      new Date(Date.now() - PUSH_SUBSCRIPTION_STALE_MS),
    );
  }

  /** Converts unknown failures into a safe worker-level error. */
  private normalizeError(error: unknown): PushDeliveryError {
    if (error instanceof PushDeliveryError) return error;
    return new PushDeliveryError('push_processing_error', false);
  }

  /** Extracts only an HTTP status number from a transport error. */
  private readStatusCode(error: unknown): number | undefined {
    if (!error || typeof error !== 'object' || !('statusCode' in error)) {
      return undefined;
    }
    const statusCode = Number((error as { statusCode: unknown }).statusCode);
    return Number.isInteger(statusCode) ? statusCode : undefined;
  }

  /** Produces a sanitized log code for unexpected tick failures. */
  private safeErrorCode(error: unknown): string {
    return error instanceof PushDeliveryError
      ? error.code
      : 'push_worker_error';
  }
}
