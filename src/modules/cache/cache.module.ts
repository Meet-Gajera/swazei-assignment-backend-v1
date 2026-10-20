import {
  Global,
  Injectable,
  Logger,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * A tiny cache abstraction with two backends:
 *  - Redis (ioredis) when `REDIS_URL`/`REDIS_HOST` is configured
 *  - An in-process Map fallback so the app runs without any external
 *    infrastructure (this is what the assignment's "no docker" constraint
 *    requires).
 *
 * The rest of the codebase only talks to `CacheService`, so swapping the
 * backend is a configuration change, not a code change.
 */
export const CACHE_SERVICE = 'CACHE_SERVICE';

export interface CacheService {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  delByPattern(pattern: string): Promise<void>;
  isConnected(): boolean;
}

@Injectable()
export class RedisCacheService implements CacheService, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly fallback = new Map<
    string,
    { value: unknown; expiresAt: number }
  >();
  private client: Redis | null = null;
  private connected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    if (!this.configService.get<boolean>('redis.enabled')) {
      this.logger.log('Redis is disabled - using the in-process cache');
      return;
    }

    const url = this.configService.get<string>('redis.url');
    const host = this.configService.get<string>('redis.host');
    const port = this.configService.get<number>('redis.port');
    const password = this.configService.get<string>('redis.password');

    const client = url
      ? new Redis(url, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null, // do not hammer an unreachable Redis
        })
      : new Redis({
          host,
          port,
          password,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
        });

    client.on('error', (error) => {
      this.logger.warn(
        `Redis error, falling back to in-memory cache: ${error.message}`,
      );
      this.connected = false;
    });
    client.on('ready', () => {
      this.connected = true;
      this.logger.log('Redis cache connected');
    });

    this.client = client;

    try {
      await client.connect();
    } catch {
      this.logger.warn(
        'Redis is not reachable - using in-memory cache fallback for development.',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    try {
      // `disconnect` closes the socket immediately, which also works when the
      // client never managed to connect (no dangling handles in tests).
      this.client.disconnect();
    } catch {
      /* ignore */
    }
    this.client = null;
  }

  isConnected(): boolean {
    return this.connected && this.client?.status === 'ready';
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (this.isConnected()) {
      try {
        const raw = await this.client!.get(key);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch (error) {
        this.logger.warn(
          `Redis GET failed for ${key}: ${(error as Error).message}`,
        );
      }
    }
    return this.getFromFallback<T>(key);
  }

  async set<T = unknown>(
    key: string,
    value: T,
    ttlSeconds?: number,
  ): Promise<void> {
    const ttl =
      ttlSeconds ?? this.configService.get<number>('redis.cacheTtl') ?? 60;
    if (this.isConnected()) {
      try {
        await this.client!.set(key, JSON.stringify(value), 'EX', ttl);
        return;
      } catch (error) {
        this.logger.warn(
          `Redis SET failed for ${key}: ${(error as Error).message}`,
        );
      }
    }
    this.setInFallback(key, value, ttl);
  }

  async del(key: string): Promise<void> {
    if (this.isConnected()) {
      try {
        await this.client!.del(key);
      } catch {
        /* ignore */
      }
    }
    this.fallback.delete(key);
  }

  async delByPattern(pattern: string): Promise<void> {
    if (this.isConnected()) {
      try {
        const keys = await this.client!.keys(pattern);
        if (keys.length) {
          await this.client!.del(...keys);
        }
      } catch {
        /* ignore */
      }
    }
    const regex = new RegExp(
      `^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`,
    );
    for (const key of Array.from(this.fallback.keys())) {
      if (regex.test(key)) this.fallback.delete(key);
    }
  }

  private getFromFallback<T>(key: string): T | null {
    const entry = this.fallback.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.fallback.delete(key);
      return null;
    }
    return entry.value as T;
  }

  private setInFallback(key: string, value: unknown, ttl: number): void {
    this.fallback.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
  }
}

@Global()
@Module({
  providers: [
    {
      provide: CACHE_SERVICE,
      useFactory: (configService: ConfigService) =>
        new RedisCacheService(configService),
      inject: [ConfigService],
    },
  ],
  exports: [CACHE_SERVICE],
})
export class CacheModule {}
