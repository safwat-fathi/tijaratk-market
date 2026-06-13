import { Module } from '@nestjs/common';
import { StoresDirectoryController } from './stores-directory.controller';
import { StoresDirectoryService } from './stores-directory.service';

@Module({
  controllers: [StoresDirectoryController],
  providers: [StoresDirectoryService],
})
export class StoresDirectoryModule {}
