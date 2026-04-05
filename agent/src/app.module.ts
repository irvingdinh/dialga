import { Module } from '@nestjs/common';

import { CoreModule } from './core/core.module';
import { FilesystemModule } from './filesystem/filesystem.module';
import { GitModule } from './git/git.module';
import { HealthModule } from './health/health.module';
import { TaskModule } from './task/task.module';
import { WebSocketModule } from './websocket/websocket.module';

@Module({
  imports: [
    CoreModule,
    WebSocketModule,
    HealthModule,
    TaskModule,
    FilesystemModule,
    GitModule,
  ],
})
export class AppModule {}
