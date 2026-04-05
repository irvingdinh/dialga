import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Observable, Subject } from 'rxjs';
import { filter, finalize, map } from 'rxjs/operators';

import { AppConfig } from '../core/config/config.js';

export interface StreamEvent {
  channel: string;
  event: string;
  data: Record<string, unknown>;
}

@Injectable()
export class StreamingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StreamingService.name);
  private publisher: Redis;
  private subscriber: Redis;
  private readonly eventSubject = new Subject<StreamEvent>();
  private readonly subscribedChannels = new Map<string, number>();

  constructor(private readonly configService: ConfigService) {
    const redisConfig = this.configService.get<AppConfig>('root')!.redis;
    const redisOptions = redisConfig.url
      ? { maxRetriesPerRequest: 3, lazyConnect: true }
      : {
          host: redisConfig.host,
          port: redisConfig.port,
          username: redisConfig.user,
          password: redisConfig.password,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        };
    this.publisher = redisConfig.url
      ? new Redis(redisConfig.url, redisOptions)
      : new Redis(redisOptions);
    this.subscriber = redisConfig.url
      ? new Redis(redisConfig.url, redisOptions)
      : new Redis(redisOptions);
  }

  async onModuleInit() {
    await Promise.all([this.publisher.connect(), this.subscriber.connect()]);

    this.subscriber.on('message', (channel: string, message: string) => {
      try {
        const parsed = JSON.parse(message) as {
          event: string;
          data: Record<string, unknown>;
        };
        this.eventSubject.next({
          channel,
          event: parsed.event,
          data: parsed.data,
        });
      } catch {
        this.logger.warn(`Invalid message on channel ${channel}`);
      }
    });

    this.logger.log('Redis Pub/Sub connected');
  }

  async onModuleDestroy() {
    this.eventSubject.complete();
    await this.subscriber.quit();
    await this.publisher.quit();
  }

  async publish(
    channel: string,
    event: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify({ event, data }));
  }

  subscribe(channel: string): Observable<MessageEvent> {
    const refCount = this.subscribedChannels.get(channel) || 0;
    if (refCount === 0) {
      void this.subscriber.subscribe(channel);
    }
    this.subscribedChannels.set(channel, refCount + 1);

    return this.eventSubject.pipe(
      filter((e) => e.channel === channel),
      map(
        (e) =>
          ({
            data: JSON.stringify({ ...e.data }),
            type: e.event,
          }) as MessageEvent,
      ),
      finalize(() => {
        const current = this.subscribedChannels.get(channel) || 1;
        if (current <= 1) {
          this.subscribedChannels.delete(channel);
          void this.subscriber.unsubscribe(channel);
        } else {
          this.subscribedChannels.set(channel, current - 1);
        }
      }),
    );
  }

  // Thread streaming: message:status, message:delta, message:complete
  threadChannel(threadId: string): string {
    return `thread:${threadId}:events`;
  }

  // Machine status: machine:status
  machinesChannel(): string {
    return 'machines:status';
  }

  // Thread updates per machine: thread:update
  machineThreadsChannel(machineId: string): string {
    return `machine:${machineId}:threads`;
  }

  // User notifications: task:notification
  userNotificationsChannel(userId: string): string {
    return `user:${userId}:notifications`;
  }

  async publishNotification(
    userId: string,
    data: {
      type:
        | 'task_completed'
        | 'task_error'
        | 'task_timed_out'
        | 'task_cancelled';
      thread_id: string;
      thread_title: string | null;
      machine_name: string;
      message_id: string;
      summary?: string;
    },
  ): Promise<void> {
    await this.publish(
      this.userNotificationsChannel(userId),
      'task:notification',
      data as unknown as Record<string, unknown>,
    );
  }

  // Convenience publish methods
  async publishMessageDelta(
    threadId: string,
    messageId: string,
    type: string,
    content: string,
  ): Promise<void> {
    await this.publish(this.threadChannel(threadId), 'message:delta', {
      message_id: messageId,
      type,
      content,
    });
  }

  async publishMessageStatus(
    threadId: string,
    messageId: string,
    status: string,
  ): Promise<void> {
    await this.publish(this.threadChannel(threadId), 'message:status', {
      message_id: messageId,
      status,
    });
  }

  async publishMessageComplete(
    threadId: string,
    messageId: string,
    status: string,
    summary?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.publish(this.threadChannel(threadId), 'message:complete', {
      message_id: messageId,
      status,
      summary: summary || '',
      metadata: metadata || {},
    });
  }

  async publishMachineStatus(
    machineId: string,
    status: string,
    lastSeenAt: Date,
  ): Promise<void> {
    await this.publish(this.machinesChannel(), 'machine:status', {
      machine_id: machineId,
      status,
      last_seen_at: lastSeenAt.toISOString(),
    });
  }

  async publishThreadUpdate(
    machineId: string,
    threadId: string,
    latestMessagePreview: string,
    status: string,
    updatedAt: Date,
  ): Promise<void> {
    await this.publish(this.machineThreadsChannel(machineId), 'thread:update', {
      thread_id: threadId,
      latest_message_preview: latestMessagePreview,
      status,
      updated_at: updatedAt.toISOString(),
    });
  }
}
