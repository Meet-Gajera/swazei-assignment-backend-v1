import { DataSourceOptions, LogLevel } from 'typeorm';
import { ALL_ENTITIES } from './entities';
import { MIGRATIONS } from './migrations';

export interface DatabaseConfig {
  url?: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
  synchronize: boolean;
  logging: boolean;
  migrationsRun?: boolean;
}

export function buildDataSourceOptions(
  config: DatabaseConfig,
): DataSourceOptions {
  const common = {
    type: 'postgres' as const,
    entities: ALL_ENTITIES,
    migrations: MIGRATIONS,
    migrationsRun: config.migrationsRun ?? true,
    synchronize: config.synchronize,
    logging: (config.logging
      ? ['query', 'error', 'warn']
      : ['error']) as LogLevel[],
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
  };

  if (config.url) {
    return { ...common, url: config.url } as DataSourceOptions;
  }

  return {
    ...common,
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database,
  } as DataSourceOptions;
}
