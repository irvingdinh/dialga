import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { Machine } from '../core/entities/index.js';
import { MachinesController } from './machines.controller.js';
import { MachinesService } from './machines.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Machine]), AuthModule],
  controllers: [MachinesController],
  providers: [MachinesService],
  exports: [MachinesService],
})
export class MachinesModule {}
