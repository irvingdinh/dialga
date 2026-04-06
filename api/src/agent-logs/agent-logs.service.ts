import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AgentLog, Machine } from '../core/entities/index.js';

@Injectable()
export class AgentLogsService {
  constructor(
    @InjectRepository(AgentLog)
    private readonly logRepository: Repository<AgentLog>,
    @InjectRepository(Machine)
    private readonly machineRepository: Repository<Machine>,
  ) {}

  async record(
    machineId: string,
    type: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<AgentLog> {
    const log = this.logRepository.create({
      machine_id: machineId,
      type,
      message,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
    return this.logRepository.save(log);
  }

  async list(
    machineId: string,
    userId: string,
    opts: { limit?: number; before?: string; type?: string },
  ): Promise<{ logs: AgentLog[]; has_more: boolean }> {
    // Verify machine belongs to user
    const machine = await this.machineRepository.findOne({
      where: { id: machineId, user_id: userId },
    });
    if (!machine) return { logs: [], has_more: false };

    const limit = Math.min(opts.limit || 50, 100);

    const qb = this.logRepository
      .createQueryBuilder('log')
      .where('log.machine_id = :machineId', { machineId })
      .orderBy('log.created_at', 'DESC')
      .addOrderBy('log.id', 'DESC');

    if (opts.before) {
      // Cursor-based pagination: get the cursor log to find its created_at
      const cursorLog = await this.logRepository.findOne({
        where: { id: opts.before },
      });
      if (cursorLog) {
        qb.andWhere(
          '(log.created_at < :cursorDate OR (log.created_at = :cursorDate AND log.id < :cursorId))',
          { cursorDate: cursorLog.created_at, cursorId: opts.before },
        );
      }
    }

    if (opts.type) {
      qb.andWhere('log.type = :type', { type: opts.type });
    }

    // Fetch limit+1 to determine has_more
    const logs = await qb.take(limit + 1).getMany();
    const hasMore = logs.length > limit;
    if (hasMore) logs.pop();

    return { logs, has_more: hasMore };
  }
}
