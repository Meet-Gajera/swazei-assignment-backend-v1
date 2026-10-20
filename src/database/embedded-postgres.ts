import { Logger } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createConnection } from 'net';

const logger = new Logger('EmbeddedPostgres');

export interface EmbeddedPostgresOptions {
  /** Directory that holds the PostgreSQL cluster. Stable across restarts. */
  dataDir?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

export interface EmbeddedPostgresHandle {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  url: string;
  /** true when the server was already running and has been reused */
  reused: boolean;
  stop: () => Promise<void>;
}

/**
 * Default data directory: `<cwd>/.pgdata`. It is stable so that the data
 * survives a restart of the application, and so that the application and the
 * seed script always talk to the SAME database.
 */
export function defaultDataDir(): string {
  return join(process.cwd(), '.pgdata');
}

function connectionFile(dataDir: string): string {
  return join(dataDir, 'connection.json');
}

function isPortOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const finish = (result: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(500);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

/**
 * Boots a real PostgreSQL server from the binaries shipped with the
 * `embedded-postgres` dev dependency.
 *
 * This exists purely so the project can be developed and tested WITHOUT Docker
 * or a system-wide PostgreSQL installation. In production you point
 * `DATABASE_URL` at a managed PostgreSQL and this code path is never used.
 *
 * The cluster lives in a stable directory (`.pgdata`) and the connection
 * details are written to `.pgdata/connection.json`, so:
 *  - the data survives an application restart,
 *  - `npm run seed` reuses the instance that the application is already
 *    running instead of starting a second, isolated database.
 */
export async function startEmbeddedPostgres(
  options: EmbeddedPostgresOptions = {},
): Promise<EmbeddedPostgresHandle> {
  let EmbeddedPostgres: any;
  try {
    // The embedded PostgreSQL binaries are a dev dependency, so they are
    // loaded lazily and the failure is handled gracefully.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    EmbeddedPostgres = require('embedded-postgres');
  } catch {
    throw new Error(
      'The embedded PostgreSQL binaries are not installed. Run `npm install` ' +
        '(dev dependencies) or set DATABASE_URL to an existing PostgreSQL instance.',
    );
  }

  const EmbeddedPostgresCtor = EmbeddedPostgres.default ?? EmbeddedPostgres;

  const dataDir = options.dataDir ?? defaultDataDir();
  const port = options.port ?? 55432;
  const user = options.user ?? 'postgres';
  const password = options.password ?? 'postgres';
  const database = options.database ?? 'swazei_pos';

  const host = '127.0.0.1';
  const url = `postgres://${user}:${password}@${host}:${port}/${database}`;

  // Reuse an already running instance (e.g. the application is up and the
  // seed script is executed against it).
  if (await isPortOpen(host, port)) {
    logger.log(
      `Reusing the PostgreSQL instance already running on port ${port}`,
    );
    return {
      host,
      port,
      user,
      password,
      database,
      url,
      reused: true,
      stop: async () => undefined,
    };
  }

  mkdirSync(dataDir, { recursive: true });

  const server = new EmbeddedPostgresCtor({
    databaseDir: dataDir,
    user,
    password,
    port,
    persistent: true,
    onLog: () => undefined,
    onError: () => undefined,
  });

  if (!existsSync(join(dataDir, 'PG_VERSION'))) {
    await server.initialise();
  }
  await server.start();
  try {
    await server.createDatabase(database);
  } catch (error) {
    // The database already exists (the cluster is persistent) - that is fine.
    if (!/already exists/i.test((error as Error).message)) {
      throw error;
    }
  }

  writeFileSync(
    connectionFile(dataDir),
    JSON.stringify({ host, port, user, password, database, url }, null, 2),
  );

  logger.log(`Embedded PostgreSQL started on port ${port} (${database})`);

  return {
    host,
    port,
    user,
    password,
    database,
    url,
    reused: false,
    stop: async () => {
      try {
        await server.stop();
      } catch {
        /* the server may already be down */
      }
    },
  };
}

/**
 * Reads the connection details of a previously started embedded instance.
 */
export function readEmbeddedPostgresConnection(
  dataDir: string = defaultDataDir(),
): { url: string } | null {
  const file = connectionFile(dataDir);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as { url: string };
  } catch {
    return null;
  }
}
