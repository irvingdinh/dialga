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
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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

class GitStageDto {
  @IsString()
  @IsNotEmpty()
  path!: string;

  @IsArray()
  @IsString({ each: true })
  files!: string[];
}

class GitCommitDto {
  @IsString()
  @IsNotEmpty()
  path!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;
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
    const counts = await this.machinesService.getListCounts(
      machines.map((m) => m.id),
    );
    return machines.map((m) => {
      const c = counts.get(m.id);
      return {
        id: m.id,
        name: m.name,
        default_agent: m.default_agent,
        default_model: m.default_model,
        status: m.status,
        health_info: m.health_info,
        last_seen_at: m.last_seen_at,
        created_at: m.created_at,
        thread_count: c?.thread_count ?? 0,
        workspace_count: c?.workspace_count ?? 0,
      };
    });
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

  @Get(':machineId/fs/read')
  async fsReadFile(
    @CurrentUser() user: User,
    @Param('machineId') machineId: string,
    @Query('path') filePath: string,
  ) {
    await this.machinesService.findOne(machineId, user.id);
    return this.gatewayService.fsReadFile(machineId, filePath || '/');
  }

  @Get(':machineId/git/status')
  async gitStatus(
    @CurrentUser() user: User,
    @Param('machineId') machineId: string,
    @Query('path') dirPath: string,
  ) {
    await this.machinesService.findOne(machineId, user.id);
    return this.gatewayService.gitStatus(machineId, dirPath);
  }

  @Get(':machineId/git/diff')
  async gitDiff(
    @CurrentUser() user: User,
    @Param('machineId') machineId: string,
    @Query('path') dirPath: string,
    @Query('file') file?: string,
  ) {
    await this.machinesService.findOne(machineId, user.id);
    return this.gatewayService.gitDiff(machineId, dirPath, file);
  }

  @Get(':machineId/git/log')
  async gitLog(
    @CurrentUser() user: User,
    @Param('machineId') machineId: string,
    @Query('path') dirPath: string,
    @Query('limit') limit?: string,
  ) {
    await this.machinesService.findOne(machineId, user.id);
    return this.gatewayService.gitLog(
      machineId,
      dirPath,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post(':machineId/git/stage')
  async gitStage(
    @CurrentUser() user: User,
    @Param('machineId') machineId: string,
    @Body() dto: GitStageDto,
  ) {
    await this.machinesService.findOne(machineId, user.id);
    return this.gatewayService.gitStage(machineId, dto.path, dto.files);
  }

  @Post(':machineId/git/unstage')
  async gitUnstage(
    @CurrentUser() user: User,
    @Param('machineId') machineId: string,
    @Body() dto: GitStageDto,
  ) {
    await this.machinesService.findOne(machineId, user.id);
    return this.gatewayService.gitUnstage(machineId, dto.path, dto.files);
  }

  @Post(':machineId/git/commit')
  async gitCommit(
    @CurrentUser() user: User,
    @Param('machineId') machineId: string,
    @Body() dto: GitCommitDto,
  ) {
    await this.machinesService.findOne(machineId, user.id);
    return this.gatewayService.gitCommit(machineId, dto.path, dto.message);
  }
}
