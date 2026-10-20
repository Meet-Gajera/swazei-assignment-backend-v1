export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret:
      process.env.JWT_SECRET || 'swazei-dev-secret-key-very-strong-32chars-min',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'swazei_pos',
    ssl: process.env.DB_SSL === 'true',
    // Auto-create the schema in dev/test; migrations are used in production.
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
    migrationsRun: process.env.DB_MIGRATIONS_RUN !== 'false',
    /**
     * When no DATABASE_URL is provided the app boots a real PostgreSQL server
     * from the bundled binaries (dev dependency) so the project runs without
     * Docker. Set USE_EMBEDDED_DB=false to disable and require DATABASE_URL.
     */
    useEmbedded: process.env.USE_EMBEDDED_DB !== 'false',
    embeddedPort: parseInt(process.env.EMBEDDED_DB_PORT, 10) || 55432,
    /**
     * Load the sample data on boot. Enabled by default for the embedded
     * (local) database, disabled for an external DATABASE_URL.
     */
    seedOnStart:
      process.env.SEED_ON_START !== undefined
        ? process.env.SEED_ON_START === 'true'
        : !process.env.DATABASE_URL && process.env.NODE_ENV !== 'production',
  },
  redis: {
    enabled: process.env.REDIS_ENABLED !== 'false',
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true',
    cacheTtl: parseInt(process.env.CACHE_TTL_SECONDS, 10) || 60,
  },
  payment: {
    defaultSuccessRate:
      parseFloat(process.env.PAYMENT_DEFAULT_SUCCESS_RATE) || 1.0,
  },
});
