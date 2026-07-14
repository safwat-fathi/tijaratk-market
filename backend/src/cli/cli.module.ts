import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  AdminProvisioningService,
} from './admin-provisioning/admin-provisioning.service';
import { CreateAdminCommand } from './commands/create-admin.command/create-admin.command';
import { CreateAdminQuestions } from './questions/create-admin.questions/create-admin.questions';

const ENV = process.env.NODE_ENV;

/** Provides the standalone administrative command-line application context. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV ? `.env.${ENV}` : '.env',
    }),
    PrismaModule,
    AdminAuditModule,
  ],
  providers: [
    AdminProvisioningService,
    CreateAdminCommand,
    CreateAdminQuestions,
  ],
})
export class CliModule {}
