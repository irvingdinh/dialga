import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../core/decorators/current-user.decorator.js';
import type { User } from '../core/entities/index.js';
import { AuthGuard } from '../core/guards/auth.guard.js';
import { AgentLogsService } from './agent-logs.service.js';

@Controller('api/machines/:machineId/logs')
@UseGuards(AuthGuard)
export class AgentLogsController {
  constructor(private readonly agentLogsService: AgentLogsService) {}

  @Get()
  async list(
    @Param('machineId') machineId: string,
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('type') type?: string,
  ) {
    const result = await this.agentLogsService.list(machineId, user.id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      before,
      type,
    });
    return result;
  }
}
