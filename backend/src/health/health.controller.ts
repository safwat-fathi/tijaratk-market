import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TwilioVerifyService } from 'src/auth/twilio-verify.service';
import { PrismaService } from 'src/prisma/prisma.service';

@ApiTags('API Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly twilioVerifyService: TwilioVerifyService,
  ) {}

  @Get('/')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get app status' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Return ok' })
  @ApiResponse({ status: 500, description: 'Return error' })
  status() {
    return 'ok';
  }

  @Get('/ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get readiness status' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Return readiness state' })
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    const twilioVerifyConfigured = this.twilioVerifyService.isConfigured();

    if (process.env.NODE_ENV === 'production' && !twilioVerifyConfigured) {
      throw new ServiceUnavailableException(
        'Twilio Verify is not configured',
      );
    }

    return {
      status: 'ok',
      database: 'ok',
      env: {
        jwt_secret: Boolean(process.env.JWT_SECRET),
        database_url: Boolean(process.env.DB_URL),
        twilio_webhook_auth: Boolean(
          process.env.TWILIO_AUTH_TOKEN || process.env.AUTH_TOKEN,
        ),
        twilio_verify: twilioVerifyConfigured,
      },
    };
  }

  @Get('/debug-sentry')
  @ApiOperation({ summary: 'Test Sentry error reporting' })
  getError() {
    throw new Error('My first Sentry error!');
  }
}
