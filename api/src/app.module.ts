import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module.js';
import { CoreModule } from './core/core.module.js';
import { GatewayModule } from './gateway/gateway.module.js';
import { HealthModule } from './health/health.module.js';
import { MachinesModule } from './machines/machines.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { StreamingModule } from './streaming/streaming.module.js';
import { ThreadsModule } from './threads/threads.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';

@Module({
  imports: [
    CoreModule,
    StreamingModule,
    AuthModule,
    HealthModule,
    MachinesModule,
    WorkspacesModule,
    ThreadsModule,
    MessagesModule,
    GatewayModule,
  ],
})
export class AppModule {}
