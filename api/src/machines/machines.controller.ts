import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';

import { CurrentUser } from '../core/decorators/current-user.decorator.js';
import type { User } from '../core/entities/index.js';
import { AuthGuard } from '../core/guards/auth.guard.js';
import { GatewayService } from '../gateway/gateway.service.js';
import { MachinesService } from './machines.service.js';

class CreateMachineDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  default_agent?: string;

  @IsString()
  @IsOptional()
  default_model?: string;
}

class UpdateMachineDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  default_agent?: string;

  @IsString()
  @IsOptional()
  default_model?: string;
}

@Controller('api/machines')
@UseGuards(AuthGuard)
export class MachinesController {
  constructor(
    private readonly machinesService: MachinesService,
    private readonly gatewayService: GatewayService,
  ) {}

  @Get()
  async list(@CurrentUser() user: User) {
    const machines = await this.machinesService.list(user.id);
    return machines.map((m) => ({
      id: m.id,
      name: m.name,
      default_agent: m.default_agent,
      default_model: m.default_model,
      status: m.status,
      health_info: m.health_info,
      last_seen_at: m.last_seen_at,
      created_at: m.created_at,
    }));
  }

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateMachineDto) {
    const { machine, token } = await this.machinesService.create(user.id, dto);
    return {
      id: machine.id,
      name: machine.name,
      token,
    };
  }

  @Get(':id')
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    const m = await this.machinesService.findOne(id, user.id);
    return {
      id: m.id,
      name: m.name,
      default_agent: m.default_agent,
      default_model: m.default_model,
      status: m.status,
      health_info: m.health_info,
      last_seen_at: m.last_seen_at,
      created_at: m.created_at,
    };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateMachineDto,
  ) {
    const m = await this.machinesService.update(id, user.id, dto);
    return {
      id: m.id,
      name: m.name,
      default_agent: m.default_agent,
      default_model: m.default_model,
      status: m.status,
    };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.machinesService.remove(id, user.id);
    return { success: true };
  }

  @Post(':id/regenerate-token')
  async regenerateToken(@CurrentUser() user: User, @Param('id') id: string) {
    return this.machinesService.regenerateToken(id, user.id);
  }

  @Get(':machineId/fs')
  async fsListDirectory(
    @CurrentUser() user: User,
    @Param('machineId') machineId: string,
    @Query('path') dirPath: string,
  ) {
    // Verify ownership
    await this.machinesService.findOne(machineId, user.id);
    return this.gatewayService.fsListDirectory(machineId, dirPath || '/');
  }

  @Post(':machineId/fs/mkdir')
  async fsMkdir(
    @CurrentUser() user: User,
    @Param('machineId') machineId: string,
    @Body() body: { path: string },
  ) {
    await this.machinesService.findOne(machineId, user.id);
    return this.gatewayService.fsMkdir(machineId, body.path);
  }
}
