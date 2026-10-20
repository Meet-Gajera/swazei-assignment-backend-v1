import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { QUEUE_SERVICE, Queue, QueueJob } from '../queue/queue.service';
import { OUTBOX_QUEUE_NAME } from '../queue/outbox.service';

/**
 * Consumes the events published by the transactional outbox.
 *
 * In a real system this is where you would send the receipt, update a
 * read-model / analytics store, or call a webhook. Here it simply records
 * that the asynchronous pipeline works end to end.
 */
@Injectable()
export class SaleEventConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(SaleEventConsumer.name);

  constructor(@Inject(QUEUE_SERVICE) private readonly queue: Queue) {}

  onApplicationBootstrap(): void {
    this.queue.process<{
      id: string;
      eventType: string;
      aggregateId: string;
      payload: Record<string, unknown>;
    }>(OUTBOX_QUEUE_NAME, async (job: QueueJob<any>) => {
      this.logger.log(
        `Processed ${job.data?.eventType} for sale ${job.data?.aggregateId}`,
      );
    });
  }
}
