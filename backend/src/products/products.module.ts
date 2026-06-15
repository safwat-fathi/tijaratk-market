import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ImageProcessorService } from 'src/common/services/image-processor.service';
import { StoresDirectoryModule } from 'src/stores-directory/stores-directory.module';

@Module({
  imports: [StoresDirectoryModule],
  controllers: [ProductsController],
  providers: [ProductsService, ImageProcessorService],
  exports: [ProductsService],
})
export class ProductsModule {}
