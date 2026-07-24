import { Injectable, Logger } from '@nestjs/common';
import twilio from 'twilio';
import { maskPhoneNumber } from 'src/common/utils/phone.util';

export type TwilioVerification = {
  sid: string;
};

/**
 * Provides fail-closed Twilio Verify SMS operations for merchant authentication.
 */
@Injectable()
export class TwilioVerifyService {
  private readonly logger = new Logger(TwilioVerifyService.name);
  private client: twilio.Twilio | null = null;

  /**
   * Reports whether all credentials required by Twilio Verify are configured.
   */
  isConfigured(): boolean {
    return Boolean(
      this.accountSid() &&
        this.authToken() &&
        process.env.TWILIO_VERIFY_SERVICE_SID,
    );
  }

  /**
   * Starts an SMS verification for an E.164 phone number.
   */
  async startSmsVerification(to: string): Promise<TwilioVerification> {
    try {
      const verification = await this.verifyService().verifications.create({
        to,
        channel: 'sms',
      });

      this.logger.log(`Twilio Verify SMS started for ${maskPhoneNumber(to)}`);
      return { sid: verification.sid };
    } catch (error) {
      this.logProviderError('start', to, error);
      throw error;
    }
  }

  /**
   * Checks a code against the active verification for a phone number.
   */
  async checkCodeByPhone(to: string, code: string): Promise<boolean> {
    try {
      const result = await this.verifyService().verificationChecks.create({
        to,
        code,
      });
      return result.status === 'approved';
    } catch (error) {
      this.logProviderError('check', to, error);
      return false;
    }
  }

  /**
   * Checks a code against one specific Twilio verification SID.
   */
  async checkCodeByVerificationSid(
    verificationSid: string,
    code: string,
  ): Promise<boolean> {
    try {
      const result = await this.verifyService().verificationChecks.create({
        verificationSid,
        code,
      });
      return result.status === 'approved';
    } catch (error) {
      this.logProviderError('check', verificationSid, error);
      return false;
    }
  }

  /** Returns the configured Twilio Verify service client. */
  private verifyService() {
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!serviceSid) {
      throw new Error('TWILIO_VERIFY_SERVICE_SID is not configured');
    }

    return this.twilioClient().verify.v2.services(serviceSid);
  }

  /** Lazily creates the shared Twilio API client. */
  private twilioClient(): twilio.Twilio {
    if (this.client) return this.client;

    const accountSid = this.accountSid();
    const authToken = this.authToken();
    if (!accountSid || !authToken) {
      throw new Error('Twilio Verify credentials are not configured');
    }

    this.client = twilio(accountSid, authToken);
    return this.client;
  }

  /** Resolves the canonical account SID with its legacy alias fallback. */
  private accountSid(): string | undefined {
    return process.env.TWILIO_ACCOUNT_SID || process.env.ACCOUNT_SID;
  }

  /** Resolves the canonical auth token with its legacy alias fallback. */
  private authToken(): string | undefined {
    return process.env.TWILIO_AUTH_TOKEN || process.env.AUTH_TOKEN;
  }

  /** Logs a redacted provider failure without leaking phone numbers. */
  private logProviderError(
    operation: 'start' | 'check',
    identifier: string,
    error: unknown,
  ): void {
    const providerError =
      typeof error === 'object' && error !== null
        ? (error as { code?: unknown; status?: unknown })
        : {};
    this.logger.warn(
      JSON.stringify({
        event: 'twilio_verify_provider_error',
        operation,
        identifier: maskPhoneNumber(identifier),
        providerCode: providerError.code ?? 'unknown',
        providerStatus: providerError.status ?? 'unknown',
      }),
    );
  }
}
