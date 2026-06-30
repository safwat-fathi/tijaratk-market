import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminJwtStrategy } from './guards/admin-jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { TenantCancellationPolicyModule } from 'src/tenant-cancellation-policy/tenant-cancellation-policy.module';
import { ImageProcessorService } from 'src/common/services/image-processor.service';
import { StoresDirectoryModule } from 'src/stores-directory/stores-directory.module';

@Module({
  imports: [
    PrismaModule,
    ProductsModule,
    StoresDirectoryModule,
    TenantCancellationPolicyModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminJwtStrategy, ImageProcessorService],
})
export class AdminModule {}
