import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { AgentLog, Machine } from '../core/entities/index.js';
import { AgentLogsController } from './agent-logs.controller.js';
import { AgentLogsService } from './agent-logs.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([AgentLog, Machine]), AuthModule],
  controllers: [AgentLogsController],
  providers: [AgentLogsService],
  exports: [AgentLogsService],
})
export class AgentLogsModule {}
