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

    qb.orderBy('thread.updated_at', 'DESC');

    return qb.getMany();
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
