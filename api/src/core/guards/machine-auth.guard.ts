import crypto from 'node:crypto';

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { Machine } from '../entities/index.js';

@Injectable()
export class MachineAuthGuard implements CanActivate {
  constructor(
    @InjectRepository(Machine)
    private readonly machineRepository: Repository<Machine>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing machine token');
    }

    const token = authHeader.slice(7);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const machine = await this.machineRepository.findOne({
      where: { token_hash: tokenHash },
    });

    if (!machine) {
      throw new UnauthorizedException('Invalid machine token');
    }

    (request as Request & { machine: Machine }).machine = machine;
    return true;
  }
}
