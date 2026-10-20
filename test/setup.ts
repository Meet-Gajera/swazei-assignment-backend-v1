import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const TEST_DB_FILE = join(__dirname, '..', '.test-db.json');

/**
 * Runs inside every Jest worker before the test files are loaded. It makes the
 * database connection string produced by `global-setup` available to the
 * application module (the workers do not inherit the parent env).
 */
if (existsSync(TEST_DB_FILE)) {
  const info = JSON.parse(readFileSync(TEST_DB_FILE, 'utf-8')) as {
    url: string;
  };
  process.env.DATABASE_URL = info.url;
  process.env.DB_MIGRATIONS_RUN = 'false';
  process.env.USE_EMBEDDED_DB = 'false';
  process.env.REDIS_ENABLED = 'false';
  process.env.JWT_SECRET =
    process.env.JWT_SECRET ?? 'test-secret-key-for-jest-suite-32chars';
}
