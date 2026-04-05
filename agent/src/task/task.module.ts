import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdaptersModule } from '../adapters/adapters.module';
import { TaskRecord } from '../core/entities/task-record.entity';
import { HealthModule } from '../health/health.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { TaskService } from './task.service';

@Module({
  imports: [
    WebSocketModule,
    HealthModule,
    AdaptersModule,
    TypeOrmModule.forFeature([TaskRecord]),
  ],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
