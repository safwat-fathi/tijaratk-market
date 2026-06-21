import { Logger } from '@nestjs/common';
import { config } from 'dotenv';
import { Pool } from 'pg';

config({
  path:
    process.env.NODE_ENV === 'production'
      ? '.env.production'
      : '.env.development',
});

const logger = new Logger('GrantPermissions');

async function main() {
  const dbUrl = process.env.DB_URL;
  const migrateDbUrl = process.env.MIGRATE_DB_URL;

  if (!dbUrl) {
    logger.error('DB_URL is not defined in environment');
    process.exit(1);
  }

  const appUser = new URL(dbUrl).username;
  if (!appUser) {
    logger.warn('Could not parse username from DB_URL, skipping permissions grant.');
    return;
  }

  const connectionString = migrateDbUrl ?? dbUrl;
  const migrationUser = new URL(connectionString).username;

  if (appUser === migrationUser) {
    logger.log('App user and migration user are the same. No separate permissions grant needed.');
    return;
  }

  logger.log(`Granting schema permissions on public to app user "${appUser}"...`);

  const pool = new Pool({ connectionString });

  try {
    await pool.query(`GRANT ALL ON SCHEMA public TO ${appUser};`);
    await pool.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${appUser};`);
    await pool.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${appUser};`);
    await pool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${appUser};`);
    await pool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${appUser};`);

    logger.log(`Successfully granted schema permissions to "${appUser}".`);
  } catch (error) {
    logger.error(`Failed to grant schema permissions to "${appUser}":`, error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  logger.error('Grant permissions script failed', error);
  process.exit(1);
});
