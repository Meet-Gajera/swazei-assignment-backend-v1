import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const QUEUE_SERVICE = 'QUEUE_SERVICE';

export interface QueueJob<T = unknown> {
  id: string;
  name: string;
  data: T;
  attempts: number;
  enqueuedAt: string;
}

export type JobHandler<T = unknown> = (job: QueueJob<T>) => Promise<void>;

/**
 * Minimal queue abstraction with two backends:
 *  - Redis lists (RPUSH / BLPOP) - survives restarts, works across instances
 *  - In-process fallback - keeps the project runnable without any external
 *    infrastructure (no Docker required)
 */
export interface Queue {
  add<T>(name: string, data: T): Promise<QueueJob<T>>;
  process<T>(name: string, handler: JobHandler<T>): void;
  size(name: string): Promise<number>;
  isDistributed(): boolean;
}

@Injectable()
export class QueueService implements Queue, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly handlers = new Map<string, JobHandler<any>>();
  private readonly memoryQueues = new Map<string, QueueJob<any>[]>();
  private readonly running = new Set<Promise<void>>();

  private client: Redis | null = null;
  private connected = false;
  private shuttingDown = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    if (!this.configService.get<boolean>('redis.enabled')) {
      this.logger.log('Redis is disabled - using the in-process queue');
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
          retryStrategy: () => null,
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
        `Redis queue connection issue (using in-memory fallback): ${error.message}`,
      );
      this.connected = false;
    });
    client.on('ready', () => {
      this.connected = true;
      this.logger.log('Redis queue connected');
    });

    this.client = client;

    try {
      await client.connect();
    } catch {
      this.logger.warn(
        'Redis is not reachable - queue will use the in-memory fallback.',
      );
    }

    // (Re)start the consumers for every registered handler.
    for (const name of this.handlers.keys()) {
      void this.consume(name);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    await Promise.allSettled(Array.from(this.running));
    if (this.client) {
      try {
        this.client.disconnect();
      } catch {
        /* ignore */
      }
      this.client = null;
    }
  }

  isDistributed(): boolean {
    return this.connected && this.client?.status === 'ready';
  }

  async add<T>(name: string, data: T): Promise<QueueJob<T>> {
    const job: QueueJob<T> = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      name,
      data,
      attempts: 0,
      enqueuedAt: new Date().toISOString(),
    };

    if (this.isDistributed()) {
      await this.client!.rpush(`queue:${name}`, JSON.stringify(job));
    } else {
      const queue = this.memoryQueues.get(name) ?? [];
      queue.push(job);
      this.memoryQueues.set(name, queue);
      void this.consume(name);
    }

    return job;
  }

  process<T>(name: string, handler: JobHandler<T>): void {
    this.handlers.set(name, handler);
    if (!this.shuttingDown) {
      void this.consume(name);
    }
  }

  async size(name: string): Promise<number> {
    if (this.isDistributed()) {
      return this.client!.llen(`queue:${name}`);
    }
    return (this.memoryQueues.get(name) ?? []).length;
  }

  private async consume(name: string): Promise<void> {
    if (this.shuttingDown) return;

    const handler = this.handlers.get(name);
    if (!handler) return;

    if (this.isDistributed()) {
      const promise = this.consumeRedis(name, handler);
      this.running.add(promise);
      await promise;
      this.running.delete(promise);
      if (!this.shuttingDown) {
        void this.consume(name);
      }
      return;
    }

    const promise = this.consumeMemory(name, handler);
    this.running.add(promise);
    await promise;
    this.running.delete(promise);
    if (!this.shuttingDown) {
      void this.consume(name);
    }
  }

  private async consumeRedis(
    name: string,
    handler: JobHandler<any>,
  ): Promise<void> {
    try {
      const result = await this.client!.blpop(`queue:${name}`, 5);
      if (!result) return;
      const [, raw] = result;
      const job = JSON.parse(raw) as QueueJob;
      await this.runHandler(name, job, handler);
    } catch (error) {
      this.logger.error(
        `Queue consumer error on "${name}": ${(error as Error).message}`,
      );
    }
  }

  private async consumeMemory(
    name: string,
    handler: JobHandler<any>,
  ): Promise<void> {
    const queue = this.memoryQueues.get(name) ?? [];
    const job = queue.shift();
    if (!job) {
      // Nothing to do - wait a tick before re-polling.
      await new Promise((resolve) => setTimeout(resolve, 50));
      return;
    }
    await this.runHandler(name, job, handler);
  }

  private async runHandler(
    name: string,
    job: QueueJob,
    handler: JobHandler<any>,
  ): Promise<void> {
    try {
      await handler(job);
    } catch (error) {
      this.logger.error(
        `Job "${job.name}" failed: ${(error as Error).message}`,
      );
    }
  }
}
