import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import type { Response } from 'express';

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

class UpdateThreadDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  status?: 'active' | 'archived';

  @IsOptional()
  workspace_id?: string | null;

  @IsBoolean()
  @IsOptional()
  is_pinned?: boolean;
}

class ForkThreadDto {
  @IsString()
  after_message_id!: string;
}

class BulkThreadDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  thread_ids!: string[];

  @IsString()
  @IsIn(['archive', 'unarchive', 'delete'])
  action!: 'archive' | 'unarchive' | 'delete';
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
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
  ) {
    const threads = await this.threadsService.list(
      machineId,
      user.id,
      workspaceId,
      status,
      q,
      sort,
    );
    const { messageCounts, latestMessages } =
      await this.threadsService.getListMetadata(threads.map((t) => t.id));

    return threads.map((t) => ({
      id: t.id,
      machine_id: t.machine_id,
      workspace_id: t.workspace_id,
      workspace_name: t.workspace?.name || null,
      title: t.title,
      status: t.status,
      is_pinned: t.is_pinned,
      message_count: messageCounts[t.id] || 0,
      latest_message: latestMessages[t.id] || null,
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
      is_pinned: t.is_pinned,
      created_at: t.created_at,
      updated_at: t.updated_at,
    };
  }

  @Post('threads/:id/fork')
  async fork(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: ForkThreadDto,
  ) {
    const t = await this.threadsService.fork(id, user.id, dto.after_message_id);
    return {
      id: t.id,
      machine_id: t.machine_id,
      workspace_id: t.workspace_id,
      workspace_name: t.workspace?.name || null,
      working_directory: t.workspace?.working_directory || null,
      workspace_agent: t.workspace?.agent || null,
      workspace_model: t.workspace?.model || null,
      workspace_custom_instruction: t.workspace?.custom_instruction || null,
      title: t.title,
      status: t.status,
      is_pinned: t.is_pinned,
      created_at: t.created_at,
      updated_at: t.updated_at,
    };
  }

  @Get('threads')
  async listAll(
    @CurrentUser() user: User,
    @Query('machine_id') machineId?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
  ) {
    const threads = await this.threadsService.listAll(user.id, {
      machineId,
      status,
      q,
      sort,
    });
    const { messageCounts, latestMessages } =
      await this.threadsService.getListMetadata(threads.map((t) => t.id));

    return threads.map((t) => ({
      id: t.id,
      machine_id: t.machine_id,
      machine_name: t.machine?.name || null,
      machine_status: t.machine?.status || 'offline',
      workspace_id: t.workspace_id,
      workspace_name: t.workspace?.name || null,
      title: t.title,
      status: t.status,
      is_pinned: t.is_pinned,
      message_count: messageCounts[t.id] || 0,
      latest_message: latestMessages[t.id] || null,
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));
  }

  @Post('threads/bulk')
  async bulk(@CurrentUser() user: User, @Body() dto: BulkThreadDto) {
    const count = await this.threadsService.bulk(
      dto.thread_ids,
      dto.action,
      user.id,
    );
    return { success: true, affected: count };
  }

  @Get('threads/search')
  async searchGlobal(@CurrentUser() user: User, @Query('q') q?: string) {
    if (!q || q.trim().length === 0) return [];
    return this.threadsService.searchGlobal(user.id, q.trim());
  }

  @Get('threads/:id')
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    const t = await this.threadsService.findOne(id, user.id);
    return {
      id: t.id,
      machine_id: t.machine_id,
      workspace_id: t.workspace_id,
      workspace_name: t.workspace?.name || null,
      working_directory: t.workspace?.working_directory || null,
      workspace_agent: t.workspace?.agent || null,
      workspace_model: t.workspace?.model || null,
      workspace_custom_instruction: t.workspace?.custom_instruction || null,
      title: t.title,
      status: t.status,
      is_pinned: t.is_pinned,
      share_token: t.share_token || null,
      created_at: t.created_at,
      updated_at: t.updated_at,
    };
  }

  @Patch('threads/:id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateThreadDto,
  ) {
    const t = await this.threadsService.update(id, user.id, dto);
    return {
      id: t.id,
      machine_id: t.machine_id,
      workspace_id: t.workspace_id,
      workspace_name: t.workspace?.name || null,
      working_directory: t.workspace?.working_directory || null,
      workspace_agent: t.workspace?.agent || null,
      workspace_model: t.workspace?.model || null,
      workspace_custom_instruction: t.workspace?.custom_instruction || null,
      title: t.title,
      status: t.status,
      is_pinned: t.is_pinned,
      share_token: t.share_token || null,
      created_at: t.created_at,
      updated_at: t.updated_at,
    };
  }

  @Post('threads/:id/share')
  async share(@CurrentUser() user: User, @Param('id') id: string) {
    const t = await this.threadsService.share(id, user.id);
    return {
      share_token: t.share_token,
    };
  }

  @Delete('threads/:id/share')
  async unshare(@CurrentUser() user: User, @Param('id') id: string) {
    await this.threadsService.unshare(id, user.id);
    return { success: true };
  }

  @Get('threads/:id/export.md')
  @Header('Content-Type', 'text/markdown; charset=utf-8')
  async exportMarkdown(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const markdown = await this.threadsService.exportAsMarkdown(id, user.id);
    const thread = await this.threadsService.findOne(id, user.id);
    const filename = (thread.title ?? 'thread')
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 80)
      .toLowerCase();
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}.md"`,
    );
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(markdown);
  }

  @Delete('threads/:id')
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.threadsService.remove(id, user.id);
    return { success: true };
  }
}

@Controller('api/shared')
export class SharedThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Get(':token')
  async findByShareToken(@Param('token') token: string) {
    const { thread, messages } =
      await this.threadsService.findByShareToken(token);
    return {
      thread: {
        id: thread.id,
        title: thread.title,
        workspace_name: thread.workspace?.name || null,
        created_at: thread.created_at,
        updated_at: thread.updated_at,
      },
      messages: messages.map((m) => {
        let parsedMetadata = null;
        if (m.metadata) {
          try {
            parsedMetadata =
              typeof m.metadata === 'string'
                ? JSON.parse(m.metadata)
                : m.metadata;
          } catch {
            /* ignore */
          }
        }
        return {
          id: m.id,
          role: m.role,
          content: m.content,
          model: m.model,
          status: m.status,
          metadata: parsedMetadata,
          created_at: m.created_at,
        };
      }),
    };
  }
}
