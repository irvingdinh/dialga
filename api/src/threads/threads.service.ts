import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Machine, Message, Thread, Workspace } from '../core/entities/index.js';

@Injectable()
export class ThreadsService {
  constructor(
    @InjectRepository(Thread)
    private readonly threadRepository: Repository<Thread>,
    @InjectRepository(Machine)
    private readonly machineRepository: Repository<Machine>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
  ) {}

  private async verifyMachineOwnership(
    machineId: string,
    userId: string,
  ): Promise<Machine> {
    const machine = await this.machineRepository.findOne({
      where: { id: machineId },
    });
    if (!machine) throw new NotFoundException('Machine not found');
    if (machine.user_id !== userId) throw new ForbiddenException();
    return machine;
  }

  async list(
    machineId: string,
    userId: string,
    workspaceId?: string,
    status?: string,
    q?: string,
    sort?: string,
  ): Promise<Thread[]> {
    await this.verifyMachineOwnership(machineId, userId);

    const qb = this.threadRepository
      .createQueryBuilder('thread')
      .leftJoinAndSelect('thread.workspace', 'workspace')
      .where('thread.machine_id = :machineId', { machineId });

    if (workspaceId) {
      qb.andWhere('thread.workspace_id = :workspaceId', { workspaceId });
    }

    if (status === 'archived') {
      qb.andWhere('thread.status = :status', { status: 'archived' });
    } else if (status !== 'all') {
      qb.andWhere('thread.status = :status', { status: 'active' });
    }

    if (q) {
      qb.leftJoin('thread.messages', 'message')
        .andWhere('(thread.title LIKE :q OR message.content LIKE :q)', {
          q: `%${q}%`,
        })
        .groupBy('thread.id')
        .addGroupBy('workspace.id');
    }

    // Pinned threads always first, then sort within each group
    qb.orderBy('thread.is_pinned', 'DESC');
    switch (sort) {
      case 'created':
        qb.addOrderBy('thread.created_at', 'DESC');
        break;
      case 'created_asc':
        qb.addOrderBy('thread.created_at', 'ASC');
        break;
      case 'title':
        qb.addOrderBy('thread.title', 'ASC');
        break;
      default:
        qb.addOrderBy('thread.updated_at', 'DESC');
        break;
    }

    return qb.getMany();
  }

  async getListMetadata(threadIds: string[]): Promise<{
    messageCounts: Record<string, number>;
    latestMessages: Record<
      string,
      { role: string; content: string; status: string }
    >;
  }> {
    if (threadIds.length === 0) {
      return { messageCounts: {}, latestMessages: {} };
    }

    // Message counts per thread
    const countResults: Array<{ thread_id: string; count: string }> =
      await this.messageRepository
        .createQueryBuilder('m')
        .select('m.thread_id', 'thread_id')
        .addSelect('COUNT(*)', 'count')
        .where('m.thread_id IN (:...threadIds)', { threadIds })
        .groupBy('m.thread_id')
        .getRawMany();

    const messageCounts: Record<string, number> = {};
    for (const c of countResults) {
      messageCounts[c.thread_id] = parseInt(c.count, 10);
    }

    // Latest message per thread (correlated subquery for max created_at)
    const latestResults: Array<{
      thread_id: string;
      role: string;
      content: string;
      status: string;
    }> = await this.messageRepository
      .createQueryBuilder('m')
      .select('m.thread_id', 'thread_id')
      .addSelect('m.role', 'role')
      .addSelect('SUBSTRING(m.content, 1, 120)', 'content')
      .addSelect('m.status', 'status')
      .where('m.thread_id IN (:...threadIds)', { threadIds })
      .andWhere((qb) => {
        const sub = qb
          .subQuery()
          .select('MAX(m2.created_at)')
          .from(Message, 'm2')
          .where('m2.thread_id = m.thread_id')
          .getQuery();
        return `m.created_at = ${sub}`;
      })
      .getRawMany();

    const latestMessages: Record<
      string,
      { role: string; content: string; status: string }
    > = {};
    for (const msg of latestResults) {
      latestMessages[msg.thread_id] = {
        role: msg.role,
        content: msg.content || '',
        status: msg.status,
      };
    }

    return { messageCounts, latestMessages };
  }

  async listAll(
    userId: string,
    options: {
      machineId?: string;
      status?: string;
      q?: string;
      sort?: string;
    },
  ): Promise<Thread[]> {
    const qb = this.threadRepository
      .createQueryBuilder('thread')
      .innerJoinAndSelect('thread.machine', 'machine')
      .leftJoinAndSelect('thread.workspace', 'workspace')
      .where('machine.user_id = :userId', { userId })
      .andWhere('machine.deleted_at IS NULL');

    if (options.machineId) {
      qb.andWhere('thread.machine_id = :machineId', {
        machineId: options.machineId,
      });
    }

    if (options.status === 'archived') {
      qb.andWhere('thread.status = :status', { status: 'archived' });
    } else if (options.status !== 'all') {
      qb.andWhere('thread.status = :status', { status: 'active' });
    }

    if (options.q) {
      qb.leftJoin('thread.messages', 'message')
        .andWhere('(thread.title LIKE :q OR message.content LIKE :q)', {
          q: `%${options.q}%`,
        })
        .groupBy('thread.id')
        .addGroupBy('machine.id')
        .addGroupBy('workspace.id');
    }

    qb.orderBy('thread.is_pinned', 'DESC');
    switch (options.sort) {
      case 'created':
        qb.addOrderBy('thread.created_at', 'DESC');
        break;
      case 'created_asc':
        qb.addOrderBy('thread.created_at', 'ASC');
        break;
      case 'title':
        qb.addOrderBy('thread.title', 'ASC');
        break;
      default:
        qb.addOrderBy('thread.updated_at', 'DESC');
        break;
    }

    return qb.getMany();
  }

  async searchGlobal(
    userId: string,
    q: string,
    limit = 10,
  ): Promise<
    Array<{
      id: string;
      machine_id: string;
      machine_name: string;
      workspace_name: string | null;
      title: string | null;
      status: string;
      updated_at: Date;
    }>
  > {
    const qb = this.threadRepository
      .createQueryBuilder('thread')
      .innerJoin('thread.machine', 'machine')
      .leftJoin('thread.workspace', 'workspace')
      .leftJoin('thread.messages', 'message')
      .select([
        'thread.id AS id',
        'thread.machine_id AS machine_id',
        'machine.name AS machine_name',
        'workspace.name AS workspace_name',
        'thread.title AS title',
        'thread.status AS status',
        'thread.updated_at AS updated_at',
      ])
      .where('machine.user_id = :userId', { userId })
      .andWhere('machine.deleted_at IS NULL')
      .andWhere('(thread.title LIKE :q OR message.content LIKE :q)', {
        q: `%${q}%`,
      })
      .groupBy('thread.id')
      .addGroupBy('machine.id')
      .addGroupBy('workspace.id')
      .orderBy('thread.updated_at', 'DESC')
      .limit(limit);

    return qb.getRawMany();
  }

  async create(
    machineId: string,
    userId: string,
    data: { workspace_id?: string; title?: string },
  ): Promise<Thread> {
    await this.verifyMachineOwnership(machineId, userId);
    const thread = this.threadRepository.create({
      machine_id: machineId,
      workspace_id: data.workspace_id || null,
      title: data.title || null,
    });
    return this.threadRepository.save(thread);
  }

  async findOne(id: string, userId: string): Promise<Thread> {
    const thread = await this.threadRepository.findOne({
      where: { id },
      relations: ['machine', 'workspace'],
    });
    if (!thread) throw new NotFoundException('Thread not found');
    if (thread.machine.user_id !== userId) throw new ForbiddenException();
    return thread;
  }

  async update(
    id: string,
    userId: string,
    data: {
      title?: string;
      status?: 'active' | 'archived';
      workspace_id?: string | null;
      is_pinned?: boolean;
    },
  ): Promise<Thread> {
    const thread = await this.findOne(id, userId);
    if (data.title !== undefined) thread.title = data.title;
    if (data.status !== undefined) thread.status = data.status;
    if (data.is_pinned !== undefined) thread.is_pinned = data.is_pinned;
    if (data.workspace_id !== undefined) {
      if (data.workspace_id === null) {
        thread.workspace_id = null;
        thread.workspace = null;
      } else {
        const workspace = await this.workspaceRepository.findOne({
          where: { id: data.workspace_id },
        });
        if (!workspace) throw new NotFoundException('Workspace not found');
        if (workspace.machine_id !== thread.machine_id)
          throw new BadRequestException(
            'Workspace must belong to the same machine',
          );
        thread.workspace_id = workspace.id;
        thread.workspace = workspace;
      }
    }
    return this.threadRepository.save(thread);
  }

  async exportAsMarkdown(id: string, userId: string): Promise<string> {
    const thread = await this.findOne(id, userId);
    const messages = await this.messageRepository.find({
      where: { thread_id: id },
      order: { created_at: 'ASC' },
    });

    const lines: string[] = [];

    // Header
    lines.push(`# ${thread.title ?? 'Untitled Thread'}`);
    lines.push('');
    if (thread.workspace?.name) {
      lines.push(
        `**Workspace:** ${thread.workspace.name} (\`${thread.workspace.working_directory}\`)`,
      );
    }
    lines.push(
      `**Created:** ${thread.created_at
        .toISOString()
        .replace('T', ' ')
        .replace(/\.\d{3}Z$/, ' UTC')}`,
    );
    lines.push('');
    lines.push('---');
    lines.push('');

    for (const msg of messages) {
      if (msg.role === 'system') continue;

      const timestamp = msg.created_at
        .toISOString()
        .replace('T', ' ')
        .replace(/\.\d{3}Z$/, ' UTC');
      const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';

      lines.push(`## ${roleLabel}`);
      lines.push(`*${timestamp}*`);
      if (msg.role === 'assistant' && msg.model) {
        lines.push(`*Model: ${msg.model}*`);
      }
      lines.push('');

      // Parse metadata events for assistant messages with rich content
      if (msg.role === 'assistant' && msg.metadata) {
        try {
          const meta = JSON.parse(msg.metadata);
          if (meta.events && Array.isArray(meta.events)) {
            for (const event of meta.events) {
              switch (event.type) {
                case 'thinking':
                  lines.push('<details>');
                  lines.push('<summary>Thinking</summary>');
                  lines.push('');
                  lines.push(event.content ?? '');
                  lines.push('</details>');
                  lines.push('');
                  break;
                case 'text':
                  lines.push(event.content ?? '');
                  lines.push('');
                  break;
                case 'tool_call':
                  lines.push(
                    `**Tool: ${event.tool ?? 'unknown'}**${event.file ? ` — \`${event.file}\`` : ''}`,
                  );
                  if (event.content) {
                    lines.push('```');
                    lines.push(event.content);
                    lines.push('```');
                  }
                  lines.push('');
                  break;
                case 'tool_result':
                  lines.push('**Result:**');
                  if (event.content) {
                    lines.push('```');
                    lines.push(event.content);
                    lines.push('```');
                  }
                  lines.push('');
                  break;
                case 'result':
                  if (event.metadata) {
                    const parts: string[] = [];
                    if (event.metadata.tokens_used)
                      parts.push(
                        `${event.metadata.tokens_used.toLocaleString()} tokens`,
                      );
                    if (event.metadata.duration_ms)
                      parts.push(
                        `${(event.metadata.duration_ms / 1000).toFixed(1)}s`,
                      );
                    if (event.metadata.total_cost_usd)
                      parts.push(
                        `$${event.metadata.total_cost_usd.toFixed(4)}`,
                      );
                    if (parts.length > 0) {
                      lines.push(`*${parts.join(' · ')}*`);
                      lines.push('');
                    }
                  }
                  break;
              }
            }
          } else {
            // Metadata without events array — just use content
            if (msg.content) {
              lines.push(msg.content);
              lines.push('');
            }
          }
        } catch {
          // Invalid JSON metadata — fall back to content
          if (msg.content) {
            lines.push(msg.content);
            lines.push('');
          }
        }
      } else if (msg.content) {
        lines.push(msg.content);
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  async bulk(
    threadIds: string[],
    action: 'archive' | 'unarchive' | 'delete',
    userId: string,
  ): Promise<number> {
    // Verify all threads belong to the user via their machines
    const threads = await this.threadRepository
      .createQueryBuilder('thread')
      .innerJoin('thread.machine', 'machine')
      .where('thread.id IN (:...threadIds)', { threadIds })
      .andWhere('machine.user_id = :userId', { userId })
      .andWhere('machine.deleted_at IS NULL')
      .getMany();

    if (threads.length === 0) return 0;
    const validIds = threads.map((t) => t.id);

    if (action === 'delete') {
      await this.messageRepository
        .createQueryBuilder()
        .delete()
        .where('thread_id IN (:...ids)', { ids: validIds })
        .execute();
      await this.threadRepository
        .createQueryBuilder()
        .delete()
        .where('id IN (:...ids)', { ids: validIds })
        .execute();
    } else {
      const status = action === 'archive' ? 'archived' : 'active';
      await this.threadRepository
        .createQueryBuilder()
        .update()
        .set({ status })
        .where('id IN (:...ids)', { ids: validIds })
        .execute();
    }

    return validIds.length;
  }

  async fork(
    id: string,
    userId: string,
    afterMessageId: string,
  ): Promise<Thread> {
    const thread = await this.findOne(id, userId);

    // Fetch all messages in chronological order, then slice up to the cutoff
    const allMessages = await this.messageRepository.find({
      where: { thread_id: id },
      order: { created_at: 'ASC', id: 'ASC' },
    });

    const cutoffIndex = allMessages.findIndex((m) => m.id === afterMessageId);
    if (cutoffIndex === -1) throw new NotFoundException('Message not found');

    const messages = allMessages.slice(0, cutoffIndex + 1);

    // Create new thread with same machine + workspace
    const title = thread.title ? `${thread.title} (fork)` : 'Forked thread';
    const newThread = this.threadRepository.create({
      machine_id: thread.machine_id,
      workspace_id: thread.workspace_id,
      title,
    });
    await this.threadRepository.save(newThread);

    // Copy messages to the new thread
    for (const msg of messages) {
      const copy = this.messageRepository.create({
        thread_id: newThread.id,
        role: msg.role,
        content: msg.content,
        model: msg.model,
        status:
          msg.status === 'queued' || msg.status === 'running'
            ? 'cancelled'
            : msg.status,
        metadata: msg.metadata,
        started_at: msg.started_at,
        completed_at: msg.completed_at,
      });
      await this.messageRepository.save(copy);
    }

    // Re-fetch with relations for the response
    return this.findOne(newThread.id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const thread = await this.findOne(id, userId);
    await this.messageRepository.delete({ thread_id: id });
    await this.threadRepository.remove(thread);
  }
}
