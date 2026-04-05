import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Machine, Message, Thread } from '../core/entities/index.js';
import { AgentGateway } from './agent.gateway.js';
import { GatewayService } from './gateway.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Machine, Message, Thread])],
  providers: [AgentGateway, GatewayService],
  exports: [GatewayService],
})
export class GatewayModule {}
