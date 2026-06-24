import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from 'src/prisma/prisma.service';

@ApiTags('API Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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

    return {
      status: 'ok',
      database: 'ok',
      env: {
        jwt_secret: Boolean(process.env.JWT_SECRET),
        database_url: Boolean(process.env.DB_URL),
        twilio_webhook_auth: Boolean(
          process.env.TWILIO_AUTH_TOKEN || process.env.AUTH_TOKEN,
        ),
      },
    };
  }
}
