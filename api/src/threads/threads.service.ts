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
  ): Promise<Thread[]> {
    await this.verifyMachineOwnership(machineId, userId);
    const where: Record<string, unknown> = { machine_id: machineId };
    if (workspaceId) where.workspace_id = workspaceId;
    return this.threadRepository.find({
      where,
      relations: ['workspace'],
      order: { updated_at: 'DESC' },
    });
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

  async remove(id: string, userId: string): Promise<void> {
    const thread = await this.findOne(id, userId);
    await this.messageRepository.delete({ thread_id: id });
    await this.threadRepository.remove(thread);
  }
}
