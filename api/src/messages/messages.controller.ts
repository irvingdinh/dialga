import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import type { Request, Response } from 'express';

import { CurrentUser } from '../core/decorators/current-user.decorator.js';
import type { User } from '../core/entities/index.js';
import { AuthGuard } from '../core/guards/auth.guard.js';
import { MachineAuthGuard } from '../core/guards/machine-auth.guard.js';
import { MessagesService } from './messages.service.js';

class SendMessageDto {
  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  model?: string;
}

@Controller('api')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('tasks/active')
  async listActive(@CurrentUser() user: User) {
    const tasks = await this.messagesService.listActive(user.id);
    return { tasks };
  }

  @Get('usage/summary')
  async getGlobalUsage(@CurrentUser() user: User) {
    return this.messagesService.getGlobalUsage(user.id);
  }

  @Get('activity/recent')
  async listRecent(
    @CurrentUser() user: User,
    @Query('limit') limitStr?: string,
  ) {
    const limit = limitStr ? Math.min(parseInt(limitStr, 10), 50) : 20;
    const items = await this.messagesService.listRecent(user.id, limit);
    return { items };
  }

  @Get('threads/:threadId/messages')
  async list(
    @CurrentUser() user: User,
    @Param('threadId') threadId: string,
    @Query('limit') limitStr?: string,
    @Query('before') before?: string,
    @Query('q') q?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    const { messages, has_more } = await this.messagesService.list(
      threadId,
      user.id,
      { limit, before, q },
    );
    return {
      messages: messages.map((m) => ({
        id: m.id,
        thread_id: m.thread_id,
        role: m.role,
        content: m.content,
        model: m.model,
        status: m.status,
        metadata: m.metadata ? JSON.parse(m.metadata) : null,
        started_at: m.started_at,
        completed_at: m.completed_at,
        created_at: m.created_at,
      })),
      has_more,
    };
  }

  @Post('threads/:threadId/messages')
  async send(
    @CurrentUser() user: User,
    @Param('threadId') threadId: string,
    @Body() dto: SendMessageDto,
  ) {
    const { userMessage, assistantMessage } = await this.messagesService.send(
      threadId,
      user.id,
      dto,
    );
    return {
      user_message: {
        id: userMessage.id,
        thread_id: userMessage.thread_id,
        role: userMessage.role,
        content: userMessage.content,
        status: userMessage.status,
        created_at: userMessage.created_at,
      },
      assistant_message: {
        id: assistantMessage.id,
        thread_id: assistantMessage.thread_id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        model: assistantMessage.model,
        status: assistantMessage.status,
        created_at: assistantMessage.created_at,
      },
    };
  }

  @Post('messages/:id/cancel')
  async cancel(@CurrentUser() user: User, @Param('id') id: string) {
    const m = await this.messagesService.cancel(id, user.id);
    return {
      id: m.id,
      status: m.status,
      completed_at: m.completed_at,
    };
  }

  @Post('messages/:id/retry')
  async retry(@CurrentUser() user: User, @Param('id') id: string) {
    const m = await this.messagesService.retry(id, user.id);
    return {
      assistant_message: {
        id: m.id,
        thread_id: m.thread_id,
        role: m.role,
        content: m.content,
        model: m.model,
        status: m.status,
        created_at: m.created_at,
      },
    };
  }

  @Get('threads/:threadId/usage')
  async getUsage(
    @CurrentUser() user: User,
    @Param('threadId') threadId: string,
  ) {
    return this.messagesService.getThreadUsage(threadId, user.id);
  }

  @Get('threads/:threadId/messages.jsonl')
  @Header('Content-Type', 'application/x-ndjson')
  async getJsonl(
    @CurrentUser() user: User,
    @Param('threadId') threadId: string,
    @Res() res: Response,
  ) {
    await this.messagesService.verifyThreadOwnership(threadId, user.id);
    const jsonl = await this.messagesService.getAsJsonl(threadId);
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.send(jsonl);
  }
}

@Controller('api')
@UseGuards(MachineAuthGuard)
export class MachineMessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('agent/threads/:threadId/messages.jsonl')
  @Header('Content-Type', 'application/x-ndjson')
  async getJsonl(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Res() res: Response,
  ) {
    const machine = (req as Request & { machine: { id: string } }).machine;
    await this.messagesService.verifyThreadBelongsToMachine(
      threadId,
      machine.id,
    );
    const jsonl = await this.messagesService.getAsJsonl(threadId);
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.send(jsonl);
  }
}
