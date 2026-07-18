import { Injectable, Logger } from '@nestjs/common';
import twilio from 'twilio';
import {
  formatPhoneNumber,
  maskPhoneNumber,
  maskPhoneNumbersInText,
} from 'src/common/utils/phone.util';
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
  private didWarnAboutMissingStatusCallback = false;

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
        `WhatsApp notifications disabled; would send text message to ${maskPhoneNumber(to)}.`,
      );
      return;
    }

    const context = this.resolveMessageContext(to);
    if (!context) {
      return;
    }

    try {
      const { client, from, to: recipient } = context;
      const statusCallback = this.resolveStatusCallbackUrl();
      const message = await client.messages.create({
        body,
        from,
        to: recipient,
        ...(statusCallback ? { statusCallback } : {}),
      });
      this.logSubmittedMessage({
        recipient,
        messageSid: message.sid,
        status: message.status,
        kind: 'text',
      });
    } catch (error) {
      this.logger.error(
        `Failed to submit WhatsApp text message to ${maskPhoneNumber(to)}`,
        this.describeError(error),
      );
    }
  }

  /**
   * Sends a Twilio Content Template message using content SID and variables JSON.
   */
  async sendContentMessage(
    to: string,
    contentSid: string,
    contentVariables: string,
    templateKey: TemplateKey,
  ): Promise<void> {
    if (!this.isNotificationsEnabled()) {
      this.logDisabledNotification(
        `WhatsApp notifications disabled; would send content template ${templateKey} to ${maskPhoneNumber(to)}.`,
      );
      return;
    }

    const context = this.resolveMessageContext(to);
    if (!context) {
      throw new Error('WhatsApp transport is not configured');
    }

    const { client, from, to: recipient } = context;
    const statusCallback = this.resolveStatusCallbackUrl();

    const message = await client.messages.create({
      from,
      to: recipient,
      contentSid,
      contentVariables,
      ...(statusCallback ? { statusCallback } : {}),
    });
    this.logSubmittedMessage({
      recipient,
      messageSid: message.sid,
      status: message.status,
      kind: 'template',
      templateKey,
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
        `WhatsApp notifications disabled; would send template ${key} to ${maskPhoneNumber(to)}.`,
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
      await this.sendContentMessage(to, contentSid, contentVariables, key);
    } catch (error) {
      this.logger.error(
        `Failed to submit WhatsApp template ${key} to ${maskPhoneNumber(to)}; sending fallback text.`,
        this.describeError(error),
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

  private resolveStatusCallbackUrl(): string | undefined {
    const publicBaseUrl =
      process.env.WEBHOOK_PUBLIC_BASE_URL || process.env.APP_URL;
    if (!publicBaseUrl) {
      if (!this.didWarnAboutMissingStatusCallback) {
        this.logger.warn(
          'WhatsApp status callback is not configured; asynchronous failures will not be logged.',
        );
        this.didWarnAboutMissingStatusCallback = true;
      }
      return undefined;
    }

    return `${publicBaseUrl.replace(/\/$/, '')}/webhooks/whatsapp/status`;
  }

  private logSubmittedMessage({
    recipient,
    messageSid,
    status,
    kind,
    templateKey,
  }: {
    recipient: string;
    messageSid: string;
    status: string;
    kind: 'text' | 'template';
    templateKey?: TemplateKey;
  }): void {
    this.logger.log(
      JSON.stringify({
        event: 'whatsapp_message_submitted',
        recipient: maskPhoneNumber(recipient),
        messageSid,
        status,
        kind,
        ...(templateKey ? { templateKey } : {}),
      }),
    );
  }

  private describeError(error: unknown): string {
    const details = error instanceof Error ? error.message : String(error);
    return maskPhoneNumbersInText(details);
  }
}
