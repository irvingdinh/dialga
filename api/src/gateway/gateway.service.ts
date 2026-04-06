import crypto from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { WebSocket } from 'ws';

import { AgentLogsService } from '../agent-logs/agent-logs.service.js';
import { Machine, Message, Thread } from '../core/entities/index.js';
import { StreamingService } from '../streaming/streaming.service.js';

interface ConnectedMachine {
  machineId: string;
  socket: WebSocket;
  lastHeartbeat: number;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

interface EventAccumulatorEntry {
  events: Array<{ type: string; content: string }>;
  textContent: string[];
  threadId: string;
  lastFlush: number;
  flushTimer: NodeJS.Timeout | null;
}

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);
  private readonly connections = new Map<WebSocket, ConnectedMachine>();
  private readonly machineToSocket = new Map<string, WebSocket>();
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private readonly eventAccumulator = new Map<string, EventAccumulatorEntry>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(Machine)
    private readonly machineRepository: Repository<Machine>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Thread)
    private readonly threadRepository: Repository<Thread>,
    private readonly streamingService: StreamingService,
    private readonly agentLogsService: AgentLogsService,
  ) {}

  onModuleInit() {
    // Check for stale connections every 30s
    this.heartbeatInterval = setInterval(() => {
      void this.checkHeartbeats();
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    // Clear all accumulator timers
    for (const [, entry] of this.eventAccumulator) {
      if (entry.flushTimer) clearTimeout(entry.flushTimer);
    }
    this.eventAccumulator.clear();
  }

  async authenticateToken(token: string): Promise<Machine | null> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const machine = await this.machineRepository.findOne({
      where: { token_hash: tokenHash },
    });
    return machine || null;
  }

  async registerConnection(
    machineId: string,
    socket: WebSocket,
  ): Promise<void> {
    // Close any existing connection for this machine
    const existingSocket = this.machineToSocket.get(machineId);
    if (existingSocket && existingSocket !== socket) {
      this.logger.warn(`Machine ${machineId} reconnecting, closing old socket`);
      existingSocket.close(1000, 'Superseded by new connection');
      this.connections.delete(existingSocket);
    }

    this.connections.set(socket, {
      machineId,
      socket,
      lastHeartbeat: Date.now(),
    });
    this.machineToSocket.set(machineId, socket);

    const now = new Date();
    await this.machineRepository.update(machineId, {
      status: 'online',
      last_seen_at: now,
    });

    this.logger.log(`Machine ${machineId} connected`);

    // Broadcast machine status change via SSE
    await this.streamingService.publishMachineStatus(machineId, 'online', now);

    // Record agent log
    void this.agentLogsService.record(
      machineId,
      'connected',
      'Agent connected',
    );
  }

  async handleDisconnect(socket: WebSocket): Promise<void> {
    const conn = this.connections.get(socket);
    if (!conn) return;

    this.connections.delete(socket);
    this.machineToSocket.delete(conn.machineId);

    const now = new Date();
    await this.machineRepository.update(conn.machineId, {
      status: 'offline',
      last_seen_at: now,
    });

    this.logger.log(`Machine ${conn.machineId} disconnected`);

    // Broadcast machine status change via SSE
    await this.streamingService.publishMachineStatus(
      conn.machineId,
      'offline',
      now,
    );

    // Record agent log
    void this.agentLogsService.record(
      conn.machineId,
      'disconnected',
      'Agent disconnected',
    );
  }

  handleHeartbeat(socket: WebSocket): void {
    const conn = this.connections.get(socket);
    if (conn) {
      conn.lastHeartbeat = Date.now();
      this.machineRepository.update(conn.machineId, {
        last_seen_at: new Date(),
      });
    }
  }

  private async checkHeartbeats(): Promise<void> {
    const now = Date.now();
    const staleThreshold = 90_000; // 3 missed pings (30s each)

    for (const [socket, conn] of this.connections) {
      if (now - conn.lastHeartbeat > staleThreshold) {
        this.logger.warn(
          `Machine ${conn.machineId} missed heartbeats, marking offline`,
        );
        socket.close(1000, 'Heartbeat timeout');
        await this.handleDisconnect(socket);
      }
    }
  }

  getMachineIdForSocket(socket: WebSocket): string | undefined {
    return this.connections.get(socket)?.machineId;
  }

  getSocketForMachine(machineId: string): WebSocket | undefined {
    return this.machineToSocket.get(machineId);
  }

  isMachineOnline(machineId: string): boolean {
    return this.machineToSocket.has(machineId);
  }

  sendToMachine(machineId: string, event: string, data: unknown): boolean {
    const socket = this.machineToSocket.get(machineId);
    if (!socket || socket.readyState !== 1) return false;
    socket.send(JSON.stringify({ event, data }));
    return true;
  }

  async dispatchTask(
    machineId: string,
    message: Message,
    thread: Thread,
  ): Promise<boolean> {
    // Resolve agent and model from workspace → machine defaults
    const machine = await this.machineRepository.findOne({
      where: { id: machineId },
    });
    if (!machine) return false;

    let agent = machine.default_agent;
    let model = machine.default_model;
    let workingDirectory: string | null = null;
    let customInstruction: string | null = null;

    if (thread.workspace) {
      if (thread.workspace.agent) agent = thread.workspace.agent;
      if (thread.workspace.model) model = thread.workspace.model;
      workingDirectory = thread.workspace.working_directory;
      customInstruction = thread.workspace.custom_instruction;
    }

    // Per-message model override
    if (message.model) model = message.model;

    const taskData = {
      message_id: message.id,
      thread_id: thread.id,
      prompt: '', // Will be set by the caller who knows the user message content
      agent,
      model,
      working_directory: workingDirectory,
      custom_instruction: customInstruction,
    };

    return this.sendToMachine(machineId, 'task:start', taskData);
  }

  async dispatchTaskWithPrompt(
    machineId: string,
    assistantMessage: Message,
    thread: Thread,
    prompt: string,
  ): Promise<boolean> {
    const machine = await this.machineRepository.findOne({
      where: { id: machineId },
    });
    if (!machine) return false;

    let agent = machine.default_agent;
    let model = machine.default_model;
    let workingDirectory: string | null = null;
    let customInstruction: string | null = null;

    if (thread.workspace) {
      if (thread.workspace.agent) agent = thread.workspace.agent;
      if (thread.workspace.model) model = thread.workspace.model;
      workingDirectory = thread.workspace.working_directory;
      customInstruction = thread.workspace.custom_instruction;
    }

    // Per-message model override
    if (assistantMessage.model) model = assistantMessage.model;

    const taskData = {
      message_id: assistantMessage.id,
      thread_id: thread.id,
      prompt,
      agent,
      model,
      working_directory: workingDirectory,
      custom_instruction: customInstruction,
    };

    // Message stays "queued" until the agent sends task:started
    // (agent may queue the task internally if workspace is busy)
    return this.sendToMachine(machineId, 'task:start', taskData);
  }

  async handleTaskStarted(
    machineId: string,
    data: { message_id: string },
  ): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: data.message_id },
      relations: ['thread'],
    });
    if (!message || message.thread.machine_id !== machineId) return;

    // Only transition from queued → running
    if (message.status !== 'queued') {
      // If message was already cancelled, tell agent to stop
      if (message.status === 'cancelled') {
        this.sendToMachine(machineId, 'task:cancel', {
          message_id: data.message_id,
        });
      }
      return;
    }

    message.status = 'running';
    message.started_at = new Date();
    await this.messageRepository.save(message);

    await this.streamingService.publishMessageStatus(
      message.thread_id,
      message.id,
      'running',
    );

    // Record agent log
    void this.agentLogsService.record(
      machineId,
      'task_started',
      `Task started: ${data.message_id}`,
      { message_id: data.message_id, thread_id: message.thread_id },
    );
  }

  async handleTaskOutput(
    machineId: string,
    data: {
      message_id: string;
      type: string;
      content: string;
    },
  ): Promise<void> {
    // Verify message belongs to this machine
    const message = await this.messageRepository.findOne({
      where: { id: data.message_id },
      relations: ['thread'],
    });
    if (!message || message.thread.machine_id !== machineId) return;

    // Accumulate event for periodic persistence
    this.accumulateEvent(
      data.message_id,
      message.thread_id,
      data.type,
      data.content,
    );

    // Fan out via Redis Pub/Sub → SSE
    await this.streamingService.publishMessageDelta(
      message.thread_id,
      data.message_id,
      data.type,
      data.content,
    );
  }

  private accumulateEvent(
    messageId: string,
    threadId: string,
    type: string,
    content: string,
  ): void {
    let entry = this.eventAccumulator.get(messageId);
    if (!entry) {
      entry = {
        events: [],
        textContent: [],
        threadId,
        lastFlush: Date.now(),
        flushTimer: null,
      };
      this.eventAccumulator.set(messageId, entry);
    }

    entry.events.push({ type, content });
    if (type === 'text') {
      entry.textContent.push(content);
    }

    // Schedule a flush if not already scheduled (every 5s)
    if (!entry.flushTimer) {
      entry.flushTimer = setTimeout(() => {
        void this.flushAccumulatedEvents(messageId);
      }, 5000);
    }
  }

  private async flushAccumulatedEvents(messageId: string): Promise<void> {
    const entry = this.eventAccumulator.get(messageId);
    if (!entry || entry.events.length === 0) return;

    entry.lastFlush = Date.now();
    entry.flushTimer = null;

    // Snapshot current state for persistence
    const events = [...entry.events];
    const content = entry.textContent.join('');

    try {
      await this.messageRepository.update(messageId, {
        content: content || undefined,
        metadata: JSON.stringify({ events, partial: true }),
      });
    } catch (err) {
      this.logger.warn(
        `Failed to flush streaming state for ${messageId}: ${err}`,
      );
    }

    // Schedule next flush if still accumulating
    if (this.eventAccumulator.has(messageId)) {
      entry.flushTimer = setTimeout(() => {
        void this.flushAccumulatedEvents(messageId);
      }, 5000);
    }
  }

  private clearAccumulator(messageId: string): void {
    const entry = this.eventAccumulator.get(messageId);
    if (entry?.flushTimer) {
      clearTimeout(entry.flushTimer);
    }
    this.eventAccumulator.delete(messageId);
  }

  async handleTaskComplete(
    machineId: string,
    data: {
      message_id: string;
      status: 'completed' | 'error' | 'cancelled' | 'timed_out';
      summary?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    // Clear the in-memory accumulator (no more partial flushes needed)
    this.clearAccumulator(data.message_id);

    const message = await this.messageRepository.findOne({
      where: { id: data.message_id },
      relations: ['thread'],
    });
    if (!message || message.thread.machine_id !== machineId) return;

    // Don't overwrite terminal statuses (e.g. user already cancelled)
    const terminalStatuses = ['completed', 'cancelled', 'error', 'timed_out'];
    if (terminalStatuses.includes(message.status)) {
      this.logger.log(
        `Ignoring task:complete for ${data.message_id} — already "${message.status}"`,
      );
      return;
    }

    message.status = data.status;
    message.content = data.summary || message.content;
    message.metadata = data.metadata ? JSON.stringify(data.metadata) : null;
    message.completed_at = new Date();
    await this.messageRepository.save(message);

    this.logger.log(
      `Task complete: message ${data.message_id} → ${data.status}`,
    );

    // Record agent log
    const logTypeMap: Record<string, string> = {
      completed: 'task_completed',
      error: 'task_error',
      cancelled: 'task_cancelled',
      timed_out: 'task_timed_out',
    };
    void this.agentLogsService.record(
      machineId,
      logTypeMap[data.status] || 'task_completed',
      `Task ${data.status}: ${data.message_id}${data.summary ? ` — ${data.summary.slice(0, 100)}` : ''}`,
      {
        message_id: data.message_id,
        thread_id: message.thread_id,
        status: data.status,
      },
    );

    // Fan out completion via Redis → SSE
    await this.streamingService.publishMessageComplete(
      message.thread_id,
      data.message_id,
      data.status,
      data.summary,
      data.metadata,
    );

    // Also notify thread list that this thread has new activity
    await this.streamingService.publishThreadUpdate(
      machineId,
      message.thread_id,
      (data.summary || '').slice(0, 100),
      data.status,
      message.completed_at,
    );

    // Publish user-level notification for global toast
    await this.publishUserNotification(
      machineId,
      message,
      data.status,
      data.summary,
    );
  }

  private async publishUserNotification(
    machineId: string,
    message: Message,
    status: string,
    summary?: string,
  ): Promise<void> {
    try {
      const machine = await this.machineRepository.findOne({
        where: { id: machineId },
      });
      if (!machine) return;

      const thread = await this.threadRepository.findOne({
        where: { id: message.thread_id },
      });
      if (!thread) return;

      const typeMap: Record<string, string> = {
        completed: 'task_completed',
        error: 'task_error',
        timed_out: 'task_timed_out',
        cancelled: 'task_cancelled',
      };

      await this.streamingService.publishNotification(machine.user_id, {
        type: (typeMap[status] || 'task_completed') as
          | 'task_completed'
          | 'task_error'
          | 'task_timed_out'
          | 'task_cancelled',
        thread_id: thread.id,
        thread_title: thread.title,
        machine_name: machine.name,
        message_id: message.id,
        summary: summary?.slice(0, 200),
      });
    } catch (err) {
      this.logger.warn(`Failed to publish user notification: ${err}`);
    }
  }

  handleHealthReport(machineId: string, data: Record<string, unknown>): void {
    this.logger.log(
      `Health report from machine ${machineId}: ${JSON.stringify(data)}`,
    );
    void this.machineRepository.query(
      'UPDATE machines SET health_info = ? WHERE id = ?',
      [JSON.stringify(data), machineId],
    );

    // Record agent log
    const agents = data.agents as
      | Record<string, { available: boolean; version?: string }>
      | undefined;
    const agentSummary = agents
      ? Object.entries(agents)
          .map(
            ([name, info]) =>
              `${name}: ${info.available ? `v${info.version}` : 'unavailable'}`,
          )
          .join(', ')
      : 'unknown';
    void this.agentLogsService.record(
      machineId,
      'health_report',
      `Health report: ${agentSummary}`,
      data,
    );
  }

  // --- Request/Response Correlation ---

  sendRequest(
    machineId: string,
    event: string,
    data: Record<string, unknown>,
    timeoutMs = 5000,
  ): Promise<unknown> {
    const requestId = crypto.randomUUID();
    const sent = this.sendToMachine(machineId, event, {
      ...data,
      request_id: requestId,
    });
    if (!sent) {
      return Promise.reject(new Error('Machine not connected'));
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Machine not responding'));
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timer });
    });
  }

  handleRequestResult(
    data: { request_id: string } & Record<string, unknown>,
  ): void {
    const pending = this.pendingRequests.get(data.request_id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingRequests.delete(data.request_id);
    pending.resolve(data);
  }

  async dispatchQueuedMessages(machineId: string): Promise<void> {
    // Find all queued assistant messages for threads on this machine
    const queuedMessages = await this.messageRepository
      .createQueryBuilder('message')
      .innerJoinAndSelect('message.thread', 'thread')
      .leftJoinAndSelect('thread.workspace', 'workspace')
      .where('thread.machine_id = :machineId', { machineId })
      .andWhere('message.role = :role', { role: 'assistant' })
      .andWhere('message.status = :status', { status: 'queued' })
      .orderBy('message.created_at', 'ASC')
      .getMany();

    for (const assistantMsg of queuedMessages) {
      // Find the user message that immediately precedes this assistant message
      const userMessage = await this.messageRepository
        .createQueryBuilder('message')
        .where('message.thread_id = :threadId', {
          threadId: assistantMsg.thread_id,
        })
        .andWhere('message.role = :role', { role: 'user' })
        .andWhere('message.created_at <= :createdAt', {
          createdAt: assistantMsg.created_at,
        })
        .orderBy('message.created_at', 'DESC')
        .getOne();

      if (userMessage) {
        await this.dispatchTaskWithPrompt(
          machineId,
          assistantMsg,
          assistantMsg.thread,
          userMessage.content,
        );
      }
    }
  }
}
