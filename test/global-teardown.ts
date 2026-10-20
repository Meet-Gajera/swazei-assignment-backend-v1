import { existsSync, rmSync } from 'fs';
import { join } from 'path';

const TEST_DB_FILE = join(__dirname, '..', '.test-db.json');

export default async function globalTeardown(): Promise<void> {
  const stop = (globalThis as Record<string, unknown>).__testDbStop as
    (() => Promise<void>) | undefined;

  if (stop) {
    await stop();
  }

  if (existsSync(TEST_DB_FILE)) {
    rmSync(TEST_DB_FILE);
  }
}
