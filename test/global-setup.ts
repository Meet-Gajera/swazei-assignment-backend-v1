import { Logger } from '@nestjs/common';
import { writeFileSync, existsSync, rmSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../src/database/data-source.options';
import { startEmbeddedPostgres } from '../src/database/embedded-postgres';

const logger = new Logger('TestGlobalSetup');

export const TEST_DB_FILE = join(__dirname, '..', '.test-db.json');

interface TestDbInfo {
  url: string;
  embedded: boolean;
}

/**
 * Boots a real PostgreSQL server for the test suite and applies the
 * migrations once, before any test runs.
 *
 * The test cluster lives in its own temporary directory so it never collides
 * with the development database of the running application.
 *
 * When `TEST_DATABASE_URL` is provided the external database is used instead
 * (handy when running the suite against a managed PostgreSQL in CI).
 */
export default async function globalSetup(): Promise<void> {
  const externalUrl = process.env.TEST_DATABASE_URL;
  let url = externalUrl;
  let embeddedStop: (() => Promise<void>) | null = null;

  if (!url) {
    const port = Number(process.env.TEST_EMBEDDED_DB_PORT ?? 55433);
    const dataDir = join(
      mkdtempSync(join(tmpdir(), 'swazei-pg-test-')),
      'data',
    );
    const embedded = await startEmbeddedPostgres({
      port,
      dataDir,
      user: 'postgres',
      password: 'postgres',
      database: 'swazei_pos_test',
    });
    url = embedded.url;
    embeddedStop = embedded.stop;
  }

  const dataSource = new DataSource(
    buildDataSourceOptions({
      url,
      host: '127.0.0.1',
      port: 0,
      username: 'postgres',
      password: 'postgres',
      database: 'swazei_pos_test',
      ssl: false,
      synchronize: false,
      logging: false,
      migrationsRun: true,
    }),
  );

  await dataSource.initialize();
  await dataSource.destroy();

  const info: TestDbInfo = { url, embedded: !externalUrl };
  writeFileSync(TEST_DB_FILE, JSON.stringify(info, null, 2));

  process.env.DATABASE_URL = url;
  process.env.DB_MIGRATIONS_RUN = 'false';

  (globalThis as Record<string, unknown>).__testDbStop = embeddedStop;

  logger.log(`Test database ready at ${url}`);
}

export function cleanupTestDbFile(): void {
  if (existsSync(TEST_DB_FILE)) {
    rmSync(TEST_DB_FILE);
  }
}
