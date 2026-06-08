import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

/**
 * Module responsible for admin-managed data imports.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
