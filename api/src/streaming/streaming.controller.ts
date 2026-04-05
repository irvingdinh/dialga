import { Controller, Param, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';

import { CurrentUser } from '../core/decorators/current-user.decorator.js';
import { User } from '../core/entities/index.js';
import { AuthGuard } from '../core/guards/auth.guard.js';
import { StreamingService } from './streaming.service.js';

@Controller('api')
@UseGuards(AuthGuard)
export class StreamingController {
  constructor(private readonly streamingService: StreamingService) {}

  @Sse('threads/:threadId/stream')
  threadStream(@Param('threadId') threadId: string): Observable<MessageEvent> {
    return this.streamingService.subscribe(
      this.streamingService.threadChannel(threadId),
    );
  }

  @Sse('machines/stream')
  machinesStream(): Observable<MessageEvent> {
    return this.streamingService.subscribe(
      this.streamingService.machinesChannel(),
    );
  }

  @Sse('machines/:machineId/threads/stream')
  machineThreadsStream(
    @Param('machineId') machineId: string,
  ): Observable<MessageEvent> {
    return this.streamingService.subscribe(
      this.streamingService.machineThreadsChannel(machineId),
    );
  }

  @Sse('notifications/stream')
  notificationsStream(@CurrentUser() user: User): Observable<MessageEvent> {
    return this.streamingService.subscribe(
      this.streamingService.userNotificationsChannel(user.id),
    );
  }
}
