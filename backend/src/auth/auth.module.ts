import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { JwtStrategy } from './strategies/jwt.strategy';
import CONSTANTS from 'src/common/constants';
import { TenantsModule } from '../tenants/tenants.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { ActivityLogModule } from 'src/activity-log/activity-log.module';
import { TwilioVerifyService } from './twilio-verify.service';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: CONSTANTS.AUTH.JWT }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');

        if (!secret) {
          throw new Error(
            'JWT_SECRET is required to sign authentication tokens.',
          );
        }

        return {
          secret,
          signOptions: { expiresIn: CONSTANTS.SESSION.EXPIRATION_TIME },
        };
      },
    }),
    TenantsModule,
    PushNotificationsModule,
    ActivityLogModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, TwilioVerifyService],
  exports: [AuthService, TwilioVerifyService],
})
export class AuthModule {}
