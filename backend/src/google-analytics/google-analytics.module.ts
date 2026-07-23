import { Module } from '@nestjs/common';
import { GoogleAnalyticsService } from './google-analytics.service';
import { GoogleAnalyticsWorker } from './google-analytics.worker';

/** Encapsulates consented GA4 attribution, lifecycle enqueueing, and delivery. */
@Module({
  providers: [GoogleAnalyticsService, GoogleAnalyticsWorker],
  exports: [GoogleAnalyticsService],
})
export class GoogleAnalyticsModule {}
