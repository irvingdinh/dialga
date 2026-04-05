import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { Machine, Thread, Workspace } from '../core/entities/index.js';
import { GatewayModule } from '../gateway/gateway.module.js';
import { MachinesController } from './machines.controller.js';
import { MachinesService } from './machines.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Machine, Thread, Workspace]),
    AuthModule,
    GatewayModule,
  ],
  controllers: [MachinesController],
  providers: [MachinesService],
  exports: [MachinesService],
})
export class MachinesModule {}
