import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ImageProcessorService } from 'src/common/services/image-processor.service';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { ImageDownloaderService } from './services/image-downloader.service';

/**
 * Module responsible for admin-managed data imports.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ImportsController],
  providers: [ImportsService, ImageDownloaderService, ImageProcessorService],
})
export class ImportsModule {}
