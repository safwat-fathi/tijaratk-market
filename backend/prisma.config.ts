import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

const ENV = process.env.NODE_ENV;
config({
  path: ENV ? `.env.${ENV}` : '.env',
  quiet: true,
});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.MIGRATE_DB_URL ?? process.env.DB_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
