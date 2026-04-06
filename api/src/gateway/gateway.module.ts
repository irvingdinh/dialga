import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Machine, Message, Thread } from '../core/entities/index.js';
import { AgentGateway } from './agent.gateway.js';
import { FsProxyService } from './fs-proxy.service.js';
import { GatewayService } from './gateway.service.js';
import { GitProxyService } from './git-proxy.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Machine, Message, Thread])],
  providers: [AgentGateway, GatewayService, FsProxyService, GitProxyService],
  exports: [GatewayService, FsProxyService, GitProxyService],
})
export class GatewayModule {}
