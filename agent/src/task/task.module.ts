import { Module } from '@nestjs/common';

import { AdaptersModule } from '../adapters/adapters.module';
import { HealthModule } from '../health/health.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { TaskService } from './task.service';

@Module({
  imports: [WebSocketModule, HealthModule, AdaptersModule],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
