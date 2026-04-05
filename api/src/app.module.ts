import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module.js';
import { CoreModule } from './core/core.module.js';
import { HealthModule } from './health/health.module.js';
import { MachinesModule } from './machines/machines.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';

@Module({
  imports: [
    CoreModule,
    AuthModule,
    HealthModule,
    MachinesModule,
    WorkspacesModule,
  ],
})
export class AppModule {}
