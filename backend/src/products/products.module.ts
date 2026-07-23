import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ImageProcessorService } from 'src/common/services/image-processor.service';
import { StoresDirectoryModule } from 'src/stores-directory/stores-directory.module';
import { ActivityLogModule } from 'src/activity-log/activity-log.module';
import { ProductImportService } from './product-import.service';

@Module({
  imports: [StoresDirectoryModule, ActivityLogModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductImportService, ImageProcessorService],
  exports: [ProductsService, ProductImportService],
})
export class ProductsModule {}
