import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
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
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
