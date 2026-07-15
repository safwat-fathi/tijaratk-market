import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { MetaConversionOutboxStatus } from '../../generated/prisma/client';
import { decrypt } from 'src/common/utils/encryption.util';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  META_CAPI_REQUEST_TIMEOUT_MS,
  META_OUTBOX_BATCH_SIZE,
  META_OUTBOX_CLEANUP_INTERVAL_MS,
  META_OUTBOX_LOCK_TIMEOUT_MS,
  META_OUTBOX_MAX_ATTEMPTS,
  META_OUTBOX_MAX_EVENT_AGE_MS,
  META_OUTBOX_POLL_INTERVAL_MS,
  META_OUTBOX_RETENTION_MS,
} from './meta-conversions.constants';
import { MetaConversionsService } from './meta-conversions.service';
import type {
  ClaimedMetaOutboxEvent,
  MetaDeliveryConfig,
  MetaServerEvent,
} from './meta-conversions.types';

/** Represents a sanitized Meta delivery failure and its retry policy. */
class MetaDeliveryError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/** Claims and delivers encrypted Meta outbox events across clustered workers. */
@Injectable()
export class MetaConversionsWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(MetaConversionsWorker.name);
  private readonly workerId = `${hostname()}:${process.pid}:${randomUUID()}`;
  private interval?: ReturnType<typeof setInterval>;
  private isTickRunning = false;
  private lastCleanupAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly metaConversionsService: MetaConversionsService,
  ) {}

  /** Starts polling only when complete CAPI delivery configuration is present. */
  onApplicationBootstrap(): void {
    if (!this.metaConversionsService.getDeliveryConfig()) return;

    void this.tick();
    this.interval = setInterval(() => {
      void this.tick();
    }, META_OUTBOX_POLL_INTERVAL_MS);
    this.interval.unref();
  }

  /** Stops the process-local polling timer during graceful shutdown. */
  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval);
  }

  /** Runs one non-overlapping claim, delivery, and cleanup cycle. */
  private async tick(): Promise<void> {
    if (this.isTickRunning) return;
    this.isTickRunning = true;

    try {
      const config = this.metaConversionsService.getDeliveryConfig();
      if (!config) return;

      const events = await this.claimEvents();
      await Promise.all(
        events.map((event) => this.processEvent(event, config)),
      );
      await this.cleanupTerminalEventsIfDue();
    } catch (error) {
      this.logger.error(
        `Meta outbox worker tick failed: ${this.toSafeErrorMessage(error)}`,
      );
    } finally {
      this.isTickRunning = false;
    }
  }

  /** Atomically recovers stale locks and claims a bounded event batch. */
  private async claimEvents(): Promise<ClaimedMetaOutboxEvent[]> {
    return this.prisma.$queryRaw<ClaimedMetaOutboxEvent[]>`
      WITH recovered AS (
        UPDATE "meta_conversion_outbox"
        SET
          "status" = 'pending'::"meta_conversion_outbox_status_enum",
          "locked_at" = NULL,
          "locked_by" = NULL,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE
          "status" = 'processing'::"meta_conversion_outbox_status_enum"
          AND "locked_at" < CURRENT_TIMESTAMP - (${META_OUTBOX_LOCK_TIMEOUT_MS} * INTERVAL '1 millisecond')
        RETURNING "id"
      ),
      candidates AS (
        SELECT "id"
        FROM "meta_conversion_outbox"
        WHERE
          "status" = 'pending'::"meta_conversion_outbox_status_enum"
          AND "next_attempt_at" <= CURRENT_TIMESTAMP
        ORDER BY "next_attempt_at" ASC, "id" ASC
        LIMIT ${META_OUTBOX_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "meta_conversion_outbox" AS outbox
      SET
        "status" = 'processing'::"meta_conversion_outbox_status_enum",
        "attempt_count" = outbox."attempt_count" + 1,
        "locked_at" = CURRENT_TIMESTAMP,
        "locked_by" = ${this.workerId},
        "updated_at" = CURRENT_TIMESTAMP
      FROM candidates
      WHERE outbox."id" = candidates."id"
      RETURNING
        outbox."id",
        outbox."event_id",
        outbox."encrypted_payload",
        outbox."attempt_count",
        outbox."created_at"
    `;
  }

  /** Delivers one claimed event and records its terminal or retry state. */
  private async processEvent(
    event: ClaimedMetaOutboxEvent,
    config: MetaDeliveryConfig,
  ): Promise<void> {
    if (
      Date.now() - event.created_at.getTime() >=
      META_OUTBOX_MAX_EVENT_AGE_MS
    ) {
      const expiredError = new MetaDeliveryError(
        'event_too_old',
        'Meta event is too old for delivery',
        false,
      );
      await this.markDeadLetter(event.id, expiredError);
      this.logger.error(
        `Meta event ${event.event_id} moved to dead letter: ${expiredError.code}`,
      );
      return;
    }

    try {
      if (!event.encrypted_payload) {
        throw new MetaDeliveryError(
          'missing_payload',
          'Encrypted Meta payload is missing',
          false,
        );
      }

      const payload = JSON.parse(
        decrypt(event.encrypted_payload),
      ) as MetaServerEvent;
      await this.deliver(payload, config);
      await this.markSent(event.id);
    } catch (error) {
      const deliveryError = this.normalizeDeliveryError(error);
      const isExpired =
        Date.now() - event.created_at.getTime() >=
        META_OUTBOX_MAX_EVENT_AGE_MS;
      const shouldDeadLetter =
        !deliveryError.retryable ||
        event.attempt_count >= META_OUTBOX_MAX_ATTEMPTS ||
        isExpired;

      if (shouldDeadLetter) {
        await this.markDeadLetter(event.id, deliveryError);
        this.logger.error(
          `Meta event ${event.event_id} moved to dead letter: ${deliveryError.code}`,
        );
        return;
      }

      await this.markForRetry(event.id, event.attempt_count, deliveryError);
      this.logger.warn(
        `Meta event ${event.event_id} scheduled for retry: ${deliveryError.code}`,
      );
    }
  }

  /** Posts one server event to the configured Meta dataset. */
  private async deliver(
    event: MetaServerEvent,
    config: MetaDeliveryConfig,
  ): Promise<void> {
    const endpoint = new URL(
      `https://graph.facebook.com/${config.graphApiVersion}/${config.pixelId}/events`,
    );
    endpoint.searchParams.set('access_token', config.accessToken);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [event],
          ...(config.testEventCode
            ? { test_event_code: config.testEventCode }
            : {}),
        }),
        signal: AbortSignal.timeout(META_CAPI_REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new MetaDeliveryError(
        'network_error',
        'Meta CAPI request failed before receiving a response',
        true,
      );
    }

    const retryable =
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500;
    if (!response.ok) {
      throw new MetaDeliveryError(
        `http_${response.status}`,
        `Meta CAPI returned HTTP ${response.status}`,
        retryable,
      );
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new MetaDeliveryError(
        'invalid_response',
        'Meta CAPI returned an invalid response',
        true,
      );
    }

    const eventsReceived =
      result && typeof result === 'object' && 'events_received' in result
        ? Number((result as { events_received: unknown }).events_received)
        : 0;
    if (eventsReceived !== 1) {
      throw new MetaDeliveryError(
        'event_not_accepted',
        'Meta CAPI did not confirm one received event',
        true,
      );
    }
  }

  /** Marks a delivered event and removes its encrypted customer payload. */
  private async markSent(id: number): Promise<void> {
    const now = new Date();
    await this.prisma.metaConversionOutbox.updateMany({
      where: { id, locked_by: this.workerId },
      data: {
        status: MetaConversionOutboxStatus.sent,
        encrypted_payload: null,
        locked_at: null,
        locked_by: null,
        last_error_code: null,
        last_error_message: null,
        sent_at: now,
        terminal_at: now,
      },
    });
  }

  /** Schedules a retry with exponential backoff and bounded jitter. */
  private async markForRetry(
    id: number,
    attemptCount: number,
    error: MetaDeliveryError,
  ): Promise<void> {
    const delayMs = this.calculateRetryDelay(attemptCount);
    await this.prisma.metaConversionOutbox.updateMany({
      where: { id, locked_by: this.workerId },
      data: {
        status: MetaConversionOutboxStatus.pending,
        next_attempt_at: new Date(Date.now() + delayMs),
        locked_at: null,
        locked_by: null,
        last_error_code: error.code.slice(0, 64),
        last_error_message: error.message.slice(0, 500),
      },
    });
  }

  /** Marks a permanently failed event for bounded operational retention. */
  private async markDeadLetter(
    id: number,
    error: MetaDeliveryError,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.metaConversionOutbox.updateMany({
      where: { id, locked_by: this.workerId },
      data: {
        status: MetaConversionOutboxStatus.dead_letter,
        locked_at: null,
        locked_by: null,
        last_error_code: error.code.slice(0, 64),
        last_error_message: error.message.slice(0, 500),
        terminal_at: now,
      },
    });
  }

  /** Deletes terminal metadata after the configured retention period. */
  private async cleanupTerminalEventsIfDue(): Promise<void> {
    if (
      Date.now() - this.lastCleanupAt <
      META_OUTBOX_CLEANUP_INTERVAL_MS
    ) {
      return;
    }
    this.lastCleanupAt = Date.now();

    await this.prisma.metaConversionOutbox.deleteMany({
      where: {
        status: {
          in: [
            MetaConversionOutboxStatus.sent,
            MetaConversionOutboxStatus.dead_letter,
          ],
        },
        terminal_at: {
          lt: new Date(Date.now() - META_OUTBOX_RETENTION_MS),
        },
      },
    });
  }

  /** Calculates a 30-second exponential delay capped at one hour. */
  private calculateRetryDelay(attemptCount: number): number {
    const baseDelay = Math.min(
      30_000 * 2 ** Math.max(0, attemptCount - 1),
      60 * 60 * 1000,
    );
    const jitter = baseDelay * (Math.random() * 0.2 - 0.1);
    return Math.max(1_000, Math.round(baseDelay + jitter));
  }

  /** Maps unknown failures to a sanitized retryable worker error. */
  private normalizeDeliveryError(error: unknown): MetaDeliveryError {
    if (error instanceof MetaDeliveryError) return error;
    return new MetaDeliveryError(
      'payload_processing_error',
      'Meta payload could not be processed',
      false,
    );
  }

  /** Produces a bounded message for worker-level operational logging. */
  private toSafeErrorMessage(error: unknown): string {
    return error instanceof Error
      ? error.message.slice(0, 500)
      : 'Unknown worker error';
  }
}
