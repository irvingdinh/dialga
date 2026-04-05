import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { Machine, Message, Thread } from '../core/entities/index.js';
import { GatewayModule } from '../gateway/gateway.module.js';
import {
  MachineMessagesController,
  MessagesController,
} from './messages.controller.js';
import { MessagesService } from './messages.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Thread, Machine]),
    AuthModule,
    GatewayModule,
  ],
  controllers: [MessagesController, MachineMessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
