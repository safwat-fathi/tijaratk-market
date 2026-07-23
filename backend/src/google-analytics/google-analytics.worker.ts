import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { Ga4OutboxStatus } from '../../generated/prisma/client';
import { decrypt } from 'src/common/utils/encryption.util';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  GA4_OUTBOX_BATCH_SIZE,
  GA4_OUTBOX_CLEANUP_INTERVAL_MS,
  GA4_OUTBOX_LOCK_TIMEOUT_MS,
  GA4_OUTBOX_MAX_ATTEMPTS,
  GA4_OUTBOX_MAX_EVENT_AGE_MS,
  GA4_OUTBOX_POLL_INTERVAL_MS,
  GA4_OUTBOX_RETENTION_MS,
  GA4_REQUEST_TIMEOUT_MS,
} from './google-analytics.constants';
import { GoogleAnalyticsService } from './google-analytics.service';
import type {
  ClaimedGa4OutboxEvent,
  Ga4DeliveryConfig,
  Ga4MeasurementPayload,
} from './google-analytics.types';

/** Represents a sanitized Measurement Protocol delivery failure. */
class Ga4DeliveryError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/** Claims and delivers GA4 lifecycle events across clustered workers. */
@Injectable()
export class GoogleAnalyticsWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(GoogleAnalyticsWorker.name);
  private readonly workerId = `${hostname()}:${process.pid}:${randomUUID()}`;
  private interval?: ReturnType<typeof setInterval>;
  private isTickRunning = false;
  private lastCleanupAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleAnalyticsService: GoogleAnalyticsService,
  ) {}

  /** Starts polling only when complete GA4 configuration exists. */
  onApplicationBootstrap(): void {
    if (!this.googleAnalyticsService.getDeliveryConfig()) return;
    void this.tick();
    this.interval = setInterval(() => {
      void this.tick();
    }, GA4_OUTBOX_POLL_INTERVAL_MS);
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
      const config = this.googleAnalyticsService.getDeliveryConfig();
      if (!config) return;
      const events = await this.claimEvents();
      await Promise.all(events.map((event) => this.processEvent(event, config)));
      await this.cleanupTerminalEventsIfDue();
    } catch (error) {
      this.logger.error(
        `GA4 outbox worker tick failed: ${this.toSafeErrorMessage(error)}`,
      );
    } finally {
      this.isTickRunning = false;
    }
  }

  /** Recovers stale locks and atomically claims a bounded event batch. */
  private async claimEvents(): Promise<ClaimedGa4OutboxEvent[]> {
    return this.prisma.$queryRaw<ClaimedGa4OutboxEvent[]>`
      WITH recovered AS (
        UPDATE "ga4_event_outbox"
        SET
          "status" = 'pending'::"ga4_event_outbox_status_enum",
          "locked_at" = NULL,
          "locked_by" = NULL,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE
          "status" = 'processing'::"ga4_event_outbox_status_enum"
          AND "locked_at" < CURRENT_TIMESTAMP - (${GA4_OUTBOX_LOCK_TIMEOUT_MS} * INTERVAL '1 millisecond')
        RETURNING "id"
      ),
      candidates AS (
        SELECT "id"
        FROM "ga4_event_outbox"
        WHERE
          "status" = 'pending'::"ga4_event_outbox_status_enum"
          AND "next_attempt_at" <= CURRENT_TIMESTAMP
        ORDER BY "next_attempt_at" ASC, "id" ASC
        LIMIT ${GA4_OUTBOX_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "ga4_event_outbox" AS outbox
      SET
        "status" = 'processing'::"ga4_event_outbox_status_enum",
        "attempt_count" = outbox."attempt_count" + 1,
        "locked_at" = CURRENT_TIMESTAMP,
        "locked_by" = ${this.workerId},
        "updated_at" = CURRENT_TIMESTAMP
      FROM candidates
      WHERE outbox."id" = candidates."id"
      RETURNING
        outbox."id",
        outbox."event_name",
        outbox."encrypted_payload",
        outbox."attempt_count",
        outbox."created_at"
    `;
  }

  /** Delivers one claimed event and records its retry or terminal state. */
  private async processEvent(
    event: ClaimedGa4OutboxEvent,
    config: Ga4DeliveryConfig,
  ): Promise<void> {
    if (
      Date.now() - event.created_at.getTime() >= GA4_OUTBOX_MAX_EVENT_AGE_MS
    ) {
      await this.markDeadLetter(
        event.id,
        new Ga4DeliveryError(
          'event_too_old',
          'GA4 event is too old for delivery',
          false,
        ),
      );
      return;
    }

    try {
      if (!event.encrypted_payload) {
        throw new Ga4DeliveryError(
          'missing_payload',
          'Encrypted GA4 payload is missing',
          false,
        );
      }
      const payload = JSON.parse(
        decrypt(event.encrypted_payload),
      ) as Ga4MeasurementPayload;
      await this.deliver(payload, config);
      await this.markSent(event.id);
    } catch (error) {
      const deliveryError = this.normalizeDeliveryError(error);
      const shouldDeadLetter =
        !deliveryError.retryable ||
        event.attempt_count >= GA4_OUTBOX_MAX_ATTEMPTS ||
        Date.now() - event.created_at.getTime() >=
          GA4_OUTBOX_MAX_EVENT_AGE_MS;

      if (shouldDeadLetter) {
        await this.markDeadLetter(event.id, deliveryError);
        this.logger.error(
          `GA4 event ${event.event_name} moved to dead letter: ${deliveryError.code}`,
        );
        return;
      }
      await this.markForRetry(event.id, event.attempt_count, deliveryError);
      this.logger.warn(
        `GA4 event ${event.event_name} scheduled for retry: ${deliveryError.code}`,
      );
    }
  }

  /** Posts one event payload to the GA4 Measurement Protocol endpoint. */
  private async deliver(
    payload: Ga4MeasurementPayload,
    config: Ga4DeliveryConfig,
  ): Promise<void> {
    const endpoint = new URL('https://www.google-analytics.com/mp/collect');
    endpoint.searchParams.set('measurement_id', config.measurementId);
    endpoint.searchParams.set('api_secret', config.apiSecret);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(GA4_REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new Ga4DeliveryError(
        'network_error',
        'GA4 request failed before receiving a response',
        true,
      );
    }

    if (!response.ok) {
      const retryable =
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500;
      throw new Ga4DeliveryError(
        `http_${response.status}`,
        `GA4 returned HTTP ${response.status}`,
        retryable,
      );
    }
  }

  /** Marks a delivered event and deletes its encrypted identifier payload. */
  private async markSent(id: number): Promise<void> {
    const now = new Date();
    await this.prisma.ga4EventOutbox.updateMany({
      where: { id, locked_by: this.workerId },
      data: {
        status: Ga4OutboxStatus.sent,
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

  /** Schedules a retry with bounded exponential backoff and jitter. */
  private async markForRetry(
    id: number,
    attemptCount: number,
    error: Ga4DeliveryError,
  ): Promise<void> {
    const baseDelay = Math.min(
      30_000 * 2 ** Math.max(0, attemptCount - 1),
      60 * 60 * 1_000,
    );
    const delay = Math.max(
      1_000,
      Math.round(baseDelay + baseDelay * (Math.random() * 0.2 - 0.1)),
    );
    await this.prisma.ga4EventOutbox.updateMany({
      where: { id, locked_by: this.workerId },
      data: {
        status: Ga4OutboxStatus.pending,
        next_attempt_at: new Date(Date.now() + delay),
        locked_at: null,
        locked_by: null,
        last_error_code: error.code.slice(0, 64),
        last_error_message: error.message.slice(0, 500),
      },
    });
  }

  /** Moves a permanently failed event to the bounded dead-letter state. */
  private async markDeadLetter(
    id: number,
    error: Ga4DeliveryError,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.ga4EventOutbox.updateMany({
      where: { id, locked_by: this.workerId },
      data: {
        status: Ga4OutboxStatus.dead_letter,
        locked_at: null,
        locked_by: null,
        last_error_code: error.code.slice(0, 64),
        last_error_message: error.message.slice(0, 500),
        terminal_at: now,
      },
    });
  }

  /** Deletes terminal operational metadata after its retention window. */
  private async cleanupTerminalEventsIfDue(): Promise<void> {
    if (
      Date.now() - this.lastCleanupAt < GA4_OUTBOX_CLEANUP_INTERVAL_MS
    ) {
      return;
    }
    this.lastCleanupAt = Date.now();
    await this.prisma.ga4EventOutbox.deleteMany({
      where: {
        status: {
          in: [Ga4OutboxStatus.sent, Ga4OutboxStatus.dead_letter],
        },
        terminal_at: {
          lt: new Date(Date.now() - GA4_OUTBOX_RETENTION_MS),
        },
      },
    });
  }

  /** Normalizes unknown payload errors without leaking response bodies. */
  private normalizeDeliveryError(error: unknown): Ga4DeliveryError {
    if (error instanceof Ga4DeliveryError) return error;
    return new Ga4DeliveryError(
      'payload_processing_error',
      'GA4 payload could not be processed',
      false,
    );
  }

  /** Produces a bounded worker-level log message. */
  private toSafeErrorMessage(error: unknown): string {
    return error instanceof Error
      ? error.message.slice(0, 500)
      : 'Unknown worker error';
  }
}
