import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEvent, OutboxStatus } from '../../database/entities';
import { OUTBOX_QUEUE_NAME, OutboxService } from './outbox.service';
import { QUEUE_SERVICE, Queue } from './queue.service';

const POLL_INTERVAL_MS = 1000;
const BATCH_SIZE = 50;

/**
 * Drains the transactional outbox and hands the events over to the queue
 * (Redis list in production, in-memory fallback locally). This is the
 * "asynchronous processing using a queue" part of the assignment.
 */
@Injectable()
export class OutboxPublisher
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OutboxPublisher.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepository: Repository<OutboxEvent>,
    private readonly outboxService: OutboxService,
    @Inject(QUEUE_SERVICE) private readonly queue: Queue,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => {
      void this.drain();
    }, POLL_INTERVAL_MS);
    this.timer.unref?.();
    this.logger.log('Outbox publisher started');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Publishes a single event immediately (used by the sale flow to reduce the
   * publish latency) and marks the outbox row as processed.
   */
  async publishNow(event: OutboxEvent): Promise<void> {
    await this.queue.add(OUTBOX_QUEUE_NAME, {
      id: event.id,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      merchantId: event.merchantId,
      storeId: event.storeId,
      payload: event.payload,
    });

    await this.outboxRepository.update(event.id, {
      status: OutboxStatus.PROCESSED,
      processedAt: new Date(),
    });
  }

  async drain(): Promise<number> {
    if (this.running) return 0;
    this.running = true;

    try {
      const pending = await this.outboxRepository.find({
        where: { status: OutboxStatus.PENDING },
        order: { createdAt: 'ASC' },
        take: BATCH_SIZE,
      });

      for (const event of pending) {
        try {
          await this.publishNow(event);
        } catch (error) {
          const attempts = event.attempts + 1;
          await this.outboxRepository.update(event.id, {
            attempts,
            status: attempts >= 5 ? OutboxStatus.FAILED : OutboxStatus.PENDING,
            lastError: (error as Error).message,
          });
          this.logger.error(
            `Failed to publish outbox event ${event.id}: ${(error as Error).message}`,
          );
        }
      }

      return pending.length;
    } catch (error) {
      this.logger.error(`Outbox drain failed: ${(error as Error).message}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
