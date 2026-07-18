import { Logger } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

describe('WhatsappService submission logging', () => {
  const originalEnv = { ...process.env };
  const createMessage = jest.fn();
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const createService = (): WhatsappService => {
    const service = new WhatsappService();
    (service as any).twilioClient = { messages: { create: createMessage } };
    return service;
  };

  beforeEach(() => {
    process.env.TWILIO_ACCOUNT_SID = 'ACtest';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.WHATSAPP_PHONE_NUMBER = '+14155238886';
    process.env.WHATSAPP_NOTIFICATIONS_ENABLED = 'true' as any;
    process.env.APP_URL = 'https://api.example.com/';
    process.env.TWILIO_CONTENT_SID_NEW_ORDER_MERCHANT = 'HXmerchant';
    delete process.env.WEBHOOK_PUBLIC_BASE_URL;

    createMessage.mockReset();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it('submits a template with a status callback and masked queued log', async () => {
    createMessage.mockResolvedValue({ sid: 'SM123', status: 'queued' });
    const service = createService();

    await service.sendTemplatedMessage({
      key: 'new_order_merchant',
      to: '01001234567',
      payload: {
        orderNumber: '42',
        customerName: 'أحمد',
        customerPhone: '+201001234567',
        deliveryAddress: 'الدقي',
        orderDetails: 'أرز: 25',
        initialTotalEgp: 25,
      },
    });

    expect(createMessage).toHaveBeenCalledWith({
      from: 'whatsapp:+14155238886',
      to: 'whatsapp:+201001234567',
      contentSid: 'HXmerchant',
      contentVariables: JSON.stringify({
        '1': '42',
        '2': 'أحمد',
        '3': '+201001234567',
        '4': 'الدقي',
        '5': 'أرز: 25',
        '6': '25',
      }),
      statusCallback: 'https://api.example.com/webhooks/whatsapp/status',
    });

    const submittedLog = logSpy.mock.calls
      .map(([message]) => String(message))
      .find((message) => message.includes('whatsapp_message_submitted'));
    expect(submittedLog).toBeDefined();
    expect(submittedLog).toContain('SM123');
    expect(submittedLog).toContain('queued');
    expect(submittedLog).toContain('new_order_merchant');
    expect(submittedLog).not.toContain('01001234567');
    expect(submittedLog).not.toContain('+201001234567');
    expect(submittedLog).toContain('4567');
  });

  it('does not submit plaintext when a template content SID is missing', async () => {
    delete process.env.TWILIO_CONTENT_SID_NEW_ORDER_MERCHANT;
    const service = createService();

    await service.sendTemplatedMessage({
      key: 'new_order_merchant',
      to: '01001234567',
      payload: {
        orderNumber: '42',
        customerName: 'أحمد',
        customerPhone: '+201001234567',
        deliveryAddress: 'الدقي',
        orderDetails: 'أرز: 25',
        initialTotalEgp: 25,
      },
    });

    expect(createMessage).not.toHaveBeenCalled();
    const errorLog = errorSpy.mock.calls.flat().map(String).join(' ');
    expect(errorLog).toContain('new_order_merchant');
    expect(errorLog).toContain('4567');
    expect(errorLog).not.toContain('01001234567');
    expect(errorLog).not.toContain('+201001234567');
  });

  it('does not retry a rejected template as plaintext', async () => {
    createMessage.mockRejectedValue(
      new Error("The 'To' number +201001234567 is invalid"),
    );
    const service = createService();

    await service.sendTemplatedMessage({
      key: 'new_order_merchant',
      to: '01001234567',
      payload: {
        orderNumber: '42',
        customerName: 'أحمد',
        customerPhone: '+201001234567',
        deliveryAddress: 'الدقي',
        orderDetails: 'أرز: 25',
        initialTotalEgp: 25,
      },
    });

    expect(createMessage).toHaveBeenCalledTimes(1);
    expect(createMessage.mock.calls[0][0]).toHaveProperty(
      'contentSid',
      'HXmerchant',
    );
    expect(createMessage.mock.calls[0][0]).not.toHaveProperty('body');

    const errorLog = errorSpy.mock.calls.flat().map(String).join(' ');
    expect(errorLog).toContain('Failed to submit WhatsApp template');
    expect(errorLog).toContain('4567');
    expect(errorLog).not.toContain('01001234567');
    expect(errorLog).not.toContain('+201001234567');
  });

  it('masks the recipient in synchronous provider errors', async () => {
    createMessage.mockRejectedValue(
      new Error("The 'To' number +201001234567 is invalid"),
    );
    const service = createService();

    await service.sendMessage('01001234567', 'رسالة اختبار');

    const errorLog = errorSpy.mock.calls.flat().map(String).join(' ');
    expect(errorLog).toContain('Failed to submit WhatsApp text message');
    expect(errorLog).toContain('4567');
    expect(errorLog).not.toContain('01001234567');
    expect(errorLog).not.toContain('+201001234567');
  });

  it('masks recipients when notifications are disabled', async () => {
    process.env.WHATSAPP_NOTIFICATIONS_ENABLED = 'false' as any;
    const service = createService();

    await service.sendMessage('01001234567', 'رسالة اختبار');

    const disabledLog = logSpy.mock.calls.flat().map(String).join(' ');
    expect(disabledLog).toContain('4567');
    expect(disabledLog).not.toContain('01001234567');
    expect(createMessage).not.toHaveBeenCalled();
  });
});
