import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';

import { CurrentUser } from '../core/decorators/current-user.decorator.js';
import type { User } from '../core/entities/index.js';
import { AuthGuard } from '../core/guards/auth.guard.js';
import { ThreadsService } from './threads.service.js';

class CreateThreadDto {
  @IsString()
  @IsOptional()
  workspace_id?: string;

  @IsString()
  @IsOptional()
  title?: string;
}

@Controller('api')
@UseGuards(AuthGuard)
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Get('machines/:machineId/threads')
  async list(
    @CurrentUser() user: User,
    @Param('machineId') machineId: string,
    @Query('workspace_id') workspaceId?: string,
  ) {
    const threads = await this.threadsService.list(
      machineId,
      user.id,
      workspaceId,
    );
    return threads.map((t) => ({
      id: t.id,
      machine_id: t.machine_id,
      workspace_id: t.workspace_id,
      workspace_name: t.workspace?.name || null,
      title: t.title,
      status: t.status,
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));
  }

  @Post('machines/:machineId/threads')
  async create(
    @CurrentUser() user: User,
    @Param('machineId') machineId: string,
    @Body() dto: CreateThreadDto,
  ) {
    const t = await this.threadsService.create(machineId, user.id, dto);
    return {
      id: t.id,
      machine_id: t.machine_id,
      workspace_id: t.workspace_id,
      title: t.title,
      status: t.status,
      created_at: t.created_at,
      updated_at: t.updated_at,
    };
  }

  @Get('threads/:id')
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    const t = await this.threadsService.findOne(id, user.id);
    return {
      id: t.id,
      machine_id: t.machine_id,
      workspace_id: t.workspace_id,
      workspace_name: t.workspace?.name || null,
      title: t.title,
      status: t.status,
      created_at: t.created_at,
      updated_at: t.updated_at,
    };
  }

  @Delete('threads/:id')
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.threadsService.remove(id, user.id);
    return { success: true };
  }
}
