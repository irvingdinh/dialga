import crypto from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { WebSocket } from 'ws';

import { Machine, Message, Thread } from '../core/entities/index.js';

interface ConnectedMachine {
  machineId: string;
  socket: WebSocket;
  lastHeartbeat: number;
}

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);
  private readonly connections = new Map<WebSocket, ConnectedMachine>();
  private readonly machineToSocket = new Map<string, WebSocket>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(Machine)
    private readonly machineRepository: Repository<Machine>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Thread)
    private readonly threadRepository: Repository<Thread>,
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

    await this.machineRepository.update(machineId, {
      status: 'online',
      last_seen_at: new Date(),
    });

    this.logger.log(`Machine ${machineId} connected`);
  }

  async handleDisconnect(socket: WebSocket): Promise<void> {
    const conn = this.connections.get(socket);
    if (!conn) return;

    this.connections.delete(socket);
    this.machineToSocket.delete(conn.machineId);

    await this.machineRepository.update(conn.machineId, {
      status: 'offline',
      last_seen_at: new Date(),
    });

    this.logger.log(`Machine ${conn.machineId} disconnected`);
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

    const sent = this.sendToMachine(machineId, 'task:start', taskData);

    if (sent) {
      assistantMessage.status = 'running';
      assistantMessage.started_at = new Date();
      await this.messageRepository.save(assistantMessage);
    }

    return sent;
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

    // TODO: Phase 4 — emit via Redis Pub/Sub → SSE for live streaming
    this.logger.debug(
      `task:output [${data.type}] for message ${data.message_id}`,
    );
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
    const message = await this.messageRepository.findOne({
      where: { id: data.message_id },
      relations: ['thread'],
    });
    if (!message || message.thread.machine_id !== machineId) return;

    message.status = data.status;
    message.content = data.summary || message.content;
    message.metadata = data.metadata ? JSON.stringify(data.metadata) : null;
    message.completed_at = new Date();
    await this.messageRepository.save(message);

    this.logger.log(
      `Task complete: message ${data.message_id} → ${data.status}`,
    );
  }

  handleHealthReport(machineId: string, data: Record<string, unknown>): void {
    this.logger.log(
      `Health report from machine ${machineId}: ${JSON.stringify(data)}`,
    );
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
      // Find the user message that preceded this assistant message
      const userMessage = await this.messageRepository.findOne({
        where: {
          thread_id: assistantMsg.thread_id,
          role: 'user',
        },
        order: { created_at: 'DESC' },
      });

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
