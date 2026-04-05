import crypto from 'node:crypto';

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { Machine, User } from '../core/entities/index.js';

const DEV_TOKEN = 'dev-test-token';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Machine)
    private readonly machineRepository: Repository<Machine>,
  ) {}

  async onModuleInit() {
    await this.seedUser();
    await this.seedMachine();
  }

  private async seedUser() {
    const existing = await this.userRepository.findOne({
      where: { email: 'john.doe@example.com' },
    });
    if (existing) {
      this.logger.log('Seed user already exists');
      return;
    }

    const user = this.userRepository.create({
      email: 'john.doe@example.com',
      password_hash: await bcrypt.hash('password', 10),
      name: 'John Doe',
    });
    await this.userRepository.save(user);
    this.logger.log('Seed user created: john.doe@example.com / password');
  }

  private async seedMachine() {
    const user = await this.userRepository.findOne({
      where: { email: 'john.doe@example.com' },
    });
    if (!user) return;

    const tokenHash = crypto
      .createHash('sha256')
      .update(DEV_TOKEN)
      .digest('hex');
    const existing = await this.machineRepository.findOne({
      where: { token_hash: tokenHash },
    });
    if (existing) {
      this.logger.log('Seed machine already exists');
      return;
    }

    const machine = this.machineRepository.create({
      user_id: user.id,
      name: 'Dev Machine',
      token_hash: tokenHash,
      default_agent: 'claude',
    });
    await this.machineRepository.save(machine);
    this.logger.log('Seed machine created with token: dev-test-token');
  }
}
