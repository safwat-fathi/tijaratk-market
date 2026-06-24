import {
  Body,
  Controller,
  ForbiddenException,
  Header,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ApiConsumes } from '@nestjs/swagger';
import { Request } from 'express';
import twilio from 'twilio';
import { WhatsappWebhookIdempotencyService } from './whatsapp-webhook-idempotency.service';

@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly idempotencyService: WhatsappWebhookIdempotencyService,
  ) {}

  @Post()
  @Header('Content-Type', 'text/xml')
  @ApiConsumes('application/json', 'application/x-www-form-urlencoded')
  receive(@Body() body: Record<string, unknown>, @Req() req: Request) {
    this.verifyTwilioSignature(req, body);

    const eventId = this.resolveEventId(body);
    if (eventId && !this.idempotencyService.markProcessing(eventId)) {
      this.logger.debug(`Duplicate WhatsApp webhook ignored: ${eventId}`);
      return '<Response></Response>';
    }

    this.logger.log(
      JSON.stringify({
        eventId: eventId ?? 'none',
        accountSid: this.safeString(body.AccountSid),
        messageSid: this.safeString(body.MessageSid ?? body.SmsMessageSid),
        status: this.safeString(body.MessageStatus ?? body.SmsStatus),
        fromPresent: Boolean(body.From),
        toPresent: Boolean(body.To),
        numMedia: this.safeString(body.NumMedia),
      }),
    );

    return '<Response></Response>';
  }

  private verifyTwilioSignature(
    req: Request,
    body: Record<string, unknown>,
  ): void {
    const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.AUTH_TOKEN;
    if (!authToken) {
      if (process.env.NODE_ENV === 'production') {
        throw new ForbiddenException(
          'Webhook signature validation is not configured',
        );
      }

      this.logger.warn(
        'Skipping WhatsApp webhook validation: missing Twilio auth token.',
      );
      return;
    }

    const signature = req.header('X-Twilio-Signature') || '';
    const isValid = twilio.validateRequest(
      authToken,
      signature,
      this.resolveWebhookUrl(req),
      body as Record<string, string>,
    );

    if (!isValid) {
      throw new ForbiddenException('Invalid Twilio webhook signature');
    }
  }

  private resolveWebhookUrl(req: Request): string {
    const publicBaseUrl =
      process.env.WEBHOOK_PUBLIC_BASE_URL || process.env.APP_URL;
    if (publicBaseUrl) {
      return `${publicBaseUrl.replace(/\/$/, '')}${req.originalUrl}`;
    }

    const forwardedProto = req.header('x-forwarded-proto');
    const forwardedHost = req.header('x-forwarded-host');
    const protocol = forwardedProto || req.protocol;
    const host = forwardedHost || req.get('host');
    return `${protocol}://${host}${req.originalUrl}`;
  }

  private resolveEventId(body: Record<string, unknown>): string | null {
    return this.safeString(
      body.MessageSid ??
        body.SmsMessageSid ??
        body.SmsSid ??
        body.CallSid ??
        body.EventSid,
    );
  }

  private safeString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}
