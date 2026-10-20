import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions, DatabaseConfig } from '../data-source.options';
import { startEmbeddedPostgres } from '../embedded-postgres';
import { seed } from './seed';
import configuration from '../../config/configuration';

const logger = new Logger('Seed');

/**
 * Stand-alone seed runner: `npm run seed`.
 *
 * Works both against a configured PostgreSQL (DATABASE_URL) and against the
 * bundled embedded PostgreSQL, so it can be used without Docker.
 */
async function run(): Promise<void> {
  const config = configuration();
  let embeddedStop: (() => Promise<void>) | null = null;

  const dbConfig: DatabaseConfig = {
    url: config.database.url,
    host: config.database.host,
    port: config.database.port,
    username: config.database.username,
    password: config.database.password,
    database: config.database.database,
    ssl: config.database.ssl,
    synchronize: false,
    logging: config.database.logging,
  };

  if (!dbConfig.url && config.database.useEmbedded) {
    const embedded = await startEmbeddedPostgres({
      port: config.database.embeddedPort,
      user: config.database.username,
      password: config.database.password,
      database: config.database.database,
    });
    dbConfig.url = embedded.url;
    embeddedStop = embedded.stop;
  }

  const dataSource = new DataSource(buildDataSourceOptions(dbConfig));
  await dataSource.initialize();

  try {
    const result = await seed(dataSource);
    logger.log('Seed completed');
    logger.log(`  merchants: ${result.merchants.length}`);
    logger.log(`  stores:    ${result.stores.length}`);
    logger.log(`  users:     ${result.users.length}`);
    logger.log(`  products:  ${result.products.length}`);
  } finally {
    await dataSource.destroy();
    if (embeddedStop) {
      await embeddedStop();
    }
  }
}

run().catch((error) => {
  logger.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
