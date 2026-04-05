import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { execFile } from 'child_process';
import { arch, platform, release } from 'os';
import { promisify } from 'util';

import { WebSocketService } from '../websocket/websocket.service';

const execFileAsync = promisify(execFile);

export interface AgentInfo {
  available: boolean;
  version?: string;
  error?: string;
}

export interface HealthReport {
  agents: {
    claude: AgentInfo;
    codex: AgentInfo;
  };
  running_tasks: string[];
  os: string;
  os_version: string;
  arch: string;
  node_version: string;
}

@Injectable()
export class HealthCheckService implements OnModuleInit {
  private readonly logger = new Logger(HealthCheckService.name);
  private report: HealthReport | null = null;

  constructor(private readonly wsService: WebSocketService) {}

  async onModuleInit() {
    await this.runChecks();
  }

  @OnEvent('ws.connected')
  async onConnected() {
    await this.runChecks();
    this.sendReport();
  }

  async runChecks(): Promise<HealthReport> {
    const [claude, codex] = await Promise.all([
      this.checkAgent('claude', ['--version']),
      this.checkAgent('codex', ['--version']),
    ]);

    this.report = {
      agents: { claude, codex },
      running_tasks: [],
      os: platform(),
      os_version: release(),
      arch: arch(),
      node_version: process.version,
    };

    this.logger.log(
      `Health: claude=${claude.available ? claude.version : 'N/A'}, codex=${codex.available ? codex.version : 'N/A'}`,
    );

    return this.report;
  }

  private async checkAgent(
    command: string,
    args: string[],
  ): Promise<AgentInfo> {
    try {
      const { stdout } = await execFileAsync(command, args, {
        timeout: 10_000,
      });
      return { available: true, version: stdout.trim().split('\n')[0] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        available: false,
        error: message.includes('ENOENT') ? 'not installed' : message,
      };
    }
  }

  sendReport(runningTasks: string[] = []): void {
    if (!this.report) return;
    this.report.running_tasks = runningTasks;
    this.wsService.send('health:report', this.report);
  }

  getReport(): HealthReport | null {
    return this.report;
  }

  isAgentAvailable(agent: string): boolean {
    if (!this.report) return false;
    if (agent === 'claude') return this.report.agents.claude.available;
    if (agent === 'codex') return this.report.agents.codex.available;
    return false;
  }
}
