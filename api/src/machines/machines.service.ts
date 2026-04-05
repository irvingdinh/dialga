import crypto from 'node:crypto';

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Machine, Thread, Workspace } from '../core/entities/index.js';

@Injectable()
export class MachinesService {
  constructor(
    @InjectRepository(Machine)
    private readonly machineRepository: Repository<Machine>,
    @InjectRepository(Thread)
    private readonly threadRepository: Repository<Thread>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
  ) {}

  async list(userId: string): Promise<Machine[]> {
    return this.machineRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async getListCounts(
    machineIds: string[],
  ): Promise<Map<string, { thread_count: number; workspace_count: number }>> {
    const result = new Map<
      string,
      { thread_count: number; workspace_count: number }
    >();
    for (const id of machineIds) {
      result.set(id, { thread_count: 0, workspace_count: 0 });
    }

    if (machineIds.length === 0) return result;

    const threadCounts = await this.threadRepository
      .createQueryBuilder('t')
      .select('t.machine_id', 'machine_id')
      .addSelect('COUNT(*)', 'count')
      .where('t.machine_id IN (:...ids)', { ids: machineIds })
      .groupBy('t.machine_id')
      .getRawMany<{ machine_id: string; count: string }>();

    for (const row of threadCounts) {
      const entry = result.get(row.machine_id);
      if (entry) entry.thread_count = parseInt(row.count, 10);
    }

    const workspaceCounts = await this.workspaceRepository
      .createQueryBuilder('w')
      .select('w.machine_id', 'machine_id')
      .addSelect('COUNT(*)', 'count')
      .where('w.machine_id IN (:...ids)', { ids: machineIds })
      .andWhere('w.deleted_at IS NULL')
      .groupBy('w.machine_id')
      .getRawMany<{ machine_id: string; count: string }>();

    for (const row of workspaceCounts) {
      const entry = result.get(row.machine_id);
      if (entry) entry.workspace_count = parseInt(row.count, 10);
    }

    return result;
  }

  async create(
    userId: string,
    data: { name: string; default_agent?: string; default_model?: string },
  ): Promise<{ machine: Machine; token: string }> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const machine = this.machineRepository.create({
      user_id: userId,
      name: data.name,
      token_hash: tokenHash,
      default_agent: data.default_agent || 'claude',
      default_model: data.default_model || null,
    });
    await this.machineRepository.save(machine);

    return { machine, token: rawToken };
  }

  async findOne(id: string, userId: string): Promise<Machine> {
    const machine = await this.machineRepository.findOne({ where: { id } });
    if (!machine) throw new NotFoundException('Machine not found');
    if (machine.user_id !== userId) throw new ForbiddenException();
    return machine;
  }

  async update(
    id: string,
    userId: string,
    data: { name?: string; default_agent?: string; default_model?: string },
  ): Promise<Machine> {
    const machine = await this.findOne(id, userId);
    if (data.name !== undefined) machine.name = data.name;
    if (data.default_agent !== undefined)
      machine.default_agent = data.default_agent;
    if (data.default_model !== undefined)
      machine.default_model = data.default_model;
    return this.machineRepository.save(machine);
  }

  async remove(id: string, userId: string): Promise<void> {
    const machine = await this.findOne(id, userId);
    await this.machineRepository.softRemove(machine);
  }

  async regenerateToken(
    id: string,
    userId: string,
  ): Promise<{ token: string }> {
    const machine = await this.findOne(id, userId);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    machine.token_hash = tokenHash;
    await this.machineRepository.save(machine);
    return { token: rawToken };
  }
}
