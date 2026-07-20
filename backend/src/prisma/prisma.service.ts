import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { passwordExtension } from './password.extension';
import {
  getDatabaseTargetFingerprint,
  getRuntimeIdentity,
} from '../common/utils/runtime-identity.util';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DB_URL,
    });

    const nodeEnv = String(process.env.NODE_ENV || '');
    const queryLoggingEnabled =
      ['development', 'staging'].includes(nodeEnv) ||
      Boolean(process.env.SLOW_QUERY_MS);
    let logConfig: ConstructorParameters<typeof PrismaClient>[0]['log'] = [
      'error',
    ];

    if (nodeEnv === 'development') {
      logConfig = [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ];
    } else if (queryLoggingEnabled) {
      logConfig = [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
      ];
    }

    super({
      adapter,
      log: logConfig,
    });

    if (queryLoggingEnabled) {
      this.$on(
        'query' as never,
        (event: { duration: number; query: string }) => {
          const slowQueryMs = Number(process.env.SLOW_QUERY_MS ?? 250);
          if (event.duration >= slowQueryMs) {
            console.warn(
              JSON.stringify({
                message: 'Slow Prisma query',
                durationMs: event.duration,
                query: event.query,
              }),
            );
          }
        },
      );
    }

    const extendedClient = this.$extends(passwordExtension) as unknown as this;

    extendedClient.onModuleInit = this.onModuleInit.bind(this);
    extendedClient.onModuleDestroy = this.onModuleDestroy.bind(this);

    return extendedClient;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log(
      JSON.stringify({
        event: 'database_client_ready',
        ...getRuntimeIdentity(),
        databaseTargetFingerprint: getDatabaseTargetFingerprint(),
      }),
    );
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
