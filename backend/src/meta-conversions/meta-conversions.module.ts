import { Module } from '@nestjs/common';
import { MetaConversionsService } from './meta-conversions.service';
import { MetaConversionsWorker } from './meta-conversions.worker';

/** Encapsulates Meta request matching, transactional enqueueing, and delivery. */
@Module({
  providers: [MetaConversionsService, MetaConversionsWorker],
  exports: [MetaConversionsService],
})
export class MetaConversionsModule {}

