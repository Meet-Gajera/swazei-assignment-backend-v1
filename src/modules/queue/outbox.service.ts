import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { OutboxEvent, OutboxStatus } from '../../database/entities';

export const OUTBOX_QUEUE_NAME = 'outbox';

export interface OutboxEventInput {
  aggregateId: string;
  merchantId: string;
  storeId: string;
  userId?: string | null;
  eventType: string;
  payload: Record<string, unknown>;
}

/**
 * Transactional outbox writer.
 *
 * `record()` MUST be called with the same EntityManager/transaction that
 * performs the business write. That guarantees "business write + event" are
 * committed atomically - an event can never be lost, and an event can never
 * exist for a rolled back transaction.
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(private readonly dataSource: DataSource) {}

  async record(
    input: OutboxEventInput,
    manager?: EntityManager,
  ): Promise<OutboxEvent> {
    const repo = manager
      ? manager.getRepository(OutboxEvent)
      : this.dataSource.getRepository(OutboxEvent);

    return repo.save(
      repo.create({
        aggregateId: input.aggregateId,
        merchantId: input.merchantId,
        storeId: input.storeId,
        userId: input.userId ?? null,
        eventType: input.eventType,
        payload: input.payload,
        status: OutboxStatus.PENDING,
        attempts: 0,
      }),
    );
  }
}
