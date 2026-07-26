import { Module } from '@nestjs/common';
import { CustomersModule } from 'src/customers/customers.module';
import {
  AdminPushNotificationsController,
  PushNotificationsController,
} from './push-notifications.controller';
import { PushNotificationsService } from './push-notifications.service';
import { PushNotificationsWorker } from './push-notifications.worker';

/** Encapsulates Web Push registration, durable enqueueing, and delivery. */
@Module({
  imports: [CustomersModule],
  controllers: [
    PushNotificationsController,
    AdminPushNotificationsController,
  ],
  providers: [PushNotificationsService, PushNotificationsWorker],
  exports: [PushNotificationsService],
})
export class PushNotificationsModule {}
