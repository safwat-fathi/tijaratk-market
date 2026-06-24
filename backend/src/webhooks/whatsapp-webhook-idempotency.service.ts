import { Injectable } from '@nestjs/common';

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const MAX_TRACKED_EVENTS = 5000;

type SeenWebhookEvent = {
  expiresAt: number;
};

/**
 * Tracks recently processed Twilio webhook event IDs for retry idempotency.
 */
@Injectable()
export class WhatsappWebhookIdempotencyService {
  private readonly seenEvents = new Map<string, SeenWebhookEvent>();

  /**
   * Returns false when the event was already seen inside the TTL window.
   */
  markProcessing(eventId: string, ttlMs = DEFAULT_TTL_MS): boolean {
    this.pruneExpired();
    const now = Date.now();
    const existing = this.seenEvents.get(eventId);

    if (existing && existing.expiresAt > now) {
      return false;
    }

    this.seenEvents.set(eventId, { expiresAt: now + ttlMs });
    this.pruneOverflow();
    return true;
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [eventId, entry] of this.seenEvents.entries()) {
      if (entry.expiresAt <= now) {
        this.seenEvents.delete(eventId);
      }
    }
  }

  private pruneOverflow(): void {
    while (this.seenEvents.size > MAX_TRACKED_EVENTS) {
      const oldestKey = this.seenEvents.keys().next().value as
        | string
        | undefined;
      if (!oldestKey) return;
      this.seenEvents.delete(oldestKey);
    }
  }
}
