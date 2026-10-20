import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { seed } from './seeds/seed';

/**
 * Loads the sample data into the database the first time it is created, so
 * that `npm run start:dev` gives a database that is immediately usable.
 *
 * The seed itself is idempotent, so running it again is harmless. It is only
 * enabled automatically for the embedded (local) database - never for an
 * external `DATABASE_URL` unless `SEED_ON_START=true` is set explicitly.
 */
@Injectable()
export class SeedOnBoot implements OnApplicationBootstrap {
  private readonly logger = new Logger('SeedOnBoot');

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const enabled = this.configService.get<boolean>('database.seedOnStart');
    if (!enabled) return;

    try {
      const result = await seed(this.dataSource);
      this.logger.log(
        `Sample data ready (${result.merchants.length} merchants, ` +
          `${result.stores.length} stores, ${result.users.length} users, ` +
          `${result.products.length} products) - password: Passw0rd!`,
      );
    } catch (error) {
      this.logger.warn(
        `Could not load the sample data: ${(error as Error).message}`,
      );
    }
  }
}
