import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';

import { CurrentUser } from '../core/decorators/current-user.decorator.js';
import type { User } from '../core/entities/index.js';
import { AuthGuard } from '../core/guards/auth.guard.js';
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

  @Get('threads/:threadId/messages')
  async list(@CurrentUser() user: User, @Param('threadId') threadId: string) {
    const messages = await this.messagesService.list(threadId, user.id);
    return messages.map((m) => ({
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
    }));
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

  @Get('threads/:threadId/messages.jsonl')
  @Header('Content-Type', 'application/x-ndjson')
  async getJsonl(
    @CurrentUser() user: User,
    @Param('threadId') threadId: string,
    @Res() res: Response,
  ) {
    // Verify ownership
    await this.messagesService.list(threadId, user.id);
    const jsonl = await this.messagesService.getAsJsonl(threadId);
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.send(jsonl);
  }
}
