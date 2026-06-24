import { Injectable, Logger } from '@nestjs/common';
import twilio from 'twilio';
import { formatPhoneNumber } from 'src/common/utils/phone.util';
import { ZodError } from 'zod';
import {
  buildContentVariables,
  getTemplateSid,
  renderFallbackText,
  validateTemplatePayload,
} from './templates/templates.registry.utils';
import {
  type TemplateKey,
  type TemplatePayload,
} from './templates/templates.registry';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private twilioClient: twilio.Twilio | null = null;

  /**
   * Allows development environments to disable all WhatsApp side effects.
   */
  private isNotificationsEnabled(): boolean {
    return String(process.env.WHATSAPP_NOTIFICATIONS_ENABLED) !== 'false';
  }

  /**
   * Logs the notification that would have been sent when transport is disabled.
   */
  private logDisabledNotification(message: string): void {
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn(message);
      return;
    }

    this.logger.log(message);
  }

  private getClient(): twilio.Twilio | null {
    try {
      if (this.twilioClient) {
        return this.twilioClient;
      }

      const start = Date.now();
      const accountSid =
        process.env.TWILIO_ACCOUNT_SID || process.env.ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.AUTH_TOKEN;

      if (!accountSid || !authToken) {
        this.logger.warn('Twilio env vars are missing; skipping message send.');
        return null;
      }

      this.twilioClient = twilio(accountSid, authToken);

      this.logger.debug(`Twilio client initialized in ${Date.now() - start}ms`);
      return this.twilioClient;
    } catch (e) {
      this.logger.error('Failed to initialize Twilio client', e);
      return null;
    }
  }

  async sendMessage(to: string, body: string): Promise<void> {
    if (!this.isNotificationsEnabled()) {
      this.logDisabledNotification(
        `WhatsApp notifications disabled; would send text message to ${to}.`,
      );
      return;
    }

    const context = this.resolveMessageContext(to);
    if (!context) {
      return;
    }

    try {
      const { client, from, to: recipient } = context;
      this.logger.log(
        `Sending WhatsApp message to ${this.maskPhone(recipient)} (original: ${this.maskPhone(to)}), bodyLength=${body.length}`,
      );

      await client.messages.create({
        body,
        from,
        to: recipient,
      });
      this.logger.log(`Message sent to ${this.maskPhone(recipient)}`);
    } catch (error) {
      const details =
        error instanceof Error ? error.stack || error.message : String(error);
      this.logger.error(`Failed to send WhatsApp message to ${to}`, details);
    }
  }

  /**
   * Sends a Twilio Content Template message using content SID and variables JSON.
   */
  async sendContentMessage(
    to: string,
    contentSid: string,
    contentVariables: string,
  ): Promise<void> {
    if (!this.isNotificationsEnabled()) {
      this.logDisabledNotification(
        `WhatsApp notifications disabled; would send content template ${contentSid} to ${to}.`,
      );
      return;
    }

    const context = this.resolveMessageContext(to);
    if (!context) {
      throw new Error('WhatsApp transport is not configured');
    }

    const { client, from, to: recipient } = context;

    await client.messages.create({
      from,
      to: recipient,
      contentSid,
      contentVariables,
    });
  }

  /**
   * Sends a typed WhatsApp template and falls back to plaintext on content failures.
   */
  async sendTemplatedMessage<K extends TemplateKey>({
    key,
    to,
    payload,
  }: {
    key: K;
    to: string;
    payload: TemplatePayload<K>;
  }): Promise<void> {
    if (!this.isNotificationsEnabled()) {
      this.logDisabledNotification(
        `WhatsApp notifications disabled; would send template ${key} to ${to}.`,
      );
      return;
    }

    let validatedPayload: TemplatePayload<K>;

    try {
      validatedPayload = validateTemplatePayload(key, payload);
    } catch (error) {
      if (error instanceof ZodError) {
        this.logger.warn(
          `Skipping WhatsApp template send for ${key}: payload validation failed.`,
        );
        return;
      }

      throw error;
    }

    const fallbackMessage = renderFallbackText(key, validatedPayload);
    const contentSid = getTemplateSid(key);

    if (!contentSid) {
      this.logger.warn(
        `Missing content SID for template ${key}; sending fallback text message.`,
      );
      await this.sendMessage(to, fallbackMessage);
      return;
    }

    try {
      const contentVariables = buildContentVariables(key, validatedPayload);
      await this.sendContentMessage(to, contentSid, contentVariables);
      this.logger.log(`Template message sent using content SID for ${key}.`);
    } catch (error) {
      const details =
        error instanceof Error ? error.stack || error.message : String(error);
      this.logger.error(
        `Failed to send content template ${key}; sending fallback text.`,
        details,
      );
      await this.sendMessage(to, fallbackMessage);
    }
  }

  /**
   * Resolves the normalized Twilio message context for WhatsApp transport.
   */
  private resolveMessageContext(
    to: string,
  ): { client: twilio.Twilio; from: string; to: string } | null {
    const client = this.getClient();
    const from = process.env.WHATSAPP_PHONE_NUMBER;

    if (!client || !from) {
      if (!from) {
        this.logger.warn('WHATSAPP_PHONE_NUMBER is missing');
      }

      return null;
    }

    const formattedTo = formatPhoneNumber(to);
    const toWithPrefix = formattedTo.startsWith('whatsapp:')
      ? formattedTo
      : `whatsapp:${formattedTo}`;
    const fromWithPrefix = from.startsWith('whatsapp:')
      ? from
      : `whatsapp:${from}`;

    return {
      client,
      from: fromWithPrefix,
      to: toWithPrefix,
    };
  }

  private maskPhone(value: string): string {
    const visibleSuffix = value.slice(-4);
    return `${'*'.repeat(Math.max(0, value.length - 4))}${visibleSuffix}`;
  }
}
