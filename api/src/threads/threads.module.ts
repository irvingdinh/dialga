import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { Machine, Message, Thread } from '../core/entities/index.js';
import { ThreadsController } from './threads.controller.js';
import { ThreadsService } from './threads.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Thread, Machine, Message]), AuthModule],
  controllers: [ThreadsController],
  providers: [ThreadsService],
  exports: [ThreadsService],
})
export class ThreadsModule {}
