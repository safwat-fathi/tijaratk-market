import { ForbiddenException, Logger } from '@nestjs/common';
import twilio from 'twilio';
import { WhatsappWebhookIdempotencyService } from './whatsapp-webhook-idempotency.service';
import { WhatsAppWebhookController } from './whatsapp.controller';

describe('WhatsAppWebhookController status callbacks', () => {
  const originalEnv = { ...process.env };
  let validateRequest: jest.SpyInstance;
  let controller: WhatsAppWebhookController;
  let errorSpy: jest.SpyInstance;

  const request = {
    header: jest.fn().mockReturnValue('signature'),
    originalUrl: '/webhooks/whatsapp/status',
    protocol: 'https',
    get: jest.fn().mockReturnValue('api.example.com'),
  } as any;

  beforeEach(() => {
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.WEBHOOK_PUBLIC_BASE_URL = 'https://api.example.com';
    validateRequest = jest
      .spyOn(twilio, 'validateRequest')
      .mockReturnValue(true);
    controller = new WhatsAppWebhookController(
      new WhatsappWebhookIdempotencyService(),
    );
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it('logs error 21656 once with a masked recipient', () => {
    const body = {
      MessageSid: 'MM123',
      MessageStatus: 'failed',
      ErrorCode: '21656',
      ErrorMessage: "Invalid ContentVariables for +201001234567",
      To: 'whatsapp:+201001234567',
    };

    controller.receiveStatus(body, request);
    controller.receiveStatus(body, request);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = String(errorSpy.mock.calls[0][0]);
    expect(logged).toContain('whatsapp_message_failed');
    expect(logged).toContain('21656');
    expect(logged).toContain('MM123');
    expect(logged).toContain('4567');
    expect(logged).not.toContain('+201001234567');
    expect(validateRequest).toHaveBeenCalledWith(
      'token',
      'signature',
      'https://api.example.com/webhooks/whatsapp/status',
      body,
    );
  });

  it('treats distinct failure transitions for one Message SID separately', () => {
    controller.receiveStatus(
      {
        MessageSid: 'MM123',
        MessageStatus: 'failed',
        ErrorCode: '21656',
        To: 'whatsapp:+201001234567',
      },
      request,
    );
    controller.receiveStatus(
      {
        MessageSid: 'MM123',
        MessageStatus: 'undelivered',
        ErrorCode: '63016',
        To: 'whatsapp:+201001234567',
      },
      request,
    );

    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it('keeps non-failure lifecycle callbacks silent', () => {
    controller.receiveStatus(
      {
        MessageSid: 'MM123',
        MessageStatus: 'delivered',
        To: 'whatsapp:+201001234567',
      },
      request,
    );

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('rejects callbacks with an invalid Twilio signature', () => {
    validateRequest.mockReturnValue(false);

    expect(() =>
      controller.receiveStatus(
        {
          MessageSid: 'MM123',
          MessageStatus: 'failed',
          ErrorCode: '21656',
        },
        request,
      ),
    ).toThrow(ForbiddenException);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
