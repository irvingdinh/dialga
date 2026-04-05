import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';

import { CurrentUser } from '../core/decorators/current-user.decorator.js';
import type { User } from '../core/entities/index.js';
import { AuthGuard } from '../core/guards/auth.guard.js';
import { WorkspacesService } from './workspaces.service.js';

class CreateWorkspaceDto {
  @IsString()
  name: string;

  @IsString()
  working_directory: string;

  @IsString()
  @IsOptional()
  custom_instruction?: string;

  @IsString()
  @IsOptional()
  agent?: string;

  @IsString()
  @IsOptional()
  model?: string;
}

class UpdateWorkspaceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  working_directory?: string;

  @IsString()
  @IsOptional()
  custom_instruction?: string;

  @IsString()
  @IsOptional()
  agent?: string;

  @IsString()
  @IsOptional()
  model?: string;
}

@Controller('api')
@UseGuards(AuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get('machines/:machineId/workspaces')
  async list(@CurrentUser() user: User, @Param('machineId') machineId: string) {
    const workspaces = await this.workspacesService.list(machineId, user.id);
    return workspaces.map((w) => ({
      id: w.id,
      machine_id: w.machine_id,
      name: w.name,
      working_directory: w.working_directory,
      custom_instruction: w.custom_instruction,
      agent: w.agent,
      model: w.model,
      created_at: w.created_at,
    }));
  }

  @Post('machines/:machineId/workspaces')
  async create(
    @CurrentUser() user: User,
    @Param('machineId') machineId: string,
    @Body() dto: CreateWorkspaceDto,
  ) {
    const w = await this.workspacesService.create(machineId, user.id, dto);
    return {
      id: w.id,
      machine_id: w.machine_id,
      name: w.name,
      working_directory: w.working_directory,
      custom_instruction: w.custom_instruction,
      agent: w.agent,
      model: w.model,
      created_at: w.created_at,
    };
  }

  @Patch('workspaces/:id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    const w = await this.workspacesService.update(id, user.id, dto);
    return {
      id: w.id,
      machine_id: w.machine_id,
      name: w.name,
      working_directory: w.working_directory,
      custom_instruction: w.custom_instruction,
      agent: w.agent,
      model: w.model,
    };
  }

  @Delete('workspaces/:id')
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.workspacesService.remove(id, user.id);
    return { success: true };
  }
}
