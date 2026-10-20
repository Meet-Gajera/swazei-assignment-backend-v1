import {
  Global,
  Injectable,
  Logger,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { buildDataSourceOptions, DatabaseConfig } from './data-source.options';
import {
  EmbeddedPostgresHandle,
  startEmbeddedPostgres,
} from './embedded-postgres';
import { SeedOnBoot } from './seed-on-boot.service';

const logger = new Logger('DatabaseModule');

let embeddedHandle: EmbeddedPostgresHandle | null = null;

/**
 * Boots (and stops) the embedded PostgreSQL server used when no external
 * `DATABASE_URL` is configured. Keeping this behind a flag means the exact
 * same code path runs against a managed PostgreSQL in production.
 */
@Injectable()
export class DatabaseLifecycle implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    // Only stop the server when this process is the one that started it.
    if (embeddedHandle && !embeddedHandle.reused) {
      logger.log('Stopping embedded PostgreSQL...');
      await embeddedHandle.stop();
    }
    embeddedHandle = null;
  }
}

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (
        configService: ConfigService,
      ): Promise<TypeOrmModuleOptions> => {
        const base = configService.get<DatabaseConfig>('database');

        if (base.url) {
          logger.log('Connecting to the configured PostgreSQL database');
          return buildDataSourceOptions(base);
        }

        const useEmbedded =
          configService.get<string>('database.useEmbedded') !== 'false';

        if (!useEmbedded) {
          throw new Error(
            'No DATABASE_URL configured and the embedded PostgreSQL fallback is disabled.',
          );
        }

        embeddedHandle = await startEmbeddedPostgres({
          port: configService.get<number>('database.embeddedPort'),
          user: configService.get<string>('database.username'),
          password: configService.get<string>('database.password'),
          database: configService.get<string>('database.database'),
        });

        return buildDataSourceOptions({
          ...base,
          url: embeddedHandle.url,
        });
      },
    }),
  ],
  providers: [DatabaseLifecycle, SeedOnBoot],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
