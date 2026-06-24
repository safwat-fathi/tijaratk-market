import { Module } from '@nestjs/common';
import { WhatsAppWebhookController } from './whatsapp.controller';
import { WhatsappWebhookIdempotencyService } from './whatsapp-webhook-idempotency.service';

@Module({
  controllers: [WhatsAppWebhookController],
  providers: [WhatsappWebhookIdempotencyService],
})
export class WebhooksModule {}
