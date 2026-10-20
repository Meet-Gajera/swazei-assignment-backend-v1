import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from '../../database/entities';
import { QUEUE_SERVICE, QueueService } from './queue.service';
import { OutboxService } from './outbox.service';
import { OutboxPublisher } from './outbox.publisher';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent])],
  providers: [
    {
      provide: QUEUE_SERVICE,
      useFactory: (configService: ConfigService) =>
        new QueueService(configService),
      inject: [ConfigService],
    },
    OutboxService,
    OutboxPublisher,
  ],
  exports: [QUEUE_SERVICE, OutboxService, OutboxPublisher],
})
export class QueueModule {}
