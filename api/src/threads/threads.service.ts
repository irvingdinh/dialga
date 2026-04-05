import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Machine, Message, Thread } from '../core/entities/index.js';

@Injectable()
export class ThreadsService {
  constructor(
    @InjectRepository(Thread)
    private readonly threadRepository: Repository<Thread>,
    @InjectRepository(Machine)
    private readonly machineRepository: Repository<Machine>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
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

    // Sort: updated (default), created, title, created_asc
    switch (sort) {
      case 'created':
        qb.orderBy('thread.created_at', 'DESC');
        break;
      case 'created_asc':
        qb.orderBy('thread.created_at', 'ASC');
        break;
      case 'title':
        qb.orderBy('thread.title', 'ASC');
        break;
      default:
        qb.orderBy('thread.updated_at', 'DESC');
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
    data: { title?: string; status?: 'active' | 'archived' },
  ): Promise<Thread> {
    const thread = await this.findOne(id, userId);
    if (data.title !== undefined) thread.title = data.title;
    if (data.status !== undefined) thread.status = data.status;
    return this.threadRepository.save(thread);
  }

  async remove(id: string, userId: string): Promise<void> {
    const thread = await this.findOne(id, userId);
    await this.messageRepository.delete({ thread_id: id });
    await this.threadRepository.remove(thread);
  }
}
