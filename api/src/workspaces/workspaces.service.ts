import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Machine, Workspace } from '../core/entities/index.js';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(Machine)
    private readonly machineRepository: Repository<Machine>,
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

  async list(machineId: string, userId: string): Promise<Workspace[]> {
    await this.verifyMachineOwnership(machineId, userId);
    return this.workspaceRepository.find({
      where: { machine_id: machineId },
      order: { created_at: 'DESC' },
    });
  }

  async create(
    machineId: string,
    userId: string,
    data: {
      name: string;
      working_directory: string;
      custom_instruction?: string;
      agent?: string;
      model?: string;
    },
  ): Promise<Workspace> {
    await this.verifyMachineOwnership(machineId, userId);
    const workspace = this.workspaceRepository.create({
      machine_id: machineId,
      name: data.name,
      working_directory: data.working_directory,
      custom_instruction: data.custom_instruction || null,
      agent: data.agent || null,
      model: data.model || null,
    });
    return this.workspaceRepository.save(workspace);
  }

  async update(
    id: string,
    userId: string,
    data: {
      name?: string;
      working_directory?: string;
      custom_instruction?: string;
      agent?: string;
      model?: string;
    },
  ): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id },
      relations: ['machine'],
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    if (workspace.machine.user_id !== userId) throw new ForbiddenException();

    if (data.name !== undefined) workspace.name = data.name;
    if (data.working_directory !== undefined)
      workspace.working_directory = data.working_directory;
    if (data.custom_instruction !== undefined)
      workspace.custom_instruction = data.custom_instruction || null;
    if (data.agent !== undefined) workspace.agent = data.agent || null;
    if (data.model !== undefined) workspace.model = data.model || null;

    return this.workspaceRepository.save(workspace);
  }

  async remove(id: string, userId: string): Promise<void> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id },
      relations: ['machine'],
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    if (workspace.machine.user_id !== userId) throw new ForbiddenException();
    await this.workspaceRepository.softRemove(workspace);
  }
}
