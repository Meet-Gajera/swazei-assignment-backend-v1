import { DataSource } from 'typeorm';
import configuration from '../config/configuration';
import { buildDataSourceOptions, DatabaseConfig } from './data-source.options';

const config = configuration();

/**
 * Stand-alone DataSource used by the TypeORM CLI
 * (`npm run migration:run`, `npm run migration:revert`, `npm run seed`).
 */
export const AppDataSource = new DataSource(
  buildDataSourceOptions({
    url: config.database.url,
    host: config.database.host,
    port: config.database.port,
    username: config.database.username,
    password: config.database.password,
    database: config.database.database,
    ssl: config.database.ssl,
    synchronize: false,
    logging: config.database.logging,
  } as DatabaseConfig),
);

export default AppDataSource;
