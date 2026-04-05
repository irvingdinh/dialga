import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { type ChildProcess } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createInterface } from 'readline';
import { Repository } from 'typeorm';

import type { AgentAdapter, OutputEvent } from '../adapters/adapter.interface';
import { ClaudeAdapter } from '../adapters/claude.adapter';
import { CodexAdapter } from '../adapters/codex.adapter';
import { AppConfig } from '../core/config/config';
import { TaskRecord } from '../core/entities/task-record.entity';
import { HealthCheckService } from '../health/health.service';
import { WebSocketService } from '../websocket/websocket.service';

interface TaskStartPayload {
  message_id: string;
  thread_id: string;
  prompt: string;
  agent: string;
  model: string | null;
  working_directory: string | null;
  custom_instruction: string | null;
}

interface RunningTask {
  messageId: string;
  threadId: string;
  workingDirectory: string;
  process: ChildProcess;
  adapter: AgentAdapter;
  textContent: string[];
  allEvents: OutputEvent[];
  timeoutTimer: NodeJS.Timeout | null;
  timedOut: boolean;
}

interface QueuedTask {
  payload: TaskStartPayload;
}

@Injectable()
export class TaskService implements OnModuleInit {
  private readonly logger = new Logger(TaskService.name);
  private readonly runningTasks = new Map<string, RunningTask>();
  private readonly workspaceQueues = new Map<string, QueuedTask[]>();
  private readonly workspaceRunning = new Set<string>();
  private readonly maxConcurrency: number = 3;
  private readonly taskTimeoutMs: number;
  private readonly config: AppConfig;
  private interruptedTaskIds: string[] = [];

  constructor(
    private readonly wsService: WebSocketService,
    private readonly healthService: HealthCheckService,
    private readonly claudeAdapter: ClaudeAdapter,
    private readonly codexAdapter: CodexAdapter,
    @InjectRepository(TaskRecord)
    private readonly taskRecordRepository: Repository<TaskRecord>,
    configService: ConfigService,
  ) {
    this.config = configService.get<AppConfig>('root')!;
    this.taskTimeoutMs = parseInt(process.env.TASK_TIMEOUT_MS || '1800000', 10); // Default: 30 minutes
    this.logger.log(`Task timeout: ${this.formatDuration(this.taskTimeoutMs)}`);
  }

  async onModuleInit() {
    await this.recoverInterruptedTasks();
    // If WebSocket connected before onModuleInit (race with startup), report now
    if (this.interruptedTaskIds.length > 0 && this.wsService.isConnected()) {
      this.reportInterruptedTasks();
    }
  }

  private formatDuration(ms: number): string {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.round(seconds / 60)}m`;
  }

  private async recoverInterruptedTasks(): Promise<void> {
    const runningRecords = await this.taskRecordRepository.find({
      where: { status: 'running' },
    });

    if (runningRecords.length === 0) return;

    this.logger.warn(
      `Found ${runningRecords.length} interrupted task(s) from previous session`,
    );

    for (const record of runningRecords) {
      record.status = 'interrupted';
      record.completed_at = new Date();
      await this.taskRecordRepository.save(record);
      this.interruptedTaskIds.push(record.message_id);
      this.logger.warn(`Marked task ${record.message_id} as interrupted`);
    }
  }

  @OnEvent('ws.connected')
  onConnected(): void {
    this.reportInterruptedTasks();
  }

  private reportInterruptedTasks(): void {
    if (this.interruptedTaskIds.length === 0) return;

    this.logger.log(
      `Reporting ${this.interruptedTaskIds.length} interrupted task(s) to API`,
    );

    for (const messageId of this.interruptedTaskIds) {
      this.wsService.send('task:complete', {
        message_id: messageId,
        status: 'error',
        summary:
          'Task interrupted — agent crashed or restarted while this task was running',
      });
    }

    this.interruptedTaskIds = [];
  }

  @OnEvent('ws.task:start')
  async onTaskStart(payload: TaskStartPayload): Promise<void> {
    this.logger.log(
      `Received task:start — message=${payload.message_id} agent=${payload.agent}`,
    );

    const workDir = this.resolveWorkingDirectory(payload);

    // Serial per workspace: queue if workspace is busy
    if (this.workspaceRunning.has(workDir)) {
      this.logger.log(
        `Workspace busy (${workDir}), queuing task ${payload.message_id}`,
      );
      const queue = this.workspaceQueues.get(workDir) || [];
      queue.push({ payload });
      this.workspaceQueues.set(workDir, queue);
      return;
    }

    // Check global concurrency
    if (this.runningTasks.size >= this.maxConcurrency) {
      this.logger.log(
        `Max concurrency (${this.maxConcurrency}) reached, queuing task ${payload.message_id}`,
      );
      const queue = this.workspaceQueues.get(workDir) || [];
      queue.push({ payload });
      this.workspaceQueues.set(workDir, queue);
      return;
    }

    await this.executeTask(payload, workDir);
  }

  @OnEvent('ws.task:cancel')
  onTaskCancel(data: { message_id: string }): void {
    // Check if task is running — kill the process
    const task = this.runningTasks.get(data.message_id);
    if (task) {
      this.logger.log(`Cancelling running task: ${data.message_id}`);
      if (task.timeoutTimer) clearTimeout(task.timeoutTimer);
      task.adapter.cancel(task.process);
      return;
    }

    // Check if task is queued — remove from workspace queue
    for (const [workDir, queue] of this.workspaceQueues) {
      const idx = queue.findIndex(
        (q) => q.payload.message_id === data.message_id,
      );
      if (idx !== -1) {
        queue.splice(idx, 1);
        if (queue.length === 0) this.workspaceQueues.delete(workDir);
        this.logger.log(`Cancelled queued task: ${data.message_id}`);
        this.wsService.send('task:complete', {
          message_id: data.message_id,
          status: 'cancelled',
          summary: 'Task cancelled by user',
        });
        return;
      }
    }

    this.logger.warn(`Cancel requested for unknown task: ${data.message_id}`);
  }

  private async executeTask(
    payload: TaskStartPayload,
    workDir: string,
  ): Promise<void> {
    const adapter = this.getAdapter(payload.agent);
    if (!adapter) {
      this.logger.error(`Agent "${payload.agent}" not available`);
      this.wsService.send('task:complete', {
        message_id: payload.message_id,
        status: 'error',
        summary: `Agent "${payload.agent}" is not available on this machine`,
      });
      return;
    }

    if (!this.healthService.isAgentAvailable(payload.agent)) {
      this.logger.error(`Agent "${payload.agent}" not installed`);
      this.wsService.send('task:complete', {
        message_id: payload.message_id,
        status: 'error',
        summary: `Agent "${payload.agent}" is not installed on this machine`,
      });
      return;
    }

    this.workspaceRunning.add(workDir);

    // Fetch thread context and write to temp file
    const contextFilePath = await this.writeContextFile(payload.thread_id);

    // Ensure working directory exists
    mkdirSync(workDir, { recursive: true });

    const childProcess = adapter.startTask({
      prompt: payload.prompt,
      model: payload.model,
      workingDirectory: workDir,
      contextFilePath,
      customInstruction: payload.custom_instruction,
    });

    const task: RunningTask = {
      messageId: payload.message_id,
      threadId: payload.thread_id,
      workingDirectory: workDir,
      process: childProcess,
      adapter,
      textContent: [],
      allEvents: [],
      timeoutTimer: null,
      timedOut: false,
    };

    this.runningTasks.set(payload.message_id, task);

    // Notify API that this task is now actually running (not just queued)
    this.wsService.send('task:started', {
      message_id: payload.message_id,
    });

    // Persist to SQLite for crash recovery
    await this.taskRecordRepository.save({
      message_id: payload.message_id,
      thread_id: payload.thread_id,
      working_directory: workDir,
      status: 'running' as const,
      started_at: new Date(),
      completed_at: null,
    });

    // Set up task timeout
    task.timeoutTimer = setTimeout(() => {
      this.logger.warn(
        `Task ${payload.message_id} timed out after ${this.formatDuration(this.taskTimeoutMs)}`,
      );
      task.timedOut = true;
      task.process.kill('SIGKILL');
    }, this.taskTimeoutMs);

    // Stream stdout line by line
    if (childProcess.stdout) {
      const rl = createInterface({ input: childProcess.stdout });
      rl.on('line', (line: string) => {
        const event = adapter.parseOutput(line);
        if (event) {
          task.allEvents.push(event);
          if (event.type === 'text') {
            task.textContent.push(event.content);
          }
          this.emitOutput(payload.message_id, event);
        }
      });
    }

    // Capture stderr
    let stderr = '';
    if (childProcess.stderr) {
      childProcess.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
    }

    // Handle process exit
    childProcess.on('close', (code: number | null, signal: string | null) => {
      const completedTask = this.runningTasks.get(payload.message_id);
      const assembledContent = completedTask?.textContent.join('') || '';

      // Clear timeout timer
      if (completedTask?.timeoutTimer) {
        clearTimeout(completedTask.timeoutTimer);
      }

      const wasTimedOut = completedTask?.timedOut ?? false;

      this.runningTasks.delete(payload.message_id);
      this.workspaceRunning.delete(workDir);

      let status: 'completed' | 'error' | 'cancelled' | 'timed_out' =
        'completed';
      let summary = assembledContent;

      if (wasTimedOut) {
        status = 'timed_out';
        summary =
          assembledContent ||
          `Task timed out after ${this.formatDuration(this.taskTimeoutMs)}`;
      } else if (signal === 'SIGTERM') {
        status = 'cancelled';
        summary = assembledContent || 'Task cancelled by user';
      } else if (code !== 0) {
        status = 'error';
        summary = stderr.trim() || `Process exited with code ${code}`;
      }

      // Update SQLite record
      this.taskRecordRepository
        .update(payload.message_id, {
          status,
          completed_at: new Date(),
        })
        .catch((err: Error) =>
          this.logger.warn(`Failed to update task record: ${err.message}`),
        );

      this.wsService.send('task:complete', {
        message_id: payload.message_id,
        status,
        summary: summary || undefined,
        metadata: {
          exit_code: code,
          signal,
          events: completedTask?.allEvents || [],
        },
      });

      this.logger.log(
        `Task ${payload.message_id} finished: status=${status} code=${code}`,
      );

      // Process next queued task for this workspace
      this.processNextInQueue(workDir);
    });

    childProcess.on('error', (err: Error) => {
      const failedTask = this.runningTasks.get(payload.message_id);
      if (failedTask?.timeoutTimer) clearTimeout(failedTask.timeoutTimer);

      this.runningTasks.delete(payload.message_id);
      this.workspaceRunning.delete(workDir);

      // Update SQLite record
      this.taskRecordRepository
        .update(payload.message_id, {
          status: 'error' as const,
          completed_at: new Date(),
        })
        .catch((e: Error) =>
          this.logger.warn(`Failed to update task record: ${e.message}`),
        );

      this.wsService.send('task:complete', {
        message_id: payload.message_id,
        status: 'error',
        summary: `Failed to spawn agent: ${err.message}`,
      });

      this.processNextInQueue(workDir);
    });
  }

  private emitOutput(messageId: string, event: OutputEvent): void {
    this.wsService.send('task:output', {
      message_id: messageId,
      type: event.type,
      content: event.content,
      ...(event.metadata || {}),
    });
  }

  private processNextInQueue(workDir: string): void {
    const queue = this.workspaceQueues.get(workDir);
    if (!queue || queue.length === 0) return;

    const next = queue.shift()!;
    if (queue.length === 0) {
      this.workspaceQueues.delete(workDir);
    }

    this.logger.log(`Processing next queued task: ${next.payload.message_id}`);
    void this.executeTask(next.payload, workDir);
  }

  private async writeContextFile(threadId: string): Promise<string> {
    const contextDir = join(tmpdir(), 'dialga', 'threads');
    mkdirSync(contextDir, { recursive: true });
    const contextFilePath = join(contextDir, `${threadId}.jsonl`);

    try {
      const { server, token } = this.config.agent;
      const url = `${server}/api/agent/threads/${threadId}/messages.jsonl`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const body = await response.text();
        writeFileSync(contextFilePath, body, 'utf-8');
        this.logger.debug(
          `Wrote context file: ${contextFilePath} (${body.length} bytes)`,
        );
      } else {
        this.logger.warn(`Failed to fetch thread context: ${response.status}`);
        writeFileSync(contextFilePath, '', 'utf-8');
      }
    } catch (err) {
      this.logger.warn(`Error fetching thread context: ${err}`);
      writeFileSync(contextFilePath, '', 'utf-8');
    }

    return contextFilePath;
  }

  private resolveWorkingDirectory(payload: TaskStartPayload): string {
    if (payload.working_directory) {
      return payload.working_directory;
    }
    // Temp folder for threads without a workspace
    return join(tmpdir(), 'dialga', 'workspaces', payload.thread_id);
  }

  private getAdapter(agent: string): AgentAdapter | null {
    if (agent === 'claude') return this.claudeAdapter;
    if (agent === 'codex') return this.codexAdapter;
    return null;
  }

  getRunningTaskIds(): string[] {
    return Array.from(this.runningTasks.keys());
  }
}
